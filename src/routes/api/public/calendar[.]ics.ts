import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/calendar.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadEvents, buildIcs, icsFilename } = await import("@/lib/ics.server");
        const { loadCurrentEdition, loadEdition } = await import("@/lib/editions.server");
        const url = new URL(request.url);
        const yearParam = Number(url.searchParams.get("year"));

        // No literal year anywhere: the default is whatever edition is current.
        const edition =
          Number.isInteger(yearParam) && yearParam > 2000
            ? await loadEdition(yearParam)
            : await loadCurrentEdition();
        if (!edition || (!edition.is_current && !edition.published)) {
          return new Response("Not found", { status: 404 });
        }
        const year = edition.event_year;
        const rawId = url.searchParams.get("event");
        const id = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : undefined;

        const events = await loadEvents(year, id);
        if (events.length === 0) return new Response("Not found", { status: 404 });

        return new Response(buildIcs(events, edition), {
          headers: {
            "content-type": "text/calendar; charset=utf-8",
            "content-disposition": `attachment; filename="${icsFilename(year, id ? events[0] : undefined)}"`,
            "cache-control": "no-store",
          },
        });
      },
    },
  },
});
