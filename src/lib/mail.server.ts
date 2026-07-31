import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  emailButton,
  emailFooter,
  emailMuted,
  emailParagraph,
  emailPlainUrl,
  emailShell,
  escapeHtml,
} from "./email-chrome";
import { loadCurrentEdition } from "./editions.server";
import { logAuthAttempt } from "./auth-attempts.server";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** The only kind of message allowed out while outbound email is paused. The
 *  allow list is by message kind, not by calling function: a test send or a
 *  party-size link is not a sign-in link even though it shares the code path. */
const TRANSACTIONAL_KINDS = new Set(["magic_link"]);

export type OutboundEmailMode = "transactional_only" | "all";

/** Read of the single switch. Fails closed: if the setting cannot be read we
 *  behave as though everything except sign-in links is paused. */
export async function outboundEmailMode(): Promise<OutboundEmailMode> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "outbound_email_mode")
      .maybeSingle();
    return (data as { value?: string } | null)?.value === "all" ? "all" : "transactional_only";
  } catch {
    return "transactional_only";
  }
}

export function outboundEmailModeSentence(mode: OutboundEmailMode) {
  return mode === "all"
    ? "Outbound email: on. Every message type can be sent."
    : "Outbound email: paused. Only sign-in links are being sent.";
}

type DeliverInput = {
  kind: string;
  to: string;
  personId: string | null;
  subject: string;
  text: string;
  html: string;
};

/** THE CHOKE POINT. Nothing else in this codebase may call the Resend send
 *  endpoint. Every message is checked against the outbound email mode here,
 *  and a refusal writes a blocked row before returning. */
async function resendDeliver(
  input: DeliverInput,
): Promise<{ ok: boolean; messageId: string | null; error: string | null; blocked?: true }> {
  const { apiKey, fromAddress, fromName, replyTo } = mailConfig();
  const mode = await outboundEmailMode();

  if (mode !== "all" && !TRANSACTIONAL_KINDS.has(input.kind)) {
    const reason = `outbound email is paused (transactional_only); "${input.kind}" is not a sign-in link`;
    await logSend({
      personId: input.personId,
      kind: input.kind,
      toEmail: input.to,
      provider: "none",
      providerMessageId: null,
      status: "blocked",
      error: reason,
    });
    console.warn(`[mail] blocked: ${reason}`);
    return { ok: false, messageId: null, error: reason, blocked: true };
  }

  const headers = unsubscribeHeaders(input.to);
  const res = await fetch(RESEND_ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: `${fromName} <${fromAddress}>`,
      to: [input.to],
      subject: input.subject,
      text: input.text,
      html: input.html,
      ...(replyTo ? { reply_to: replyTo } : {}),
      ...(Object.keys(headers).length ? { headers } : {}),
    }),
  });

  const payload = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;
  if (!res.ok) {
    return {
      ok: false,
      messageId: null,
      error: `Resend refused [${res.status}]: ${payload?.message ?? "unknown error"}`,
    };
  }
  return { ok: true, messageId: payload?.id ?? null, error: null };
}

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

type DomainCheck = {
  ok: boolean;
  domain: string | null;
  detail: string;
  clickTracking: boolean | null;
  openTracking: boolean | null;
};

let domainCache: { at: number; value: DomainCheck } | null = null;

/** Asks Resend which domains are verified and compares that to the domain in
 *  the from address. Sending from an unverified domain lands in spam quietly,
 *  so we would rather refuse and say why. */
