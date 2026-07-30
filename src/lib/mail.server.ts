import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCurrentEdition } from "./editions.server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Sender identity is configuration, never code. The domain moves when the
 *  project's own domain is delegated: that is a secret change, not a deploy. */
function mailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim() || null;
  const fromAddress = process.env.MAIL_FROM_ADDRESS?.trim() || null;
  const fromName = process.env.MAIL_FROM_NAME?.trim() || "Pitt Club Ultimate";
  const replyTo = process.env.MAIL_REPLY_TO?.trim() || null;
  return { apiKey, fromAddress, fromName, replyTo };
}

export function unsubscribeToken(email: string) {
  const secret = process.env.MAIL_UNSUBSCRIBE_SECRET ?? "";
  return createHmac("sha256", secret).update(email.trim().toLowerCase()).digest("hex");
}

export function unsubscribeTokenValid(email: string, token: string) {
  const expected = Buffer.from(unsubscribeToken(email));
  const got = Buffer.from(String(token ?? ""));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Every URL that appears in an email is built from this and nothing else.
 *  Not the request host, not a preview host, not a literal in the code. When
 *  the site moves to its permanent address that is a secret change. */
export function siteUrl(): string | null {
  const raw = process.env.PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (raw && /^https?:\/\/[^\s/]+$/.test(raw)) return raw;
  return null;
}

function fromDomain(address: string | null) {
  const at = address?.lastIndexOf("@") ?? -1;
  return at > -1 && address ? address.slice(at + 1).toLowerCase() : null;
}

type DomainCheck = { ok: boolean; domain: string | null; detail: string };

let domainCache: { at: number; value: DomainCheck } | null = null;

/** Asks Resend which domains are verified and compares that to the domain in
 *  the from address. Sending from an unverified domain lands in spam quietly,
 *  so we would rather refuse and say why. */
export async function checkSendingDomain(force = false): Promise<DomainCheck> {
  const { apiKey, fromAddress } = mailConfig();
  const domain = fromDomain(fromAddress);
  if (!apiKey) return { ok: false, domain, detail: "RESEND_API_KEY is not set." };
  if (!domain) return { ok: false, domain: null, detail: "MAIL_FROM_ADDRESS is not set." };

  if (!force && domainCache && Date.now() - domainCache.at < 5 * 60 * 1000) {
    return domainCache.value;
  }

  let value: DomainCheck;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = (await res.json().catch(() => null)) as
      | { data?: { name?: string; status?: string }[]; message?: string }
      | null;
    if (!res.ok) {
      value = {
        ok: false,
        domain,
        detail: `Resend refused the domain list [${res.status}]: ${payload?.message ?? "unknown error"}`,
      };
    } else {
      const list = payload?.data ?? [];
      const match = list.find((d) => (d.name ?? "").toLowerCase() === domain);
      if (!match) {
        value = {
          ok: false,
          domain,
          detail: `${domain} is not a domain on this Resend account. Verified: ${
            list.map((d) => d.name).filter(Boolean).join(", ") || "none"
          }.`,
        };
      } else if ((match.status ?? "").toLowerCase() !== "verified") {
        value = { ok: false, domain, detail: `${domain} reads ${match.status ?? "unknown"} in Resend, not verified.` };
      } else {
        value = { ok: true, domain, detail: `${domain} verifies in Resend.` };
      }
    }
  } catch (err) {
    value = {
      ok: false,
      domain,
      detail: `Could not reach Resend: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }

  domainCache = { at: Date.now(), value };
  return value;
}

/** One line an organizer can read without opening a settings screen. */
export async function mailStatus() {
  const { apiKey, fromAddress, fromName, replyTo } = mailConfig();
  const check = await checkSendingDomain(true);
  return {
    fromAddress,
    fromName,
    replyTo,
    siteUrl: siteUrl(),
    hasApiKey: Boolean(apiKey),
    domain: check.domain,
    verified: check.ok,
    detail: check.detail,
  };
}

function unsubscribeHeaders(to: string) {
  const base = siteUrl();
  if (!base) return {} as Record<string, string>;
  const url = `${base}/api/public/unsubscribe?e=${encodeURIComponent(to)}&t=${unsubscribeToken(to)}`;
  return {
    "List-Unsubscribe": `<${url}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  } as Record<string, string>;
}

export async function isSuppressed(email: string) {
  const { data } = await supabaseAdmin
    .from("suppressions")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

type LogInput = {
  personId: string | null;
  kind: string;
  toEmail: string;
  provider: string;
  providerMessageId: string | null;
  status: string;
  error: string | null;
};

/** Every outbound message lands here, delivered or not, so a failure shows up
 *  on a screen instead of in a log nobody reads. */
export async function logSend(input: LogInput) {
  await supabaseAdmin.from("sends").insert({
    person_id: input.personId,
    sequence_id: null,
    kind: input.kind,
    to_email: input.toEmail,
    provider: input.provider,
    provider_message_id: input.providerMessageId,
    status: input.status,
    error: input.error,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  } as never);
}

/** Asks the auth admin API for a one-time sign-in link so we can carry it in
 *  our own message. The service role key stays on the server. */
async function generateMagicLink(email: string, origin: string | null): Promise<string | null> {
  const url = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) return null;

  const body: Record<string, unknown> = { type: "magiclink", email };
  if (origin) body.redirect_to = `${origin}/auth`;

  const attempt = async (payload: Record<string, unknown>) => {
    const res = await fetch(`${url}/auth/v1/admin/generate_link`, {
      method: "POST",
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, json };
  };

  let out = await attempt(body);
  // A first-time address has no auth user yet: signup issues the same one-time link.
  if (!out.ok) out = await attempt({ ...body, type: "signup", password: crypto.randomUUID() });
  if (!out.ok || !out.json) return null;

  const props = (out.json.properties ?? out.json) as Record<string, unknown>;
  const link = (props.action_link ?? out.json.action_link) as string | undefined;
  return typeof link === "string" ? link : null;
}

const STATUS_LINE: Record<string, string> = {
  going: "You said you are going.",
  maybe: "You said maybe.",
  not_this_year: "You said not this year.",
};

function formatRange(startsOn: string, endsOn: string) {
  const start = new Date(`${startsOn}T12:00:00Z`);
  const end = new Date(`${endsOn}T12:00:00Z`);
  const month = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
  if (start.getUTCMonth() === end.getUTCMonth()) {
    return `${month(start)} ${start.getUTCDate()}–${end.getUTCDate()}, ${end.getUTCFullYear()}`;
  }
  return `${month(start)} ${start.getUTCDate()} – ${month(end)} ${end.getUTCDate()}, ${end.getUTCFullYear()}`;
}

function buildBody(opts: { name: string; statusLine: string; link: string; dates: string }) {
  const text = [
    `${opts.name},`,
    "",
    opts.statusLine,
    "",
    `Confirm and see the board: ${opts.link}`,
    "",
    "This link signs you in. No password.",
    ...(opts.dates ? ["", opts.dates] : []),
  ].join("\n");

  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#ffffff;font-family:Helvetica,Arial,sans-serif;font-size:16px;line-height:1.5;color:#0B0B0C">
<p style="margin:0 0 16px">${esc(opts.name)},</p>
<p style="margin:0 0 16px">${esc(opts.statusLine)}</p>
<p style="margin:0 0 16px"><a href="${esc(opts.link)}" style="color:#003594;font-weight:bold">Confirm and see the board</a></p>
<p style="margin:0 0 16px">This link signs you in. No password.</p>
${opts.dates ? `<p style="margin:0">${esc(opts.dates)}</p>` : ""}
</body></html>`;

  return { text, html };
}

export type MagicLinkResult = {
  sent: boolean;
  provider: string;
  messageId: string | null;
  reason: string | null;
};

/** Sends the sign-in link. Never throws: the RSVP record is already saved and
 *  must not depend on the mail succeeding. */
export async function sendMagicLinkEmail(opts: {
  to: string;
  personId: string | null;
  firstName: string | null;
  status: string;
  /** Accepted for call-site compatibility and deliberately ignored: every
   *  link is built from PUBLIC_SITE_URL. */
  origin?: string | null | undefined;
  kind?: string;
}): Promise<MagicLinkResult> {
  const to = opts.to.trim().toLowerCase();
  const { apiKey, fromAddress, fromName, replyTo } = mailConfig();
  const kind = opts.kind ?? "magic_link";

  try {
    if (await isSuppressed(to)) {
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "suppressed",
        error: "address is suppressed",
      });
      return { sent: false, provider: "none", messageId: null, reason: "suppressed" };
    }

    if (!apiKey || !fromAddress) {
      const missing = [!apiKey && "RESEND_API_KEY", !fromAddress && "MAIL_FROM_ADDRESS"]
        .filter(Boolean)
        .join(", ");
      console.warn(
        `[mail] ${missing} not set — falling back to the built-in mailer, which is capped at a few messages an hour. Set the secret to deliver reliably.`,
      );
      const fallback = await fallbackOtp(to);
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "supabase",
        providerMessageId: null,
        status: fallback ? "sent" : "failed",
        error: `${missing} not configured${fallback ? "" : "; built-in mailer refused"}`,
      });
      return { sent: fallback, provider: "supabase", messageId: null, reason: `missing ${missing}` };
    }

    const domainCheck = await checkSendingDomain();
    if (!domainCheck.ok) {
      console.error(`[mail] refusing to send from an unverified domain: ${domainCheck.detail}`);
      const fallback = await fallbackOtp(to);
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "supabase",
        providerMessageId: null,
        status: fallback ? "sent" : "failed",
        error: domainCheck.detail,
      });
      return {
        sent: fallback,
        provider: "supabase",
        messageId: null,
        reason: domainCheck.detail,
      };
    }

    const origin = siteUrl();
    const link = await generateMagicLink(to, origin);
    if (!link) {
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "resend",
        providerMessageId: null,
        status: "failed",
        error: "could not generate a sign-in link",
      });
      return { sent: false, provider: "resend", messageId: null, reason: "no link" };
    }

    const edition = await loadCurrentEdition().catch(() => null);
    const dates = edition ? formatRange(edition.starts_on, edition.ends_on) : "";

    const { text, html } = buildBody({
      name: opts.firstName?.trim() || "Hello",
      statusLine: STATUS_LINE[opts.status] ?? "You answered for this year.",
      link,
      dates,
    });

    const headers = unsubscribeHeaders(to);

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [to],
        subject: "Confirm your spot, Pitt Club Ultimate",
        text,
        html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });

    const payload = (await res.json().catch(() => null)) as
      | { id?: string; message?: string }
      | null;

    if (!res.ok) {
      const message = `Resend refused [${res.status}]: ${payload?.message ?? "unknown error"}`;
      console.error(`[mail] ${message}`);
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "resend",
        providerMessageId: null,
        status: "failed",
        error: message,
      });
      return { sent: false, provider: "resend", messageId: null, reason: message };
    }

    await logSend({
      personId: opts.personId,
      kind,
      toEmail: to,
      provider: "resend",
      providerMessageId: payload?.id ?? null,
      status: "sent",
      error: null,
    });
    return { sent: true, provider: "resend", messageId: payload?.id ?? null, reason: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[mail] send threw: ${message}`);
    try {
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "resend",
        providerMessageId: null,
        status: "failed",
        error: message,
      });
    } catch {
      /* logging must not mask the original failure */
    }
    return { sent: false, provider: "resend", messageId: null, reason: message };
  }
}

