import { createFileRoute } from "@tanstack/react-router";

/**
 * Daily drip tick. Called by pg_cron with the shared secret in an
 * x-drip-cron-secret header. Any unauthenticated write that can trigger email
 * is an open relay, so a missing or wrong secret gets a flat 401.
 */
export const Route = createFileRoute("/api/public/hooks/drip-cron-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const expected = process.env["DRIP_CRON_SECRET"];
        const presented =
          request.headers.get("x-drip-cron-secret") ?? request.headers.get("X-Drip-Cron-Secret");
        if (!expected || !presented || presented !== expected) {
          return new Response(JSON.stringify({ error: "Unauthorized" }), {
            status: 401,
            headers: { "content-type": "application/json" },
          });
        }
        const { runDripCronTick } = await import("@/lib/drip-cron.server");
        const result = await runDripCronTick();
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
