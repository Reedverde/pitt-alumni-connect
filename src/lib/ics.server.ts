import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { editionDay, type EditionSummary } from "./edition-format";

export const SITE_URL = "https://alumni.pittultimate.org";
const TZ = "America/New_York";

export type CalendarEvent = {
  id: string;
  title: string;
  day_number: number | null;
  starts_at: string | null;
  ends_at: string | null;
  /** When the doors or the facility open, if that is earlier than the start. */
  doors_at: string | null;
  /** Plain-language timing an organizer typed, e.g. "After the Pitt game". */
  relative_timing: string | null;
  time_tbd: boolean;
  location: string | null;
  notes: string | null;
  division: string | null;
  sort_order: number;
  map_url: string | null;
  ticket_url: string | null;
  /** Planning state: tentative, confirmed, changed, cancelled. */
  status: string;
  /** Who the event is for. Codes; labels live in event-model.ts. */
  audience: string;
  timezone: string;
};

function publicClient() {
  const key = process.env.SUPABASE_PUBLISHABLE_KEY!;
  return createClient<Database>(process.env.SUPABASE_URL!, key, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** Events for a year, ordered the way the page reads them. */
export async function loadEvents(year: number, id?: string): Promise<CalendarEvent[]> {
  let query = publicClient()
    .from("events")
    .select(
      "id, title, day_number, starts_at, ends_at, doors_at, relative_timing, time_tbd, location, notes, division, sort_order, map_url, ticket_url, status, audience, timezone",
    )
    .eq("event_year", year)
    // Unpublished events are organizer drafts. The public reads, the calendar
    // feeds, and the emails all share this one gate.
    .eq("published", true)
    .order("day_number", { ascending: true })
    .order("sort_order", { ascending: true });
  if (id) query = query.eq("id", id);
  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as CalendarEvent[];
}

/** day_number 1 is the edition's first day, read from editions.starts_on. */
export function eventDate(edition: EditionSummary, dayNumber: number | null): Date {
  return editionDay(edition, dayNumber ?? 1);
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

function dateStamp(d: Date) {
  return `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}`;
}

function utcStamp(d: Date) {
  return `${dateStamp(d)}T${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;
}

function escapeText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

/** RFC 5545 caps a line at 75 octets; continuation lines start with a space. */
function fold(line: string) {
  if (line.length <= 74) return line;
  const out: string[] = [line.slice(0, 74)];
  let rest = line.slice(74);
  while (rest.length > 73) {
    out.push(` ${rest.slice(0, 73)}`);
    rest = rest.slice(73);
  }
  if (rest) out.push(` ${rest}`);
  return out.join("\r\n");
}

const TBD_NOTE =
  "The exact time for this one is not set yet. Watch the schedule page, and Discord on the day.";

export function buildIcs(events: CalendarEvent[], edition: EditionSummary): string {
  const year = edition.event_year;
  const stamp = utcStamp(new Date());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Pitt Club Ultimate Alumni//Alumni Weekend//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeText(`Pitt Club Ultimate Alumni Weekend ${year}`)}`,
    `X-WR-TIMEZONE:${TZ}`,
  ];

  for (const event of events) {
    // A cancelled event does not belong in anyone's calendar.
    if (event.status === "cancelled") continue;
    const doorsNote =
      event.doors_at && event.starts_at && event.doors_at < event.starts_at
        ? `Doors open at ${new Intl.DateTimeFormat("en-US", {
            timeZone: event.timezone || TZ,
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date(event.doors_at))}.`
        : "";
    const description = [
      event.notes ?? "",
      doorsNote,
      // Timing nobody has put a clock on yet, in the organizer's own words.
      event.time_tbd && event.relative_timing ? event.relative_timing : "",
      // Any event flagged time to be confirmed is written as an all-day entry
      // below, so it always needs the note explaining why. Keying this off
      // starts_at meant an event that still carried a provisional timestamp
      // landed in the calendar as a bare all-day block with no explanation.
      event.time_tbd && !event.relative_timing ? TBD_NOTE : "",
      SITE_URL,
    ]
      .filter(Boolean)
      .join("\n\n");

    lines.push("BEGIN:VEVENT");
    // Stable per-event UID: re-downloading updates the entry instead of duplicating it.
    lines.push(`UID:${event.id}@alumni.pittultimate.org`);
    lines.push(`DTSTAMP:${stamp}`);

    if (!event.time_tbd && event.starts_at) {
      const start = new Date(event.starts_at);
      const end = event.ends_at
        ? new Date(event.ends_at)
        : new Date(start.getTime() + 2 * 60 * 60 * 1000);
      lines.push(`DTSTART:${utcStamp(start)}`);
      lines.push(`DTEND:${utcStamp(end)}`);
    } else {
      // No invented times: a TBD event is an all-day entry on its correct date.
      const day = eventDate(edition, event.day_number);
      const next = new Date(day.getTime() + 24 * 60 * 60 * 1000);
      lines.push(`DTSTART;VALUE=DATE:${dateStamp(day)}`);
      lines.push(`DTEND;VALUE=DATE:${dateStamp(next)}`);
    }

    lines.push(`SUMMARY:${escapeText(event.title)}`);
    if (event.location) lines.push(`LOCATION:${escapeText(event.location)}`);
    lines.push(`DESCRIPTION:${escapeText(description)}`);
    lines.push(`URL:${SITE_URL}/schedule`);
    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return lines.map(fold).join("\r\n") + "\r\n";
}

export function icsFilename(year: number, event?: CalendarEvent) {
  const slug = event
    ? event.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")
    : "alumni-weekend";
  return `pitt-ultimate-${slug}-${year}.ics`;
}
