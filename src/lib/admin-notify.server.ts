import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { emailParagraph, emailShell, escapeHtml, ROYAL, FONT_STACK, INK } from "./email-chrome";
import { sendPlainEmail } from "./mail.server";
import { globalMailAllowed, recordThrottleEvent } from "./throttle.server";

const DIGEST_KIND = "admin_pending_digest";
const DIGEST_WINDOW_MS = 60 * 60 * 1000;

const esc = escapeHtml;

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
export async function notifyAdminsOfPendingSuggestions(_origin?: string | null) {
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

    // Links in mail come from PUBLIC_SITE_URL and nowhere else.
    const { siteUrl } = await import("./mail.server");
    const base = siteUrl() ?? "";
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
    const html = emailShell(
      [
        emailParagraph(subject),
        `<ul style="margin:0 0 16px;padding-left:20px;font-family:${FONT_STACK};font-size:16px;line-height:1.55;color:${INK}">${names
          .map((n) => `<li>${esc(n)}</li>`)
          .join("")}</ul>`,
        rows.length > names.length ? emailParagraph(`and ${rows.length - names.length} more`) : "",
        `<p style="margin:0;font-family:${FONT_STACK};font-size:16px;line-height:1.55"><a href="${esc(
          link,
        )}" style="color:${ROYAL};text-decoration:underline">Review them</a></p>`,
      ].join("\n"),
      subject,
    );

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
