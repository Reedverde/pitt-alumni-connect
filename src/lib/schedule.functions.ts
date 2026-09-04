import { createServerFn } from "@tanstack/react-start";

import type { EditionSummary } from "./edition-format";

export type ScheduleEvent = {
  id: string;
  title: string;
  day_number: number | null;
  starts_at: string | null;
  ends_at: string | null;
  time_tbd: boolean;
  location: string | null;
  notes: string | null;
  division: string | null;
  sort_order: number;
  /** Optional directions link for the event's physical location. */
  map_url: string | null;
  /** Optional ticket link for the event. */
  ticket_url: string | null;
  /** Planning state: tentative, confirmed, changed, cancelled. */
  status: string;
  /** Who the event is for. Labels live in event-model.ts. */
  audience: string;
  timezone: string;
};

export type ScheduleData = {
  edition: EditionSummary;
  events: ScheduleEvent[];
};

/** Public read. A time change is a database update, never a deploy.
 *  With no year, the current edition. With a year, that published edition. */
export const getSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: { eventYear?: number } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<ScheduleData | null> => {
    const { loadEvents } = await import("@/lib/ics.server");
    const { loadCurrentEdition, loadEdition } = await import("@/lib/editions.server");

    const edition = data.eventYear ? await loadEdition(data.eventYear) : await loadCurrentEdition();
    // An unpublished or unknown weekend is a normal answer, not a failure.
    // Returning null lets the page explain itself with a normal response
    // instead of surfacing a server error.
    if (!edition || (!edition.is_current && !edition.published)) return null;

    const events = await loadEvents(edition.event_year);
    return {
      edition: {
        event_year: edition.event_year,
        title: edition.title,
        starts_on: edition.starts_on,
        ends_on: edition.ends_on,
        lodging_note: edition.lodging_note,
        travel_note: edition.travel_note,
      },
      events,
    };
  });

export type WeekendPageData = {
  /** The edition the page is about, or null in the off season. */
  edition: EditionSummary | null;
  events: ScheduleEvent[];
  /** Every published edition with its going count, for the archive list. */
  archive: (EditionSummary & { going: number })[];
};

/** /schedule is a permanent URL. It resolves its own state and never 404s or empties. */
export const getWeekendPage = createServerFn({ method: "GET" }).handler(
  async (): Promise<WeekendPageData> => {
    const { loadEvents } = await import("@/lib/ics.server");
    const { loadCurrentEdition, loadNextPublishedEdition, loadEditions, goingCounts } = await import(
      "@/lib/editions.server"
    );
    const { resolveSeason } = await import("./edition-format");

    const current = await loadCurrentEdition();
    const next = await loadNextPublishedEdition(current.event_year);
    const season = resolveSeason(current, next);

    const [editions, counts] = await Promise.all([loadEditions(), goingCounts()]);
    const archive = editions
      .filter((e) => e.published && e.event_year !== season.edition?.event_year)
      .map((e) => ({
        event_year: e.event_year,
        title: e.title,
        starts_on: e.starts_on,
        ends_on: e.ends_on,
        published: true,
        going: counts.get(e.event_year) ?? 0,
      }));

    const events = season.edition ? await loadEvents(season.edition.event_year) : [];
    return { edition: season.edition, events, archive };
  },
);
