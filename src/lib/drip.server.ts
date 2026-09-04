import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { loadCurrentEdition } from "./editions.server";
import { editionDateRange } from "./edition-format";
import { partySizeLink } from "./party-token.server";
import { rsvpAnswerLinks } from "./rsvp-token.server";
import {
  DISCORD_INVITE_SUBJECT,
  eventRsvpPromptSubject,
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
  buildRsvpConfirmBody,
  buildTPlus3Body,
  loadCohortGoing,
  loadScheduleLines,
  sendPlainEmail,
  tMinus28Subject,
  RSVP_CONFIRM_SUBJECT,
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

const RECENT_SEND_DAYS = 10;
const SEND_INTERVAL_MS = 500;

async function loadSequence(key: string): Promise<SequenceRow | null> {
  const { data } = await supabaseAdmin
    .from("sequences")
    .select("id, key, audience_states, anchors_only, active")
    .eq("key", key)
    .maybeSingle();
  return (data as SequenceRow | null) ?? null;
}

/** The address to write to: the primary when it is still deliverable, else any
 *  other address that is not suppressed. Verified addresses come first. */
export function pickDeliverable(
  list: { email: string; primary: boolean; verified: boolean }[] | undefined,
  suppressed: Set<string>,
): string | null {
  const live = (list ?? []).filter((a) => !suppressed.has(a.email));
  if (live.length === 0) return null;
  const rank = (a: { primary: boolean; verified: boolean }) =>
    (a.primary ? 0 : 2) + (a.verified ? 0 : 1);
  live.sort((a, b) => rank(a) - rank(b));
  return live[0]!.email;
}

/** Everyone who belongs to a sequence's audience, before any send history is
 *  considered. Deceased, archived, address-less and suppressed people are gone
 *  by the time this returns. */
export async function resolveAudience(sequenceKey: string): Promise<Recipient[]> {
  const seq = await loadSequence(sequenceKey);
  if (!seq) return [];
  const states = seq.audience_states ?? [];
  const edition = await loadCurrentEdition();

  const [peopleRes, identRes, rsvpRes, supRes, historyRes] = await Promise.all([
    supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, deceased, archived, is_anchor, show_on_board")
      .eq("deceased", false)
      .eq("archived", false),
    supabaseAdmin.from("identities").select("person_id, email, is_primary, verified_at"),
    supabaseAdmin.from("rsvps").select("person_id, status").eq("event_year", edition.event_year),
    supabaseAdmin.from("suppressions").select("email"),
    supabaseAdmin.from("sends").select("person_id, bounced, bounce_type, complained"),
  ]);

  const verified = new Set<string>();
  const addresses = new Map<string, { email: string; primary: boolean; verified: boolean }[]>();
  for (const row of identRes.data ?? []) {
    const pid = row.person_id as string;
    if (row.verified_at) verified.add(pid);
    if (typeof row.email !== "string" || !row.email.trim()) continue;
    const list = addresses.get(pid) ?? [];
    list.push({
      email: row.email.trim().toLowerCase(),
      primary: Boolean(row.is_primary),
      verified: Boolean(row.verified_at),
    });
    addresses.set(pid, list);
  }

  const rsvpStatus = new Map<string, string>();
  for (const row of rsvpRes.data ?? []) rsvpStatus.set(row.person_id as string, row.status as string);

  const suppressed = new Set<string>();
  for (const row of supRes.data ?? []) suppressed.add(String(row.email ?? "").trim().toLowerCase());

  // A hard bounce or a complaint on any past send retires the person for good.
  const burned = new Set<string>();
  for (const row of historyRes.data ?? []) {
    const pid = row.person_id as string | null;
    if (!pid) continue;
    if (row.complained || (row.bounced && row.bounce_type === "hard")) burned.add(pid);
  }

  const out: Recipient[] = [];
  for (const person of (peopleRes.data ?? []) as {
    id: string;
    first_name: string;
    last_name: string | null;
    deceased: boolean;
    archived: boolean;
    is_anchor: boolean;
    show_on_board: boolean;
  }[]) {
    if (person.deceased || person.archived) continue;
    if (!person.show_on_board) continue;
    if (burned.has(person.id)) continue;
    if (seq.anchors_only && !person.is_anchor) continue;
    const state = personState({ status: rsvpStatus.get(person.id), verified: verified.has(person.id) });
    if (!states.includes(state)) continue;
    // Reachability is a property of the addresses, not of the primary one:
    // a dead alternate must not retire someone whose other address works.
    const email = pickDeliverable(addresses.get(person.id), suppressed);
    if (!email) continue;
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

export const BUILDER_KEYS = new Set([
  "t_minus_45",
  "t_minus_28",
  "t_minus_21",
  "t_minus_14",
  "t_minus_10_headcount",
  "t_minus_7",
  "t_minus_2",
  "t_plus_3",
  "discord_invite",
  "event_rsvp_prompt",
  "rsvp_confirm_2026_09_04",
]);

export type Shared = {
  schedule: string[];
  dates: string;
  editionYear: number;
  /** person id -> prompt event labels they have not answered yet. */
  pendingEvents: Map<string, string[]>;
};

/** Which prompt events each person still owes an answer on. Answering yes or no
 *  removes the event from their list for good, so a reminder never repeats for
 *  an event that has an answer of any kind. */
export async function loadPendingEvents(): Promise<Map<string, string[]>> {
  const events = await loadPromptEvents();
  const answered = await loadEventAnswersByPerson();
  const all = events.map((e) => e.label);
  const pending = new Map<string, string[]>();
  for (const [pid, list] of answered) {
    const done = new Set(list.map((a) => a.event_id));
    pending.set(
      pid,
      events.filter((e) => !done.has(e.id)).map((e) => e.label),
    );
  }
  // Anyone with no rows at all owes every event; represented by the default.
  pending.set("__all__", all);
  return pending;
}

export async function buildFor(
  key: string,
  person: { id: string; name: string; firstName: string },
  shared: Shared,
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
    case "event_rsvp_prompt": {
      const pending =
        shared.pendingEvents.get(person.id) ?? shared.pendingEvents.get("__all__") ?? [];
      const body = buildEventRsvpPromptBody({ name, pending });
      if (!body) return null;
      return { subject: eventRsvpPromptSubject(pending.length), ...body };
    }
    case "rsvp_confirm_2026_09_04": {
      // The recipient's own signed link, never a generic page. No link, no send.
      const links = await rsvpAnswerLinks(person.id);
      if (!links) return null;
      const body = buildRsvpConfirmBody({
        firstName: person.firstName,
        link: `${links.going}&src=email`,
      });
      if (!body) return null;
      return { subject: RSVP_CONFIRM_SUBJECT, ...body };
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
  /** False means this run was a preview of a campaign that cannot send yet. */
  sequenceActive: boolean;
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
    sequenceActive: false,
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
  // An inactive sequence must never send, but organizers do need to read a
  // campaign before switching it on. A dry run is allowed to walk an inactive
  // sequence; only a real send is refused.
  if (!seq.active && !dryRun) return empty(key, dryRun, `Sequence "${key}" is not active.`);
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
  const shared: Shared = {
    schedule: needsSchedule ? await loadScheduleLines() : [],
    dates: editionDateRange(edition),
    editionYear: edition.event_year,
    pendingEvents: key === "event_rsvp_prompt" ? await loadPendingEvents() : new Map(),
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
    const built = await buildFor(key, { id: r.personId, name, firstName: r.firstName }, shared);
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
    reason: seq.active ? null : `Preview only: sequence "${key}" is not active and will not send.`,
    sequenceKey: key,
    sequenceId: seq.id,
    dryRun,
    audience: audience.length,
    sequenceActive: seq.active,
    wouldSend,
    skips,
    sample,
    sent,
    failed,
  };
}
