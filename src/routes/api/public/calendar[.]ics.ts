import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/calendar.ics")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { loadEvents, buildIcs, icsFilename } = await import("@/lib/ics.server");
        const url = new URL(request.url);
        const yearParam = Number(url.searchParams.get("year"));
        const year = Number.isInteger(yearParam) && yearParam > 2000 ? yearParam : 2026;
        const rawId = url.searchParams.get("event");
        const id = rawId && /^[0-9a-f-]{36}$/i.test(rawId) ? rawId : undefined;

        const events = await loadEvents(year, id);
        if (events.length === 0) return new Response("Not found", { status: 404 });

        return new Response(buildIcs(events, year), {
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
