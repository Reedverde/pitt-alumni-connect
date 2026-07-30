import { createFileRoute } from "@tanstack/react-router";

/** Resend signs webhooks with Svix headers. Verified here before anything is
 *  written, because this endpoint can permanently suppress an address. */
async function verify(secret: string, id: string, ts: string, sig: string, body: string) {
  const raw = secret.startsWith("whsec_") ? secret.slice(6) : secret;
  const key = await crypto.subtle.importKey(
    "raw",
    Uint8Array.from(atob(raw), (c) => c.charCodeAt(0)),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${id}.${ts}.${body}`));
  const expected = btoa(String.fromCharCode(...new Uint8Array(mac)));
  return sig
    .split(" ")
    .map((part) => part.split(",")[1] ?? "")
    .some((candidate) => candidate.length === expected.length && candidate === expected);
}

const HARD: Record<string, string> = {
  "email.bounced": "hard_bounce",
  "email.complained": "complaint",
};

export const Route = createFileRoute("/api/public/resend-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RESEND_WEBHOOK_SECRET;
        const body = await request.text();

        if (!secret) {
          console.error("[mail] RESEND_WEBHOOK_SECRET is not set; refusing the delivery event.");
          return new Response("not configured", { status: 503 });
        }

        const id = request.headers.get("svix-id") ?? "";
        const ts = request.headers.get("svix-timestamp") ?? "";
        const sig = request.headers.get("svix-signature") ?? "";
        if (!id || !ts || !sig || !(await verify(secret, id, ts, sig, body))) {
          return new Response("invalid signature", { status: 401 });
        }

        const event = JSON.parse(body) as {
          type?: string;
          data?: { email_id?: string; to?: string[]; bounce?: { type?: string } };
        };
        const type = event.type ?? "";
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        const messageId = event.data?.email_id ?? null;
        const recipients = (event.data?.to ?? []).map((e) => e.toLowerCase());

        if (messageId) {
          await supabaseAdmin
            .from("sends")
            .update({
              status: type.replace("email.", ""),
              ...(type === "email.bounced" || type === "email.complained"
                ? { outcome: "failed" }
                : {}),
              ...(type === "email.delivered" ? { outcome: "sent" } : {}),
              ...(type === "email.bounced" ? { bounced: true } : {}),
              ...(type === "email.complained" ? { complained: true } : {}),
              ...(type === "email.bounced"
                ? { bounce_type: event.data?.bounce?.type ?? "hard" }
                : {}),
            } as never)
            .eq("provider_message_id", messageId);
        }

        // One hard bounce or one complaint suppresses permanently: these
        // addresses are twenty years old and a retry costs sender reputation.
        const reason = HARD[type];
        const soft = type === "email.bounced" && event.data?.bounce?.type === "Transient";
        if (reason && !soft) {
          for (const email of recipients) {
            await supabaseAdmin
              .from("suppressions")
              .upsert({ email, reason }, { onConflict: "email" });
          }
        } else if (soft) {
          // Three soft bounces is a dead address wearing a temporary excuse.
          for (const email of recipients) {
            const { count } = await supabaseAdmin
              .from("sends")
              .select("id", { count: "exact", head: true })
              .eq("to_email", email)
              .eq("bounced", true)
              .eq("bounce_type", "Transient");
            if ((count ?? 0) >= 3) {
              await supabaseAdmin
                .from("suppressions")
                .upsert({ email, reason: "soft_bounce" }, { onConflict: "email" });
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});