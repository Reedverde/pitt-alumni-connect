import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { loadCurrentEdition } from "./editions.server";
import { editionDateRange } from "./edition-format";
import { partySizeLink } from "./party-token.server";
import {
  DISCORD_INVITE_SUBJECT,
  EVENT_RSVP_PROMPT_SUBJECT,
  HOTEL_REMINDER_SUBJECT,
  T_MINUS_10_SUBJECT,
  T_MINUS_14_SUBJECT,
  T_MINUS_2_SUBJECT,
  T_MINUS_45_SUBJECT,
  T_MINUS_7_SUBJECT,
  T_PLUS_3_SUBJECT,
  buildDiscordInviteBody,
  buildEventRsvpPromptBody,
  buildHotelReminderBody,
  buildTMinus10Body,
  buildTMinus14Body,
  buildTMinus28Body,
  buildTMinus2Body,
  buildTMinus45Body,
  buildTMinus7Body,
  buildTPlus3Body,
  loadCohortGoing,
  loadScheduleLines,
  sendPlainEmail,
  tMinus28Subject,
} from "./mail.server";
import { loadEventAnswersByPerson, loadPromptEvents } from "./event-rsvp.server";


/** The one derivation of a person's state for the current edition. */
export type PersonState = "unclaimed" | "claimed" | "going" | "maybe" | "not_this_year";

export function personState(opts: {
  status: string | null | undefined;
  verified: boolean;
}): PersonState {
  if (opts.status === "going") return "going";
  if (opts.status === "maybe") return "maybe";
  if (opts.status === "not_this_year") return "not_this_year";
  if (opts.verified) return "claimed";
  return "unclaimed";
}

export type Recipient = {
  personId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  state: PersonState;
  isAnchor: boolean;
};

type SequenceRow = {
  id: string;
  key: string;
  audience_states: string[] | null;
  anchors_only: boolean;
  active: boolean;
};

const RECENT_SEND_DAYS = 7;
const SEND_INTERVAL_MS = 500;

async function loadSequence(key: string): Promise<SequenceRow | null> {
  const { data } = await supabaseAdmin
    .from("sequences")
    .select("id, key, audience_states, anchors_only, active")
    .eq("key", key)
    .maybeSingle();
  return (data as SequenceRow | null) ?? null;
}

/** Everyone who belongs to a sequence's audience, before any send history is
 *  considered. Deceased, archived, address-less and suppressed people are gone
 *  by the time this returns. */
export async function resolveAudience(sequenceKey: string): Promise<Recipient[]> {
  const seq = await loadSequence(sequenceKey);
  if (!seq) return [];
  const states = seq.audience_states ?? [];
  const edition = await loadCurrentEdition();

  const [peopleRes, identRes, rsvpRes, supRes] = await Promise.all([
    supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, deceased, archived, is_anchor")
      .eq("deceased", false)
      .eq("archived", false),
    supabaseAdmin.from("identities").select("person_id, email, is_primary, verified_at"),
    supabaseAdmin.from("rsvps").select("person_id, status").eq("event_year", edition.event_year),
    supabaseAdmin.from("suppressions").select("email"),
  ]);

  const primaryEmail = new Map<string, string>();
  const verified = new Set<string>();
  for (const row of identRes.data ?? []) {
    const pid = row.person_id as string;
    if (row.verified_at) verified.add(pid);
    if (row.is_primary && typeof row.email === "string" && row.email.trim())
      primaryEmail.set(pid, row.email.trim().toLowerCase());
  }

  const rsvpStatus = new Map<string, string>();
  for (const row of rsvpRes.data ?? []) rsvpStatus.set(row.person_id as string, row.status as string);

  const suppressed = new Set<string>();
  for (const row of supRes.data ?? []) suppressed.add(String(row.email ?? "").trim().toLowerCase());

  const out: Recipient[] = [];
  for (const person of (peopleRes.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string | null;
    deceased: boolean;
    archived: boolean;
    is_anchor: boolean;
  }[]) {
    if (person.deceased || person.archived) continue;
    if (seq.anchors_only && !person.is_anchor) continue;
    const state = personState({ status: rsvpStatus.get(person.id), verified: verified.has(person.id) });
    if (!states.includes(state)) continue;
    const email = primaryEmail.get(person.id);
    if (!email || suppressed.has(email)) continue;
    out.push({
      personId: person.id,
      email,
      firstName: person.first_name,
      lastName: person.last_name,
      state,
      isAnchor: person.is_anchor,
    });
  }
  return out;
}

type Built = { subject: string; text: string; html: string } | null;

const BUILDER_KEYS = new Set([
  "t_minus_45",
  "t_minus_28",
  "t_minus_21",
  "t_minus_14",
  "t_minus_10_headcount",
  "t_minus_7",
  "t_minus_2",
  "t_plus_3",
  "discord_invite",
]);

