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

        const softBounce = type === "email.bounced" && event.data?.bounce?.type === "Transient";
        const hardBounce = type === "email.bounced" && !softBounce;

        // The send row is matched by the Resend message id, stored at send time.
        type SendRow = { id: string; to_email: string | null; soft_bounce_count: number };
        let sendRow: SendRow | null = null;
        if (messageId) {
          const { data } = await supabaseAdmin
            .from("sends")
            .select("id, to_email, soft_bounce_count")
            .eq("provider_message_id", messageId)
            .maybeSingle();
          sendRow = (data as unknown as SendRow | null) ?? null;

          await supabaseAdmin
            .from("sends")
            .update({
              status: type.replace("email.", ""),
              ...(hardBounce || type === "email.complained" ? { outcome: "failed" } : {}),
              ...(type === "email.delivered"
                ? { outcome: "sent", delivered_at: new Date().toISOString() }
                : {}),
              ...(type === "email.bounced"
                ? { bounced: true, bounce_type: event.data?.bounce?.type ?? "hard" }
                : {}),
              ...(softBounce
                ? { soft_bounce_count: (sendRow?.soft_bounce_count ?? 0) + 1 }
                : {}),
              ...(type === "email.complained" ? { complained: true } : {}),
            } as never)
            .eq("provider_message_id", messageId);
        }

        const targets = recipients.length
          ? recipients
          : sendRow?.to_email
            ? [sendRow.to_email.toLowerCase()]
            : [];

        // One hard bounce or one complaint suppresses permanently: these
        // addresses are twenty years old and a retry costs sender reputation.
        const reason = hardBounce ? "hard_bounce" : type === "email.complained" ? "complaint" : null;
        if (reason) {
          for (const email of targets) {
            await supabaseAdmin
              .from("suppressions")
              .upsert({ email, reason }, { onConflict: "email" });
          }
        } else if (softBounce) {
          // Three soft bounces is a dead address wearing a temporary excuse.
          for (const email of targets) {
            const { data: soft } = await supabaseAdmin
              .from("sends")
              .select("soft_bounce_count")
              .eq("to_email", email)
              .limit(5000);
            const total = (soft ?? []).reduce(
              (sum, row) => sum + Number((row as { soft_bounce_count: number }).soft_bounce_count ?? 0),
              0,
            );
            if (total >= 3) {
              await supabaseAdmin
                .from("suppressions")
                .upsert({ email, reason: "soft_bounce_x3" }, { onConflict: "email" });
            }
          }
        }

        return new Response("ok");
      },
    },
  },
});