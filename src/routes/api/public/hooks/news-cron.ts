import { createFileRoute } from "@tanstack/react-router";

/**
 * The scheduled entry point. Called every fifteen minutes by pg_cron with the
 * job's private cron token in an x-cron-token header. Only the token's hash is
 * stored, in a table no signed in user can read. Runs nothing unless the local
 * clock says a digest or a roundup is due, and never twice for the same slot.
 */
export const Route = createFileRoute("/api/public/hooks/news-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const news = await import("@/lib/news.server");
        const presented =
          request.headers.get("x-cron-token") ?? request.headers.get("X-Cron-Token");
        if (!(await news.verifyCronToken(presented))) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const result = await news.runNewsAutomation();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