export async function checkSendingDomain(force = false): Promise<DomainCheck> {
  const { apiKey, fromAddress } = mailConfig();
  const domain = fromDomain(fromAddress);
  const blank = { clickTracking: null, openTracking: null };
  if (!apiKey) return { ok: false, domain, detail: "RESEND_API_KEY is not set.", ...blank };
  if (!domain) return { ok: false, domain: null, detail: "MAIL_FROM_ADDRESS is not set.", ...blank };

  if (!force && domainCache && Date.now() - domainCache.at < 5 * 60 * 1000) {
    return domainCache.value;
  }

  let value: DomainCheck;
  try {
    const res = await fetch("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });
    const payload = (await res.json().catch(() => null)) as
      | {
          data?: {
            id?: string;
            name?: string;
            status?: string;
            click_tracking?: boolean;
            open_tracking?: boolean;
          }[];
          message?: string;
        }
      | null;
    if (!res.ok) {
      // A sending-only (restricted) Resend key cannot read /domains. That is a
      // key scope limit, not an unverified domain: refusing to send here would
      // silently downgrade every message to the capped built-in mailer. Resend
      // itself rejects a send from an unverified domain, so let the send be the
      // check and say plainly that we could not confirm it up front.
      const restricted = res.status === 401 || res.status === 403;
      value = {
        ok: restricted,
        domain,
        detail: restricted
          ? `Cannot read the Resend domain list with this API key (${payload?.message ?? "restricted key"}). Sending anyway: Resend rejects an unverified from-domain at send time. Tracking cannot be enforced from here; turn click and open tracking off on ${domain} in the Resend dashboard.`
          : `Resend refused the domain list [${res.status}]: ${payload?.message ?? "unknown error"}`,
        ...blank,
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
          ...blank,
        };
      } else if ((match.status ?? "").toLowerCase() !== "verified") {
        value = {
          ok: false,
          domain,
          detail: `${domain} reads ${match.status ?? "unknown"} in Resend, not verified.`,
          clickTracking: match.click_tracking ?? null,
          openTracking: match.open_tracking ?? null,
        };
      } else {
        const tracking = await enforceNoTracking(apiKey, match.id ?? null, {
          click: match.click_tracking ?? null,
          open: match.open_tracking ?? null,
        });
        value = {
          ok: true,
          domain,
          detail: `${domain} verifies in Resend. ${tracking.detail}`,
          clickTracking: tracking.click,
          openTracking: tracking.open,
        };
      }
    }
  } catch (err) {
    value = {
      ok: false,
      domain,
      detail: `Could not reach Resend: ${err instanceof Error ? err.message : "unknown error"}`,
      ...blank,
    };
  }

  domainCache = { at: Date.now(), value };
  return value;
}

/** Tracking is turned off at the domain, not left to an account default.
 *  Resend rewrites tracked links through its own host. Mail scanners pre fetch
 *  those links, which burns a one time sign in token before the person ever
 *  clicks, and a rewritten host does not match the site being signed into,
 *  which is exactly the shape of a phishing message. Open tracking adds a
 *  pixel that costs spam score and tells us nothing. */
