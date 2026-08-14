import { createFileRoute } from "@tanstack/react-router";

/**
 * The scheduled entry point. Called every fifteen minutes by pg_cron with the
 * project's publishable key in an apikey header. Runs nothing unless the local
 * clock says a digest or a roundup is due, and never twice for the same slot.
 */
export const Route = createFileRoute("/api/public/hooks/news-cron")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const key = request.headers.get("apikey") ?? "";
        const expected = process.env["SUPABASE_PUBLISHABLE_KEY"] ?? "";
        if (!expected || key !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { runNewsAutomation } = await import("@/lib/news.server");
        const result = await runNewsAutomation();
        return new Response(JSON.stringify({ ok: true, ...result }), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
