import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { sendPlainEmail } from "./mail.server";
import { globalMailAllowed, recordThrottleEvent } from "./throttle.server";

const DIGEST_KIND = "admin_pending_digest";
const DIGEST_WINDOW_MS = 60 * 60 * 1000;

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function nameFromPayload(payload: unknown) {
  const p = (payload ?? {}) as Record<string, unknown>;
  const parts = [p.first_name, p.last_name].filter((v) => typeof v === "string" && v.trim());
  const name = parts.join(" ").trim();
  return name || "Unnamed request";
}

async function adminAddresses() {
  const { data: admins } = await supabaseAdmin.from("admins").select("person_id");
  const ids = (admins ?? []).map((a) => a.person_id as string);
  if (ids.length === 0) return [] as { personId: string; email: string }[];

  const { data: identities } = await supabaseAdmin
    .from("identities")
    .select("person_id, email, is_primary")
    .in("person_id", ids)
    .eq("is_primary", true);

  return (identities ?? [])
    .filter((row) => typeof row.email === "string" && row.email.includes("@"))
    .map((row) => ({ personId: row.person_id as string, email: (row.email as string).toLowerCase() }));
}

/** One digest an hour at most, to every admin who has an address on file.
 *  Never throws: a failed notice must not fail the requester's submission. */
export async function notifyAdminsOfPendingSuggestions(origin?: string | null) {
  try {
    const since = new Date(Date.now() - DIGEST_WINDOW_MS).toISOString();
    const { count: recentDigests } = await supabaseAdmin
      .from("sends")
      .select("id", { count: "exact", head: true })
      .eq("kind", DIGEST_KIND)
      .gte("created_at", since);
    if ((recentDigests ?? 0) > 0) return;

    if (!(await globalMailAllowed())) return;

    const { data: pending } = await supabaseAdmin
      .from("suggestions")
      .select("payload, created_at")
      .eq("status", "pending")
      .order("created_at", { ascending: false })
      .limit(200);

    const rows = pending ?? [];
    if (rows.length === 0) return;

    const recipients = await adminAddresses();
    if (recipients.length === 0) return;

    const base =
      (typeof origin === "string" && /^https?:\/\/[^\s/]+$/.test(origin) ? origin : null) ??
      process.env.PUBLIC_SITE_URL?.trim() ??
      "";
    const link = `${base}/admin`;

    const names = rows.slice(0, 40).map((r) => nameFromPayload(r.payload));
    const subject = `Pitt Club Ultimate: ${rows.length} name${rows.length === 1 ? "" : "s"} waiting for review`;
    const text = [
      subject,
      "",
      ...names.map((n) => `- ${n}`),
      ...(rows.length > names.length ? [`and ${rows.length - names.length} more`] : []),
      "",
      `Review them: ${link}`,
    ].join("\n");
    const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0B0B0C">
<p style="margin:0 0 16px">${esc(subject)}</p>
<ul style="margin:0 0 16px;padding-left:20px">${names.map((n) => `<li>${esc(n)}</li>`).join("")}</ul>
${rows.length > names.length ? `<p style="margin:0 0 16px">and ${rows.length - names.length} more</p>` : ""}
<p style="margin:0"><a href="${esc(link)}" style="color:#003594;font-weight:bold">Review them</a></p>
</body></html>`;

    for (const recipient of recipients) {
      await sendPlainEmail({
        to: recipient.email,
        personId: recipient.personId,
        kind: DIGEST_KIND,
        subject,
        text,
        html,
      });
      await recordThrottleEvent("rsvp_global", "all");
    }
  } catch (err) {
    console.error(
      `[admin-notify] digest failed: ${err instanceof Error ? err.message : "unknown error"}`,
    );
  }
}
