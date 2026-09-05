import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { timingSentenceWithDate } from "./event-timing";
import { audienceLabel } from "./event-model";

/**
 * Net public change detection for the daily bulletin.
 *
 * The events table trigger records every single edit in `event_changes` for
 * the durable audit trail. That table is deliberately NOT the source of the
 * bulletin: reading it would announce intermediate versions ("moved to 11am",
 * then "moved to 10am") and would announce a change that was later undone.
 *
 * Instead we keep, per event, the public state as it was last announced
 * (`event_announced_state`). At the daily cutoff we compare the *final current*
 * state against that baseline. Multiple edits to one event therefore coalesce
 * into a single line, and a reverted change produces nothing at all because the
 * final state equals the announced state again.
 */

export type PublicState = {
  published: boolean;
  title: string;
  day_number: number | null;
  starts_at: string | null;
  ends_at: string | null;
  doors_at: string | null;
  relative_timing: string | null;
  time_tbd: boolean;
  location: string | null;
  audience: string;
  division: string | null;
  status: string;
  ticket_url: string | null;
};

type EventRow = PublicState & { id: string; event_year: number };

const EVENT_COLUMNS =
  "id, event_year, published, title, day_number, starts_at, ends_at, doors_at, relative_timing, time_tbd, location, audience, division, status, ticket_url";

/** Case, punctuation and whitespace differences are formatting, not news. A
 *  real spelling fix ("Schenly" to "Schenley") still reads as a change here;
 *  that is what the organizer's quiet-save control is for. */
function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .toLowerCase()
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/[.,;:!?'"()\-–—]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sameInstant(a: string | null, b: string | null) {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return Date.parse(a) === Date.parse(b);
}

function toState(row: EventRow): PublicState {
  return {
    published: Boolean(row.published),
    title: row.title,
    day_number: row.day_number ?? null,
    starts_at: row.starts_at ?? null,
    ends_at: row.ends_at ?? null,
    doors_at: row.doors_at ?? null,
    relative_timing: row.relative_timing ?? null,
    time_tbd: Boolean(row.time_tbd),
    location: row.location ?? null,
    audience: row.audience ?? "everyone",
    division: row.division ?? null,
    status: row.status ?? "tentative",
    ticket_url: row.ticket_url ?? null,
  };
}

function readState(raw: unknown): PublicState | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  return {
    published: Boolean(r.published),
    title: String(r.title ?? ""),
    day_number: (r.day_number as number | null) ?? null,
    starts_at: (r.starts_at as string | null) ?? null,
    ends_at: (r.ends_at as string | null) ?? null,
    doors_at: (r.doors_at as string | null) ?? null,
    relative_timing: (r.relative_timing as string | null) ?? null,
    time_tbd: Boolean(r.time_tbd),
    location: (r.location as string | null) ?? null,
    audience: String(r.audience ?? "everyone"),
    division: (r.division as string | null) ?? null,
    status: String(r.status ?? "tentative"),
    ticket_url: (r.ticket_url as string | null) ?? null,
  };
}

function whenChanged(before: PublicState, after: PublicState) {
  return (
    !sameInstant(before.starts_at, after.starts_at) ||
    !sameInstant(before.ends_at, after.ends_at) ||
    !sameInstant(before.doors_at, after.doors_at) ||
    before.time_tbd !== after.time_tbd ||
    normalizeText(before.relative_timing) !== normalizeText(after.relative_timing) ||
    before.day_number !== after.day_number
  );
}

/**
 * The two fields an organizer is allowed to correct silently. Everything else
 * is material: if it differs from what the public was last told, it owes the
 * public a line, and no quiet save can absorb it.
 */
export const COSMETIC_FIELDS = ["title", "location"] as const;

/** Which material fields differ between the announced baseline and now. */
export function materialDiff(before: PublicState | null, after: PublicState | null): string[] {
  if (!before || !after) return ["published"];
  const out: string[] = [];
  if (before.published !== after.published) out.push("published");
  if (whenChanged(before, after)) out.push("when");
  if (before.audience !== after.audience) out.push("audience");
  if (before.division !== after.division) out.push("division");
  if (before.status !== after.status) out.push("status");
  if ((before.ticket_url ?? "").trim() !== (after.ticket_url ?? "").trim()) out.push("ticket_url");
  return out;
}

function statusPhrase(status: string): string {
  switch (status) {
    case "confirmed":
      return "is confirmed";
    case "changed":
      return "has changed";
    case "tentative":
      return "is back to tentative";
    case "postponed":
      return "is postponed";
    default:
      return `is marked ${status}`;
  }
}

/** The public-facing sentence for one event's net change, or null when the
 *  difference is only formatting, internal or private. */
