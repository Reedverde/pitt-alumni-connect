import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";

import type { Database } from "@/integrations/supabase/types";

/** Multipart upload endpoint. XHR uses it so the panel can show real progress.
 *  Admin is proved by the caller's bearer token against is_admin(), never by
 *  the fact that the button was visible. */
export const Route = createFileRoute("/api/photos/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const auth = request.headers.get("authorization") ?? "";
        if (!auth.startsWith("Bearer ")) return new Response("Unauthorized", { status: 401 });
        const token = auth.slice(7);

        const supabase = createClient<Database>(
          process.env.SUPABASE_URL!,
          process.env.SUPABASE_PUBLISHABLE_KEY!,
          {
            global: { headers: { Authorization: `Bearer ${token}` } },
            auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
          },
        );

        const mod = await import("@/lib/photos.server");
        const actor = await mod.isAdminClient(supabase);
        if (!actor) return new Response("Forbidden", { status: 403 });

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File)) return Response.json({ ok: false, error: "No file." });
        if (file.size > mod.MAX_BYTES)
          return Response.json({ ok: false, error: "Larger than 10MB." });

        const bytes = new Uint8Array(await file.arrayBuffer());
        const num = (v: FormDataEntryValue | null) => {
          const n = Number(v);
          return Number.isFinite(n) && n > 0 ? Math.round(n) : null;
        };

        const result = await mod.storePhoto({
          actor: actor.personId,
          bytes,
          originalName: file.name || "photo",
          width: num(form.get("width")),
          height: num(form.get("height")),
          alt: null,
        });
        return Response.json(result);
      },
    },
  },
});
