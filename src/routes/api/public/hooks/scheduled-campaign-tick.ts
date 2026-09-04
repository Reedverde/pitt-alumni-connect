import { createFileRoute } from "@tanstack/react-router";

/**
 * One-time scheduled campaign tick. Called by pg_cron with the shared secret in
 * an x-drip-cron-secret header. Any unauthenticated write that can trigger
 * email is an open relay, so a missing or wrong secret gets a flat 401.
 */
export const Route = createFileRoute("/api/public/hooks/scheduled-campaign-tick")({
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
        // ?dry=1 previews every pending one-time campaign and writes nothing.
        const dry = new URL(request.url).searchParams.get("dry") === "1";
        const mod = await import("@/lib/scheduled-campaign.server");
        const result = dry ? await mod.previewScheduledCampaigns() : await mod.runScheduledCampaignTick();
        return new Response(JSON.stringify(result), {
          headers: { "content-type": "application/json" },
        });
      },
    },
  },
});
