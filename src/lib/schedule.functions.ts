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
};

export type ScheduleData = {
  edition: EditionSummary;
  events: ScheduleEvent[];
};

/** Public read. A time change is a database update, never a deploy.
 *  With no year, the current edition. With a year, that published edition. */
export const getSchedule = createServerFn({ method: "GET" })
  .inputValidator((input: { eventYear?: number } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<ScheduleData> => {
    const { loadEvents } = await import("@/lib/ics.server");
    const { loadCurrentEdition, loadEdition } = await import("@/lib/editions.server");

    const edition = data.eventYear ? await loadEdition(data.eventYear) : await loadCurrentEdition();
    if (!edition || (!edition.is_current && !edition.published)) {
      throw new Error("That weekend isn't published.");
    }

    const events = await loadEvents(edition.event_year);
    return {
      edition: {
        event_year: edition.event_year,
        title: edition.title,
        starts_on: edition.starts_on,
        ends_on: edition.ends_on,
      },
      events,
    };
  });
