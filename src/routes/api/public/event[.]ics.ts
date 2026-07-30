import { createFileRoute } from "@tanstack/react-router";

/** A single event's .ics, by event id. The whole-weekend download stays at
 *  /api/public/calendar.ics. Titles and times always come from the database. */
export const Route = createFileRoute("/api/public/event.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadEvents, buildIcs, icsFilename } = await import("@/lib/ics.server");
        const { loadCurrentEdition, loadEdition } = await import("@/lib/editions.server");
        const url = new URL(request.url);
        const rawId = url.searchParams.get("id");
        const id = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : undefined;
        if (!id) return new Response("Not found", { status: 404 });

        const yearParam = Number(url.searchParams.get("year"));
        const edition =
          Number.isInteger(yearParam) && yearParam > 2000
            ? await loadEdition(yearParam)
            : await loadCurrentEdition();
        if (!edition || (!edition.is_current && !edition.published)) {
          return new Response("Not found", { status: 404 });
        }

        const events = await loadEvents(edition.event_year, id);
        const event = events[0];
        // No invented times: an event without a real start has no calendar entry.
        if (!event || event.time_tbd || !event.starts_at) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(buildIcs([event], edition), {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${icsFilename(edition.event_year, event)}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