async function buildFor(
  key: string,
  person: { id: string; name: string },
  shared: { schedule: string[]; dates: string; editionYear: number },
): Promise<Built> {
  const name = person.name;
  switch (key) {
    case "t_minus_45":
      return { subject: T_MINUS_45_SUBJECT, ...buildTMinus45Body({ name }) };
    case "discord_invite":
      return { subject: DISCORD_INVITE_SUBJECT, ...buildDiscordInviteBody({ name, dates: shared.dates }) };
    case "t_minus_28":
      return { subject: HOTEL_REMINDER_SUBJECT, ...buildHotelReminderBody({ name }) };
    case "t_minus_21": {
      const cohort = await loadCohortGoing(person.id);
      const body = buildTMinus28Body({ name, cohort });
      if (!body) return null;
      return { subject: tMinus28Subject(cohort.year ?? shared.editionYear), ...body };
    }
    case "t_minus_7":
      return { subject: T_MINUS_7_SUBJECT, ...buildTMinus7Body({ name }) };
    case "t_minus_14":
      return { subject: T_MINUS_14_SUBJECT, ...buildTMinus14Body({ name, schedule: shared.schedule }) };
    case "t_minus_2":
      return { subject: T_MINUS_2_SUBJECT, ...buildTMinus2Body({ name, schedule: shared.schedule }) };
    case "t_minus_10_headcount": {
      const body = buildTMinus10Body({ name, oneClickLink: await partySizeLink(person.id) });
      if (!body) return null;
      return { subject: T_MINUS_10_SUBJECT, ...body };
    }
    case "t_plus_3":
      return { subject: T_PLUS_3_SUBJECT, ...buildTPlus3Body({ name }) };
    default:
      return null;
  }
}

export type DispatchSkips = {
  already_sent: number;
  recent_send: number;
  no_body: number;
  over_limit: number;
};

export type DispatchResult = {
  ok: boolean;
  reason: string | null;
  sequenceKey: string;
  sequenceId: string | null;
  dryRun: boolean;
  audience: number;
  wouldSend: { personId: string; email: string; firstName: string; isAnchor: boolean }[];
  skips: DispatchSkips;
  sample: { subject: string; text: string; html: string } | null;
  sent: number;
  failed: number;
};

function empty(sequenceKey: string, dryRun: boolean, reason: string): DispatchResult {
  return {
    ok: false,
    reason,
    sequenceKey,
    sequenceId: null,
    dryRun,
    audience: 0,
    wouldSend: [],
    skips: { already_sent: 0, recent_send: 0, no_body: 0, over_limit: 0 },
    sample: null,
    sent: 0,
    failed: 0,
  };
}

/** One sequence, one run, by hand. Dry run is the default and writes nothing. */
export async function dispatchSequence(opts: {
  sequenceKey: string;
  limit?: number;
  anchorsFirst?: boolean;
  dryRun?: boolean;
}): Promise<DispatchResult> {
  const dryRun = opts.dryRun !== false;
  const key = opts.sequenceKey;
  const limit = Math.max(0, opts.limit ?? Number.MAX_SAFE_INTEGER);

  const seq = await loadSequence(key);
  if (!seq) return empty(key, dryRun, `No sequence row with key "${key}".`);
  if (!seq.active) return empty(key, dryRun, `Sequence "${key}" is not active.`);
  if (!BUILDER_KEYS.has(key)) return empty(key, dryRun, `No email copy exists for "${key}".`);

  const edition = await loadCurrentEdition();
  const audience = await resolveAudience(key);

  const { data: sendRows } = await supabaseAdmin
    .from("sends")
    .select("person_id, sequence_id, outcome, created_at");

  const alreadySent = new Set<string>();
  const recentlySent = new Set<string>();
  const cutoff = Date.now() - RECENT_SEND_DAYS * 86400000;
  for (const row of sendRows ?? []) {
    const pid = row.person_id as string | null;
    if (!pid || row.outcome !== "sent") continue;
    const seqId = row.sequence_id as string | null;
    if (!seqId) continue;
    if (seqId === seq.id) alreadySent.add(pid);
    const at = Date.parse(String(row.created_at ?? ""));
    if (Number.isFinite(at) && at >= cutoff) recentlySent.add(pid);
  }

  const skips: DispatchSkips = { already_sent: 0, recent_send: 0, no_body: 0, over_limit: 0 };
  const queue = audience.filter((r) => {
    if (alreadySent.has(r.personId)) {
      skips.already_sent++;
      return false;
    }
    if (recentlySent.has(r.personId)) {
      skips.recent_send++;
      return false;
    }
    return true;
  });

  if (opts.anchorsFirst) queue.sort((a, b) => Number(b.isAnchor) - Number(a.isAnchor));

  const needsSchedule = key === "t_minus_14" || key === "t_minus_2";
  const shared = {
    schedule: needsSchedule ? await loadScheduleLines() : [],
    dates: editionDateRange(edition),
    editionYear: edition.event_year,
  };

  const wouldSend: DispatchResult["wouldSend"] = [];
  let sample: DispatchResult["sample"] = null;
  let sent = 0;
  let failed = 0;

  for (const r of queue) {
    if (wouldSend.length >= limit) {
      skips.over_limit++;
      continue;
    }
    const name = [r.firstName, r.lastName].filter(Boolean).join(" ");
    const built = await buildFor(key, { id: r.personId, name }, shared);
    if (!built) {
      skips.no_body++;
      continue;
    }
    if (!sample) sample = built;
    wouldSend.push({ personId: r.personId, email: r.email, firstName: r.firstName, isAnchor: r.isAnchor });

    if (dryRun) continue;

    const result = await sendPlainEmail({
      to: r.email,
      personId: r.personId,
      kind: `drip:${key}`,
      subject: built.subject,
      text: built.text,
      html: built.html,
      sequenceId: seq.id,
    });
    if (result.sent) sent++;
    else failed++;
    await new Promise((res) => setTimeout(res, SEND_INTERVAL_MS));
  }

  return {
    ok: true,
    reason: null,
    sequenceKey: key,
    sequenceId: seq.id,
    dryRun,
    audience: audience.length,
    wouldSend,
    skips,
    sample,
    sent,
    failed,
  };
}
