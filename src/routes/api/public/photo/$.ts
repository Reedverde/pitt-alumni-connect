import { createFileRoute } from "@tanstack/react-router";

/** Streams a photo out of the private bucket. Public read without a signed
 *  URL, and the path is always the stored uuid filename. */
export const Route = createFileRoute("/api/public/photo/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const raw = (params as { _splat?: string })._splat ?? "";
        if (!/^[0-9a-f-]{36}\.(jpg|png|webp)$/i.test(raw))
          return new Response("Not found", { status: 404 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("photos").download(raw);
        if (error || !data) return new Response("Not found", { status: 404 });

        return new Response(await data.arrayBuffer(), {
          headers: {
            "content-type": data.type || "application/octet-stream",
            "cache-control": "public, max-age=31536000, immutable",
          },
        });
      },
    },
  },
});
