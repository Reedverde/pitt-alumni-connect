/**
 * The one vocabulary for an Alumni Weekend event. The database stores codes;
 * every screen reads these labels. Shared by the admin editor, the schedule
 * cards, and the tallies so a status never means two different things.
 */

export const EVENT_STATUSES = ["tentative", "confirmed", "changed", "cancelled"] as const;
export type EventStatus = (typeof EVENT_STATUSES)[number];

export const EVENT_STATUS_LABELS: Record<EventStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  changed: "Changed",
  cancelled: "Cancelled",
};

export const EVENT_AUDIENCES = [
  "everyone",
  "alumni",
  "current_players",
  "families",
  "spectators",
  "adults",
  "division",
] as const;
export type EventAudience = (typeof EVENT_AUDIENCES)[number];

export const EVENT_AUDIENCE_LABELS: Record<EventAudience, string> = {
  everyone: "Everyone",
  alumni: "Alumni",
  current_players: "Current players",
  families: "Families and kids",
  spectators: "Spectators",
  adults: "Adults only",
  division: "One program only",
};

export function statusLabel(value: string | null | undefined): string {
  return EVENT_STATUS_LABELS[(value ?? "tentative") as EventStatus] ?? "Tentative";
}

export function audienceLabel(value: string | null | undefined, division?: string | null): string {
  const key = (value ?? "everyone") as EventAudience;
  if (key === "division") return division ? `${division} only` : EVENT_AUDIENCE_LABELS.division;
  return EVENT_AUDIENCE_LABELS[key] ?? EVENT_AUDIENCE_LABELS.everyone;
}

export type EventShape = {
  title?: string | null;
  status?: string | null;
  time_tbd?: boolean | null;
  starts_at?: string | null;
  ends_at?: string | null;
  published?: boolean | null;
  is_placeholder?: boolean | null;
  prompt_rsvp?: boolean | null;
  capacity?: number | null;
  critical_mass?: number | null;
  audience?: string | null;
  division?: string | null;
};

/** Combinations an organizer almost never means. Blocking ones come back from
 *  the server as errors; these are the softer ones worth saying out loud. */
export function eventWarnings(event: EventShape, headsSoFar?: number | null): string[] {
  const out: string[] = [];
  if (event.published && event.prompt_rsvp === false)
    out.push("Published but not asking for an RSVP. Everything on the schedule normally asks.");
  if (event.status === "confirmed" && (event.time_tbd || !event.starts_at))
    out.push("Marked confirmed with no start time.");
  if (event.status === "confirmed" && event.is_placeholder)
    out.push("Marked confirmed while still flagged a placeholder.");
  if (
    typeof event.capacity === "number" &&
    typeof headsSoFar === "number" &&
    headsSoFar > event.capacity
  )
    out.push(`Capacity ${event.capacity} is below the ${headsSoFar} heads already expected.`);
  if (
    typeof event.capacity === "number" &&
    typeof event.critical_mass === "number" &&
    event.critical_mass > event.capacity
  )
    out.push("The critical mass target is higher than the capacity.");
  if (event.audience === "division" && !event.division)
    out.push("Set to one program only, but no program is chosen.");
  if (event.status === "cancelled" && event.published)
    out.push("Cancelled and still published. People will see it marked cancelled.");
  return out;
}

/** Hard rules. The server refuses these outright. */
export function eventBlockers(event: EventShape, headsSoFar?: number | null): string[] {
  const out: string[] = [];
  if (event.status === "confirmed" && (event.time_tbd || !event.starts_at))
    out.push("A confirmed event needs a start time. Leave it tentative until the time is set.");
  if (
    typeof event.capacity === "number" &&
    typeof headsSoFar === "number" &&
    headsSoFar > event.capacity
  )
    out.push(
      `Capacity ${event.capacity} is below the ${headsSoFar} heads already saying yes. Raise the capacity or clear it.`,
    );
  if (event.starts_at && event.ends_at && event.ends_at <= event.starts_at)
    out.push("The end time is before the start time.");
  return out;
}
