import { createFileRoute } from "@tanstack/react-router";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { adminActor } from "@/lib/admin.server";
import { dispatchSequence } from "@/lib/drip.server";

export const Route = createFileRoute("/api/admin/drip-dry-run")({
  server: {
    middleware: [requireSupabaseAuth],
    handlers: {
      POST: async ({ request, context }) => {
        const actor = await adminActor(context.supabase);
        if (!actor) {
          return new Response(JSON.stringify({ error: "Forbidden" }), {
            status: 403,
            headers: { "content-type": "application/json" },
          });
        }

        let body: Record<string, unknown> = {};
        try {
          body = await request.json();
        } catch {
          return new Response(JSON.stringify({ error: "Invalid JSON body" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const sequenceKey = String(body.sequenceKey ?? "").trim();
        if (!sequenceKey) {
          return new Response(JSON.stringify({ error: "sequenceKey is required" }), {
            status: 400,
            headers: { "content-type": "application/json" },
          });
        }

        const rawLimit = Number(body.limit ?? 0);
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? rawLimit : undefined;

        const result = await dispatchSequence({
          sequenceKey,
          limit,
          anchorsFirst: Boolean(body.anchorsFirst),
          dryRun: true,
        });

        return Response.json(result);
      },
    },
  },
});
