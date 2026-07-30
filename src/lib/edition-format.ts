/** Pure, shared by client and server. No hardcoded year anywhere. */
export type EditionSummary = {
  event_year: number;
  title: string;
  starts_on: string;
  ends_on: string;
};

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

/** "Oct 2–4, 2026" or "Oct 30 – Nov 1, 2027". */
export function editionDateRange(edition: EditionSummary): string {
  const a = parts(edition.starts_on);
  const b = parts(edition.ends_on);
  if (a.m === b.m) return `${MONTHS[a.m - 1]} ${a.d}–${b.d}, ${b.y}`;
  return `${MONTHS[a.m - 1]} ${a.d} – ${MONTHS[b.m - 1]} ${b.d}, ${b.y}`;
}

export function editionEyebrow(edition: EditionSummary): string {
  return `Alumni Weekend · ${editionDateRange(edition)}`;
}

/** Date of a schedule day, day_number 1 being the first day of the edition. */
export function editionDay(edition: EditionSummary, dayNumber: number): Date {
  const a = parts(edition.starts_on);
  return new Date(Date.UTC(a.y, a.m - 1, a.d + (dayNumber - 1)));
}

export function dayLabel(date: Date): string {
  const wd = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"][date.getUTCDay()];
  return `${wd} ${MONTHS[date.getUTCMonth()].toUpperCase()} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;
}

export function dayName(date: Date): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][date.getUTCDay()];
}

/** Days-out figure that never goes negative and never reads "-3 DAYS OUT". */
export function countdown(
  current: EditionSummary,
  next: EditionSummary | null,
  now: number = Date.now(),
): { value: string; label: string } {
  const target = (e: EditionSummary) => {
    const a = parts(e.starts_on);
    return Date.UTC(a.y, a.m - 1, a.d);
  };
  const endOf = (e: EditionSummary) => {
    const b = parts(e.ends_on);
    return Date.UTC(b.y, b.m - 1, b.d) + 24 * 60 * 60 * 1000;
  };

  const days = Math.ceil((target(current) - now) / 86400000);
  if (days > 0) return { value: String(days), label: "Days out" };
  if (now < endOf(current)) return { value: "NOW", label: "Happening" };
  if (next) {
    const nd = Math.max(0, Math.ceil((target(next) - now) / 86400000));
    return { value: String(nd), label: `Days to ${next.event_year}` };
  }
  return { value: "—", label: "Next date TBD" };
}
