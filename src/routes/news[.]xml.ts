import { createFileRoute } from "@tanstack/react-router";

/** RSS 2.0 for MonitorRSS. Published items only, straight from the database. */
export const Route = createFileRoute("/news.xml")({
  server: {
    handlers: {
      GET: async () => {
        const { listPublished, buildRss } = await import("@/lib/news.server");
        const items = await listPublished(50);
        return new Response(buildRss(items), {
          headers: {
            "content-type": "application/rss+xml; charset=utf-8",
            "cache-control": "public, max-age=300",
          },
        });
      },
    },
  },
});
