import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { loadCurrentEdition } from "./editions.server";
import { editionDateRange } from "./edition-format";
import { BUILDER_KEYS, buildFor, loadPendingEvents, type Shared } from "./drip.server";
import { loadScheduleLines, outboundEmailMode, sendPlainEmail } from "./mail.server";

/** A targeted resend: an organizer names the exact addresses.
 *
 *  It deliberately skips the "already sent this sequence" rule and the ten day
 *  cooldown, because resending is the whole point. It never skips a
 *  suppression or a memorial record, and it ignores show_on_board, which
 *  governs the public board and not deliverability. */

export type TargetedRow = {
  email: string;
  personId: string | null;
  name: string | null;
  rsvpStatus: string | null;
  skip: string | null;
  sent?: boolean;
  error?: string | null;
};

export type TargetedResult = {
  ok: boolean;
  reason: string | null;
  campaignKey: string;
  dryRun: boolean;
  outboundMode: string;
  rows: TargetedRow[];
  sent: number;
  failed: number;
  skipped: number;
  subject: string | null;
};

export function listCampaignKeys(): string[] {
  return [...BUILDER_KEYS].sort();
}

function parseAddresses(raw: string): string[] {
  const seen = new Set<string>();
  for (const line of raw.split(/[\n,;]+/)) {
    const email = line.trim().toLowerCase();
    if (email && email.includes("@")) seen.add(email);
  }
  return [...seen];
}

async function sequenceIdFor(key: string): Promise<string | null> {
  const { data } = await supabaseAdmin.from("sequences").select("id").eq("key", key).maybeSingle();
  return (data as { id?: string } | null)?.id ?? null;
}

export async function runTargetedResend(opts: {
  campaignKey: string;
  addresses: string;
  dryRun: boolean;
}): Promise<TargetedResult> {
  const key = opts.campaignKey;
  const dryRun = opts.dryRun;
  const mode = await outboundEmailMode();
  const emails = parseAddresses(opts.addresses);

  const base: TargetedResult = {
    ok: true,
    reason: null,
    campaignKey: key,
    dryRun,
    outboundMode: mode,
    rows: [],
    sent: 0,
    failed: 0,
    skipped: 0,
    subject: null,
  };

  if (!BUILDER_KEYS.has(key)) return { ...base, ok: false, reason: `No email copy exists for "${key}".` };
  if (emails.length === 0) return { ...base, ok: false, reason: "No addresses given." };
  if (!dryRun && mode !== "all")
    return { ...base, ok: false, reason: "Outbound email is paused (transactional_only)." };

  const edition = await loadCurrentEdition();
  const [identRes, supRes] = await Promise.all([
    supabaseAdmin.from("identities").select("person_id, email").in("email", emails),
    supabaseAdmin.from("suppressions").select("email"),
  ]);

  const suppressed = new Set(
    (supRes.data ?? []).map((r) => String(r.email ?? "").trim().toLowerCase()),
  );
  // identities may hold mixed case; match case-insensitively as a second pass.
  const byEmail = new Map<string, string>();
  for (const row of identRes.data ?? []) {
    const email = String(row.email ?? "").trim().toLowerCase();
    if (email && !byEmail.has(email)) byEmail.set(email, row.person_id as string);
  }
  const missing = emails.filter((e) => !byEmail.has(e));
  if (missing.length > 0) {
    const { data } = await supabaseAdmin.from("identities").select("person_id, email");
    for (const row of data ?? []) {
      const email = String(row.email ?? "").trim().toLowerCase();
      if (missing.includes(email) && !byEmail.has(email)) byEmail.set(email, row.person_id as string);
    }
  }

  const personIds = [...new Set([...byEmail.values()])];
  const [peopleRes, rsvpRes] = await Promise.all([
    personIds.length
      ? supabaseAdmin
          .from("people")
          .select("id, first_name, last_name, deceased, archived")
          .in("id", personIds)
      : Promise.resolve({ data: [] as never[] }),
    personIds.length
      ? supabaseAdmin
          .from("rsvps")
          .select("person_id, status")
          .eq("event_year", edition.event_year)
          .in("person_id", personIds)
      : Promise.resolve({ data: [] as never[] }),
  ]);

  const people = new Map<
    string,
    { id: string; first_name: string; last_name: string | null; deceased: boolean; archived: boolean }
  >();
  for (const p of (peopleRes.data ?? []) as never[]) {
    const row = p as unknown as {
      id: string;
      first_name: string;
      last_name: string | null;
      deceased: boolean;
      archived: boolean;
    };
    people.set(row.id, row);
  }
  const rsvpStatus = new Map<string, string>();
  for (const r of (rsvpRes.data ?? []) as never[]) {
    const row = r as unknown as { person_id: string; status: string };
    rsvpStatus.set(row.person_id, row.status);
  }

  const shared: Shared = {
    schedule: key === "t_minus_14" || key === "t_minus_2" ? await loadScheduleLines() : [],
    dates: editionDateRange(edition),
    editionYear: edition.event_year,
    pendingEvents: key === "event_rsvp_prompt" ? await loadPendingEvents() : new Map(),
  };

  const sequenceId = await sequenceIdFor(key);
  const rows: TargetedRow[] = [];
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const email of emails) {
    const personId = byEmail.get(email) ?? null;
    const person = personId ? people.get(personId) : undefined;
    const name = person ? [person.first_name, person.last_name].filter(Boolean).join(" ") : null;
    const status = personId ? (rsvpStatus.get(personId) ?? null) : null;

    let skip: string | null = null;
    if (!person) skip = "no person on record for this address";
    else if (suppressed.has(email)) skip = "address is suppressed";
    else if (person.deceased) skip = "memorial record";
    else if (person.archived) skip = "archived record";

    let built = null;
    if (!skip && person) {
      built = await buildFor(key, { id: person.id, name: name ?? person.first_name, firstName: person.first_name }, shared);
      if (!built) skip = "no message could be built for this person";
    }
    if (built && !base.subject) base.subject = built.subject;

    if (skip) {
      skipped++;
      rows.push({ email, personId, name, rsvpStatus: status, skip });
      continue;
    }

    if (dryRun) {
      rows.push({ email, personId, name, rsvpStatus: status, skip: null });
      continue;
    }

    const result = await sendPlainEmail({
      to: email,
      personId,
      kind: `drip:${key}`,
      subject: built!.subject,
      text: built!.text,
      html: built!.html,
      sequenceId,
    });
    if (result.sent) sent++;
    else failed++;
    rows.push({
      email,
      personId,
      name,
      rsvpStatus: status,
      skip: null,
      sent: result.sent,
      error: result.sent ? null : (result.reason ?? "send failed"),
    });
    await new Promise((res) => setTimeout(res, 500));
  }

  return { ...base, rows, sent, failed, skipped };
}
