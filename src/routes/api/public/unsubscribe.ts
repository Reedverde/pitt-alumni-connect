import { createFileRoute } from "@tanstack/react-router";

/** One-click unsubscribe target named in the List-Unsubscribe header. The
 *  token is an HMAC of the address, so nobody can suppress a stranger. */
async function handle(request: Request) {
  const url = new URL(request.url);
  const email = (url.searchParams.get("e") ?? "").trim().toLowerCase();
  const token = url.searchParams.get("t") ?? "";

  const { unsubscribeTokenValid } = await import("@/lib/mail.server");
  if (!email || !unsubscribeTokenValid(email, token)) {
    return new Response("Invalid unsubscribe link.", { status: 400 });
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  await supabaseAdmin
    .from("suppressions")
    .upsert({ email, reason: "unsubscribed" }, { onConflict: "email" });

  return new Response("You are unsubscribed. We will not email this address again.", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export const Route = createFileRoute("/api/public/unsubscribe")({
  server: {
    handlers: {
      GET: ({ request }) => handle(request),
      POST: ({ request }) => handle(request),
    },
  },
});