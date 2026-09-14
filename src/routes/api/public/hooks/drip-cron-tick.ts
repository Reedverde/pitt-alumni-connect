import { createFileRoute } from "@tanstack/react-router";

/**
 * Retired. The daily drip no longer exists as a pathway: the production cron
 * job is switched off and this hook fails closed. It stays mounted only so an
 * accidental call gets a clear, harmless answer instead of reaching a
 * dispatcher. It never imports one, so it cannot send under any circumstances.
 */
export const Route = createFileRoute("/api/public/hooks/drip-cron-tick")({
  server: {
    handlers: {
      POST: async () =>
        new Response(
          JSON.stringify({
            ok: false,
            retired: true,
            sent: 0,
            reason:
              "the daily drip is retired; only an approved dated campaign or a person-initiated sign-in link may send",
          }),
          { status: 410, headers: { "content-type": "application/json" } },
        ),
    },
  },
});