async function enforceNoTracking(
  apiKey: string,
  id: string | null,
  current: { click: boolean | null; open: boolean | null },
): Promise<{ click: boolean | null; open: boolean | null; detail: string }> {
  if (current.click === false && current.open === false) {
    return { click: false, open: false, detail: "Click and open tracking are off." };
  }
  if (!id) {
    return { ...current, detail: "Could not read the domain id, tracking state unconfirmed." };
  }
  try {
    const res = await fetch(`https://api.resend.com/domains/${id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({ click_tracking: false, open_tracking: false }),
    });
    if (!res.ok) {
      return { ...current, detail: `Could not turn tracking off [${res.status}].` };
    }
    return { click: false, open: false, detail: "Click and open tracking turned off." };
  } catch (err) {
    return {
      ...current,
      detail: `Could not turn tracking off: ${err instanceof Error ? err.message : "unknown error"}`,
    };
  }
}

/** One line an organizer can read without opening a settings screen. */
export async function mailStatus() {
  const { apiKey, fromAddress, fromName, replyTo } = mailConfig();
  const check = await checkSendingDomain(true);
  const mode = await outboundEmailMode();
  return {
    fromAddress,
    fromName,
    replyTo,
    siteUrl: siteUrl(),
    hasApiKey: Boolean(apiKey),
    domain: check.domain,
    verified: check.ok,
    detail: check.detail,
    clickTracking: check.clickTracking,
    openTracking: check.openTracking,
    outboundMode: mode,
    outboundSentence: outboundEmailModeSentence(mode),
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

/** status is the fine grained provider story; outcome is the four way split
 *  every count must filter on. Derived in one place so they cannot drift. */
function outcomeFor(status: string): "sent" | "blocked" | "failed" | "suppressed" {
  if (status === "sent" || status === "delivered") return "sent";
  if (status === "blocked") return "blocked";
  if (status === "suppressed" || status === "throttled") return "suppressed";
  return "failed";
}

/** Every outbound message lands here, delivered or not, so a failure shows up
 *  on a screen instead of in a log nobody reads. */
export async function logSend(input: LogInput) {
  const outcome = outcomeFor(input.status);
  await supabaseAdmin.from("sends").insert({
    person_id: input.personId,
    sequence_id: null,
    kind: input.kind,
    to_email: input.toEmail,
    provider: input.provider,
    provider_message_id: input.providerMessageId,
    status: input.status,
    error: input.error,
    outcome,
    blocked_reason: outcome === "sent" ? null : input.error,
    sent_at: input.status === "sent" ? new Date().toISOString() : null,
  } as never);
}

/** Asks the auth admin API for a one-time sign-in link so we can carry it in
 *  our own message. The service role key stays on the server.
 *
 *  We deliberately do NOT mail the provider's own /auth/v1/verify URL. That URL
 *  consumes the token the instant it is opened and then hands the browser a
 *  session, which is unrecoverable if the browser already holds a session for
 *  somebody else. Mailing the unconsumed token to our own callback lets that
 *  page ask a question first and only spend the token once the person says so. */
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
  const hashed = (props.hashed_token ?? out.json.hashed_token) as string | undefined;
  const kind = (props.verification_type ?? out.json.verification_type) as string | undefined;

  if (typeof hashed === "string" && hashed.length > 0 && origin) {
    const type = kind === "signup" ? "signup" : "magiclink";
    return `${origin}/auth/callback?token_hash=${encodeURIComponent(hashed)}&type=${type}`;
  }

  // Only if the admin API stops returning the raw token: a working link beats
  // a missing one, even without the interstitial.
  const link = (props.action_link ?? out.json.action_link) as string | undefined;
  return typeof link === "string" ? link : null;
}

/** Confirmation copy only. This never appears in a sign-in link message: a
 *  sign-in link says one thing, here is your link. Carrying RSVP copy in the
 *  one kind that is allowed through while outbound email is paused turned every
 *  status change into a delivered email, which is exactly what the pause is
 *  meant to prevent. */
const STATUS_LINE: Record<string, string> = {
  going: "We have you down as coming this year.",
  maybe: "We have you down as a maybe this year.",
  not_this_year: "We have you down as not coming this year.",
};

export const SIGNIN_SUBJECT = "Sign in to Pitt Club Ultimate Alumni";
export const CONFIRMATION_SUBJECT = "Your Alumni Weekend answer is recorded";

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

/** The sign-in link message. It says one thing and carries one thing. No RSVP
 *  status line, no weekend dates, nothing that a status change could generate.
 *  Anything about the weekend belongs in the confirmation below, where the
 *  pause already refuses it. */
export function buildBody(opts: { name: string; link: string }) {
  const purpose = "This link signs you in to your alumni record. No password.";
  const note = "If you did not ask to sign in, ignore this message.";

  const text = [
    `${opts.name},`,
    "",
    purpose,
    "",
    `Sign in: ${opts.link}`,
    "",
    note,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(purpose),
      emailButton(opts.link, "Sign in"),
      emailPlainUrl(opts.link),
      emailMuted(note),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you asked for a sign-in link.",
      ]),
    ].join("\n"),
    "Your sign-in link for Pitt Club Ultimate Alumni.",
  );

  return { text, html };
}

/** The RSVP confirmation. This is where what we recorded and the weekend dates
 *  live, and it is not a sign-in link kind, so the pause refuses it. */
export function buildConfirmationBody(opts: {
  name: string;
  statusLine: string;
  link: string;
  dates: string;
}) {
  const change = "You can change your answer any time by signing in.";

  const text = [
    `${opts.name},`,
    "",
    opts.statusLine,
    ...(opts.dates ? ["", opts.dates] : []),
    "",
    change,
    `Sign in: ${opts.link}`,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(opts.statusLine),
      ...(opts.dates ? [emailMuted(opts.dates)] : []),
      emailButton(opts.link, "Sign in"),
      emailPlainUrl(opts.link),
      emailMuted(change),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you answered for Alumni Weekend.",
      ]),
    ].join("\n"),
    "Your Alumni Weekend answer is recorded.",
  );

  return { text, html };
}

/** One sign-in link per address per minute. A person clicking through three
 *  answers in a row gets one email, not three, and the link they already hold
 *  stays valid because we hand back the one we minted rather than issuing a new
 *  token that would invalidate it. */
const MAGIC_LINK_WINDOW_MS = 60_000;

async function recentMagicLink(email: string) {
  const { data } = await supabaseAdmin
    .from("magic_link_issues")
    .select("link, issued_at")
    .eq("email", email)
    .maybeSingle();
  const row = data as { link: string; issued_at: string } | null;
  if (!row) return null;
  const age = Date.now() - new Date(row.issued_at).getTime();
  return age >= 0 && age < MAGIC_LINK_WINDOW_MS ? row.link : null;
}

async function rememberMagicLink(email: string, personId: string | null, link: string) {
  await supabaseAdmin
    .from("magic_link_issues")
    .upsert(
      { email, person_id: personId, link, issued_at: new Date().toISOString() } as never,
      { onConflict: "email" },
    );
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
  /** Required, never defaulted. A caller that forgets to say what this message
   *  is must NOT inherit the one kind that is allowed while paused. */
  kind: string;
}): Promise<MagicLinkResult> {
  const to = opts.to.trim().toLowerCase();
  const { apiKey, fromAddress } = mailConfig();
  const kind = opts.kind;

  try {
    // The built-in mailer below is a second way out of the building, so the
    // same one switch is consulted before any of it runs. The decision itself
    // lives in outboundEmailMode(); this is not a second policy.
    if (!TRANSACTIONAL_KINDS.has(kind) && (await outboundEmailMode()) !== "all") {
      const reason = `outbound email is paused (transactional_only); "${kind}" is not a sign-in link`;
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "blocked",
        error: reason,
      });
      await logAuthAttempt({ email: to, personId: opts.personId, outcome: "blocked", detail: reason });
      return { sent: false, provider: "none", messageId: null, reason };
    }

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
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: "suppressed",
        detail: "address is suppressed",
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
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: fallback ? "fallback_sent" : "send_failed",
        detail: `${missing} not configured${fallback ? "; sent via the built-in mailer" : "; built-in mailer refused"}`,
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
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: fallback ? "fallback_sent" : "send_failed",
        detail: domainCheck.detail,
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
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: "send_failed",
        detail: "could not generate a sign-in link",
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

    const delivery = await resendDeliver({
      kind,
      to,
      personId: opts.personId,
      subject: SIGNIN_SUBJECT,
      text,
      html,
    });

    if (!delivery.ok) {
      const message = delivery.error ?? "the send did not go out";
      console.error(`[mail] ${message}`);
      // resendDeliver already logged a blocked row; only log real failures here.
      if (!delivery.blocked) {
        await logSend({
          personId: opts.personId,
          kind,
          toEmail: to,
          provider: "resend",
          providerMessageId: null,
          status: "failed",
          error: message,
        });
      }
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: delivery.blocked ? "blocked" : "send_failed",
        detail: message,
      });
      return { sent: false, provider: delivery.blocked ? "none" : "resend", messageId: null, reason: message };
    }

    await logSend({
      personId: opts.personId,
      kind,
      toEmail: to,
      provider: "resend",
      providerMessageId: delivery.messageId,
      status: "sent",
      error: null,
    });
    await logAuthAttempt({ email: to, personId: opts.personId, outcome: "sent", detail: null });
    return { sent: true, provider: "resend", messageId: delivery.messageId, reason: null };
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
    await logAuthAttempt({
      email: to,
      personId: opts.personId,
      outcome: "send_failed",
      detail: message,
    });
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
  const { apiKey, fromAddress } = mailConfig();

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

    const delivery = await resendDeliver({
      kind: opts.kind,
      to,
      personId: opts.personId,
      subject: opts.subject,
      text: opts.text,
      html: opts.html,
    });

    if (!delivery.ok) {
      const message = delivery.error ?? "the send did not go out";
      if (!delivery.blocked) {
        await logSend({
          personId: opts.personId,
          kind: opts.kind,
          toEmail: to,
          provider: "resend",
          providerMessageId: null,
          status: "failed",
          error: message,
        });
      }
      return {
        sent: false,
        provider: delivery.blocked ? "none" : "resend",
        messageId: null,
        reason: message,
      };
    }

    await logSend({
      personId: opts.personId,
      kind: opts.kind,
      toEmail: to,
      provider: "resend",
      providerMessageId: delivery.messageId,
      status: "sent",
      error: null,
    });
    return { sent: true, provider: "resend", messageId: delivery.messageId, reason: null };
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