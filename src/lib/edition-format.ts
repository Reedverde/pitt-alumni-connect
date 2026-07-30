/** Pure, shared by client and server. No hardcoded year anywhere. */
export type EditionSummary = {
  event_year: number;
  title: string;
  starts_on: string;
  ends_on: string;
  /** Absent means "assume published"; the loaders always set it. */
  published?: boolean;
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

/** Hero anchor: { range: "OCT 2 – 4", year: "2026" }. Never a hardcoded string. */
export function editionShortDates(edition: EditionSummary): { range: string; year: string } {
  const a = parts(edition.starts_on);
  const b = parts(edition.ends_on);
  const range =
    a.m === b.m
      ? `${MONTHS[a.m - 1].toUpperCase()} ${a.d} – ${b.d}`
      : `${MONTHS[a.m - 1].toUpperCase()} ${a.d} – ${MONTHS[b.m - 1].toUpperCase()} ${b.d}`;
  return { range, year: String(b.y) };
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

/** Today as YYYY-MM-DD in the timezone the weekend actually happens in. */
export function todayInNewYork(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" }).format(now);
}

export type SeasonPhase = "upcoming" | "in_progress" | "off_season";

export type Season = {
  phase: SeasonPhase;
  /** The edition the site is currently about. Null only in the off season. */
  edition: EditionSummary | null;
  /** 1-based day of the edition we are in, when in progress. */
  todayDayNumber: number | null;
  today: string;
};

const dayMs = 86400000;

function utc(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}

/** Which of the three states the site is in, driven entirely by the editions rows. */
export function resolveSeason(
  current: EditionSummary | null,
  next: EditionSummary | null,
  today: string = todayInNewYork(),
): Season {
  const live = (e: EditionSummary | null) =>
    e && e.published !== false && e.ends_on >= today ? e : null;
  const edition = live(current) ?? live(next);
  if (!edition) return { phase: "off_season", edition: null, todayDayNumber: null, today };
  if (today < edition.starts_on) return { phase: "upcoming", edition, todayDayNumber: null, today };
  return {
    phase: "in_progress",
    edition,
    todayDayNumber: Math.round((utc(today) - utc(edition.starts_on)) / dayMs) + 1,
    today,
  };
}

/** The year of the next first-October-weekend after today. Used for off-season copy. */
export function nextOctoberYear(today: string = todayInNewYork()): number {
  const [y, m] = today.split("-").map(Number);
  return m < 10 ? y : y + 1;
}

const LONG_MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** "October 2 to 4, 2026" — the phrasing the story page uses. */
export function editionLongRange(edition: EditionSummary): string {
  const [ay, am, ad] = edition.starts_on.split("-").map(Number);
  const [by, bm, bd] = edition.ends_on.split("-").map(Number);
  if (am === bm && ay === by) return `${LONG_MONTHS[am - 1]} ${ad} to ${bd}, ${by}`;
  return `${LONG_MONTHS[am - 1]} ${ad} to ${LONG_MONTHS[bm - 1]} ${bd}, ${by}`;
}
