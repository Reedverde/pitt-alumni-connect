/**
 * The one timing rule, in one place, pure so it can be reasoned about and
 * tested on its own.
 *
 * Something scheduled for 9:00 launches in the 9:00 minute and in no other.
 * Seconds inside that minute and ordinary network latency are fine; the work
 * the launch starts may finish afterwards. What is not allowed is a later
 * launch: 9:15, 9:30 and 10:00 are separate decisions to send or post, and the
 * machine does not make them. Before the minute, nothing happens. After it, the
 * slot is recorded as missed and stays unsent.
 */

export type LaunchVerdict = "early" | "due" | "missed";

/** One minute. Not a grace period: the width of the minute itself. */
export const LAUNCH_MINUTE_MS = 60_000;

/** Compares two instants. `due` only while both fall in the same minute. */
export function launchVerdict(now: Date | string | number, scheduled: Date | string | number): LaunchVerdict {
  const n = toMs(now);
  const t = toMs(scheduled);
  if (!Number.isFinite(n) || !Number.isFinite(t)) return "early";
  const delta = n - t;
  if (delta < 0) return "early";
  if (delta < LAUNCH_MINUTE_MS) return "due";
  return "missed";
}

function toMs(value: Date | string | number): number {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  return Date.parse(value);
}

/** Local wall-clock hour and minute in a named timezone, as "HH:MM". Daylight
 *  saving is the calendar's problem, not ours. */
export function localHHMM(timezone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
  return `${get("hour")}:${get("minute")}`;
}