/** A plain transactional message with no sign-in link. Shares the suppression
 *  check and the send log with the magic link path. Never throws. */
export async function sendPlainEmail(opts: {
  to: string;
  personId: string | null;
  kind: string;
  subject: string;
  text: string;
  html: string;
}): Promise<MagicLinkResult> {
  const to = opts.to.trim().toLowerCase();
  const { apiKey, fromAddress, fromName, replyTo } = mailConfig();

  try {
    if (await isSuppressed(to)) {
      await logSend({
        personId: opts.personId,
        kind: opts.kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "suppressed",
        error: "address is suppressed",
      });
      return { sent: false, provider: "none", messageId: null, reason: "suppressed" };
    }

    if (!apiKey || !fromAddress) {
      await logSend({
        personId: opts.personId,
        kind: opts.kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "failed",
        error: "mail sender is not configured",
      });
      return { sent: false, provider: "none", messageId: null, reason: "not configured" };
    }

    const domainCheck = await checkSendingDomain();
    if (!domainCheck.ok) {
      console.error(`[mail] refusing to send from an unverified domain: ${domainCheck.detail}`);
      await logSend({
        personId: opts.personId,
        kind: opts.kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "failed",
        error: domainCheck.detail,
      });
      return { sent: false, provider: "none", messageId: null, reason: domainCheck.detail };
    }

    const headers = unsubscribeHeaders(to);

    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from: `${fromName} <${fromAddress}>`,
        to: [to],
        subject: opts.subject,
        text: opts.text,
        html: opts.html,
        ...(replyTo ? { reply_to: replyTo } : {}),
        ...(Object.keys(headers).length ? { headers } : {}),
      }),
    });

    const payload = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

    if (!res.ok) {
      const message = `Resend refused [${res.status}]: ${payload?.message ?? "unknown error"}`;
      await logSend({
        personId: opts.personId,
        kind: opts.kind,
        toEmail: to,
        provider: "resend",
        providerMessageId: null,
        status: "failed",
        error: message,
      });
      return { sent: false, provider: "resend", messageId: null, reason: message };
    }

    await logSend({
      personId: opts.personId,
      kind: opts.kind,
      toEmail: to,
      provider: "resend",
      providerMessageId: payload?.id ?? null,
      status: "sent",
      error: null,
    });
    return { sent: true, provider: "resend", messageId: payload?.id ?? null, reason: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown error";
    console.error(`[mail] plain send threw: ${message}`);
    return { sent: false, provider: "resend", messageId: null, reason: message };
  }
}

/** The pre-existing path: the built-in mailer. Kept only as a fallback. */
async function fallbackOtp(to: string) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return false;
  const target = siteUrl();
  const res = await fetch(`${url}/auth/v1/otp`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email: to, ...(target ? { redirect_to: `${target}/auth` } : {}) }),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`[mail] built-in mailer refused [${res.status}]: ${body}`);
  }
  return res.ok;
}