export function describeChange(before: PublicState | null, after: PublicState | null): string | null {
  // Never announced and still not public: organizers are drafting.
  if ((!before || !before.published) && (!after || !after.published)) return null;

  // Was on the schedule, now gone or pulled down.
  if (!after || !after.published) {
    const title = before!.title;
    return `${title} is off the schedule.`;
  }

  // Newly public.
  if (!before || !before.published) {
    const where = after.location?.trim() ? ` at ${after.location.trim()}` : "";
    return `${after.title} is on the schedule: ${timingSentenceWithDate(after)}${where}.`;
  }

  if (after.status === "cancelled" && before.status !== "cancelled")
    return `${after.title} is cancelled.`;

  const bits: string[] = [];

  if (whenChanged(before, after)) bits.push(`is now ${timingSentenceWithDate(after)}`);

  if (normalizeText(before.location) !== normalizeText(after.location))
    bits.push(after.location?.trim() ? `is now at ${after.location.trim()}` : "has a new location");

  if (before.audience !== after.audience || before.division !== after.division)
    bits.push(`is for ${audienceLabel(after.audience, after.division).toLowerCase()}`);

  if (before.status !== after.status) bits.push(statusPhrase(after.status));

  const hadTickets = Boolean(before.ticket_url?.trim());
  const hasTickets = Boolean(after.ticket_url?.trim());
  if (!hadTickets && hasTickets) bits.push("has tickets available");
  if (hadTickets && !hasTickets) bits.push("no longer has a ticket link");

  const titleChanged =
    normalizeText(before.title) !== normalizeText(after.title) && before.title !== after.title;
  if (titleChanged) bits.push(`is now called ${after.title}`);

  if (bits.length === 0) return null;

  const subject = titleChanged ? before.title : after.title;
  return `${subject} ${bits.join(" and ")}.`;
}

export type NetChange = {
  eventId: string;
  eventYear: number | null;
  line: string;
  state: PublicState | null;
  title: string;
};

/** Every net public change since each event was last announced. Writes nothing. */
export async function computeNetChanges(): Promise<NetChange[]> {
  const [eventsRes, baselineRes] = await Promise.all([
    supabaseAdmin.from("events").select(EVENT_COLUMNS).order("day_number").order("sort_order"),
    supabaseAdmin.from("event_announced_state").select("event_id, event_year, title, state"),
  ]);

  const events = (eventsRes.data ?? []) as unknown as EventRow[];
  const baseline = new Map<string, { state: PublicState | null; year: number | null; title: string }>();
  for (const row of baselineRes.data ?? []) {
    const r = row as { event_id: string; event_year: number | null; title: string | null; state: unknown };
    baseline.set(r.event_id, {
      state: readState(r.state),
      year: r.event_year,
      title: r.title ?? "An event",
    });
  }

  const out: NetChange[] = [];
  const seen = new Set<string>();

  for (const row of events) {
    seen.add(row.id);
    const after = toState(row);
    const before = baseline.get(row.id)?.state ?? null;
    const line = describeChange(before, after);
    if (line) out.push({ eventId: row.id, eventYear: row.event_year, line, state: after, title: row.title });
  }

  // Rows deleted outright still owe the public a line if they were announced.
  for (const [eventId, entry] of baseline) {
    if (seen.has(eventId)) continue;
    const line = describeChange(entry.state, null);
    if (line) out.push({ eventId, eventYear: entry.year, line, state: null, title: entry.title });
  }

  return out;
}

async function currentStateFor(eventId: string): Promise<EventRow | null> {
  const { data } = await supabaseAdmin.from("events").select(EVENT_COLUMNS).eq("id", eventId).maybeSingle();
  return (data as unknown as EventRow | null) ?? null;
}

/** Records an event's current state as announced, without publishing anything.
 *  Two uses: after a bulletin goes out, and the organizer's "quiet correction"
 *  save, which is how a spelling fix stays out of the news without the software
 *  having to guess what a spelling fix looks like. */
export async function markEventAnnounced(eventId: string, newsId: string | null = null) {
  const row = await currentStateFor(eventId);
  if (!row) {
    await supabaseAdmin.from("event_announced_state").delete().eq("event_id", eventId);
    return;
  }
  await supabaseAdmin.from("event_announced_state").upsert(
    {
      event_id: eventId,
      event_year: row.event_year,
      title: row.title,
      state: toState(row) as never,
      announced_at: new Date().toISOString(),
      news_id: newsId,
    } as never,
    { onConflict: "event_id" },
  );
}

/** Whether this one event currently differs from what the public was told. */
export async function eventHasPendingChange(eventId: string): Promise<boolean> {
  const changes = await computeNetChanges();
  return changes.some((c) => c.eventId === eventId);
}
