/**
 * One vocabulary for when an event happens. Three cases, in priority order:
 *
 *  1. A real clock time (with an optional separate doors/open time).
 *  2. No clock time, but a plain-language anchor the organizers trust,
 *     e.g. "After the Pitt game". Never invented, always typed by a person.
 *  3. Genuinely unknown.
 *
 * Shared by the public Schedule, the calendar export, the emails and the news
 * bulletin so a time can never read one way in one place and another elsewhere.
 */

export type TimingShape = {
  starts_at?: string | null;
  ends_at?: string | null;
  doors_at?: string | null;
  relative_timing?: string | null;
  time_tbd?: boolean | null;
  timezone?: string | null;
};

const DEFAULT_TZ = "America/New_York";

export function formatClock(iso: string, tz = DEFAULT_TZ): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(iso));
}

function tzOf(e: TimingShape) {
  return e.timezone || DEFAULT_TZ;
}

export function hasClockTime(e: TimingShape): boolean {
  return !e.time_tbd && Boolean(e.starts_at);
}

/** The short headline time on a card: a clock time, an organizer's relative
 *  anchor, or TBD. Never guesses an hour from a relative anchor. */
export function eventTimeLabel(e: TimingShape): string {
  if (hasClockTime(e)) return formatClock(e.starts_at!, tzOf(e));
  const relative = e.relative_timing?.trim();
  if (relative) return relative;
  return "TBD";
}

/** "10:00 AM – 12:00 PM" when both ends are known, else the start alone. */
export function eventTimeRangeLabel(e: TimingShape): string {
  if (!hasClockTime(e)) return eventTimeLabel(e);
  const start = formatClock(e.starts_at!, tzOf(e));
  if (!e.ends_at) return start;
  return `${start} – ${formatClock(e.ends_at, tzOf(e))}`;
}

/** "Doors 9:00 AM" when doors are earlier than the event itself. */
export function eventDoorsLabel(e: TimingShape): string | null {
  if (!e.doors_at) return null;
  if (e.starts_at && Date.parse(e.doors_at) >= Date.parse(e.starts_at)) return null;
  return `Doors ${formatClock(e.doors_at, tzOf(e))}`;
}

/** True when the time is genuinely unknown, as opposed to relative. */
export function timeIsUnknown(e: TimingShape): boolean {
  return !hasClockTime(e) && !e.relative_timing?.trim();
}

/** Mid-sentence the label starts lower case, but 9:00 AM keeps its case. */
function lowerLead(label: string) {
  return label.charAt(0).toLowerCase() + label.slice(1);
}

/** One sentence for emails and bulletins: "10:00 AM to 12:00 PM, doors 9:00 AM". */
export function timingSentence(e: TimingShape): string {
  const doors = eventDoorsLabel(e);
  if (!hasClockTime(e)) {
    const relative = e.relative_timing?.trim();
    const base = relative || "Time still to be set";
    return doors ? `${base}, ${lowerLead(doors)}` : base;
  }
  const start = formatClock(e.starts_at!, tzOf(e));
  const range = e.ends_at ? `${start} to ${formatClock(e.ends_at, tzOf(e))}` : start;
  return doors ? `${range}, ${lowerLead(doors)}` : range;
}
