import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import {
  emailButton,
  emailFooter,
  emailMuted,
  emailParagraph,
  emailPlainUrl,
  emailShell,
  emailSocialBlock,
  escapeHtml,
  FONT_STACK,
  INK,
} from "./email-chrome";
import { currentEditionYear, loadCurrentEdition } from "./editions.server";
import { logAuthAttempt } from "./auth-attempts.server";
import { DISCORD_INVITE_URL, SITE_ORIGIN } from "./site-url";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** The verified Resend sending domain. Verified 2026-08-07. Any MAIL_FROM_ADDRESS
 *  secret pointing somewhere else is ignored: sending off a verified domain is
 *  a silent deliverability failure, so the domain is pinned here. */
export const SENDING_DOMAIN = "alumni.pittultimate.org";
const DEFAULT_FROM_ADDRESS = `weekend@${SENDING_DOMAIN}`;

/** The kinds allowed out while outbound email is paused. The allow list is by
 *  message kind, not by calling function: a test send or a party-size link is
 *  not a sign-in link even though it shares the code path. RSVP confirmations
 *  are allowed, but only forward: see rsvpConfirmationAllowed(). */
const TRANSACTIONAL_KINDS = new Set(["magic_link", "rsvp_confirmation"]);

/** Forward-only cutoff for RSVP confirmations. Written once at migration time
 *  and never moved. An RSVP recorded before this instant is never confirmed by
 *  email: there is no catch-up path and there must never be one. Fails closed. */
async function rsvpConfirmationCutoff(): Promise<Date | null> {
  try {
    const { data } = await supabaseAdmin
      .from("app_settings")
      .select("value")
      .eq("key", "rsvp_confirmation_cutoff")
      .maybeSingle();
    const raw = (data as { value?: string } | null)?.value;
    if (!raw) return null;
    const at = new Date(raw);
    return Number.isNaN(at.getTime()) ? null : at;
  } catch {
    return null;
  }
}

/** True only when this person's answer was written after the cutoff. Anything
 *  older, unreadable or missing is refused. */
export async function rsvpConfirmationAllowed(
  personId: string | null,
): Promise<{ ok: boolean; reason: string | null }> {
  const cutoff = await rsvpConfirmationCutoff();
  if (!cutoff) return { ok: false, reason: "rsvp confirmation cutoff is not set" };
  if (!personId) return { ok: false, reason: "no person on the rsvp confirmation" };
  try {
    const { data } = await supabaseAdmin
      .from("rsvps")
      .select("responded_at")
      .eq("person_id", personId)
      .order("responded_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    const raw = (data as { responded_at?: string } | null)?.responded_at;
    if (!raw) return { ok: false, reason: "no rsvp row to confirm" };
    const respondedAt = new Date(raw);
    if (Number.isNaN(respondedAt.getTime())) return { ok: false, reason: "unreadable responded_at" };
    if (respondedAt.getTime() < cutoff.getTime()) {
      return { ok: false, reason: "rsvp predates the confirmation cutoff" };
    }
    return { ok: true, reason: null };
  } catch {
    return { ok: false, reason: "could not read the rsvp for the cutoff check" };
  }
}

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
    const reason = `outbound email is paused (transactional_only); "${input.kind}" is not permitted while paused`;
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
  const configured = process.env.MAIL_FROM_ADDRESS?.trim().toLowerCase() || null;
  const fromAddress =
    configured && configured.endsWith(`@${SENDING_DOMAIN}`) ? configured : DEFAULT_FROM_ADDRESS;
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
  /** Set only by the drip dispatcher. Ordinary transactional sends have none. */
  sequenceId?: string | null;
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
    sequence_id: input.sequenceId ?? null,
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

/** An unspent one-time sign-in link for an address, generated and handed back
 *  rather than mailed. Used by the one-click answer page, where possession of
 *  the answer token has already proved inbox access. Sends nothing. */
export async function sessionLinkFor(email: string, origin: string | null) {
  return generateMagicLink(email, origin);
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
      emailSocialBlock(DISCORD_INVITE_URL),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you answered for Alumni Weekend.",
      ]),
    ].join("\n"),
    "Your Alumni Weekend answer is recorded.",
  );

  return { text, html };
}

export const DISCORD_INVITE_SUBJECT = "Where the weekend actually gets sorted";

/** The discord_invite drip. It carries information, not an ask: what is being
 *  decided in there and when. One screen on a phone. Dormant until the
 *  sequence row is switched on. */
export function buildDiscordInviteBody(opts: { name: string; dates: string }) {
  const lines = [
    "Start times get locked in there first, and they move.",
    "You can see who has said yes before you commit.",
    "Rides and rooms get paired up in there, not over text.",
  ];

  const text = [
    `${opts.name},`,
    "",
    ...(opts.dates ? [opts.dates, ""] : []),
    ...lines,
    "",
    `Join the Discord: ${DISCORD_INVITE_URL}`,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      ...(opts.dates ? [emailMuted(opts.dates)] : []),
      ...lines.map((l) => emailParagraph(l)),
      emailSocialBlock(DISCORD_INVITE_URL),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "Times, who is coming, rides and rooms.",
  );

  return { text, html };
}

/** The literal board link for the t_minus_45 invitation. Hardcoded on purpose:
 *  the src=email tag is how the channel is attributed, so it never resolves
 *  through PUBLIC_SITE_URL and the query string is never stripped. */
const INVITE_BOARD_URL = "https://alumni.pittultimate.org/?src=email";

export const T_MINUS_45_SUBJECT =
  "You're invited: Alumni Weekend, October 2 to 4";

/** The t_minus_45 invitation. Copy is fixed and reproduced verbatim. Dormant
 *  until the sequence row is switched on. */
export function buildTMinus45Body(opts: { name: string }) {
  const lines = [
    "You are invited to Pitt Club Ultimate Alumni Weekend, October 2 to 4 in Pittsburgh.",
    "The board is live. Find your name, see who has already said yes, and tell us whether you are coming.",
  ];
  const after = [
    "Coming, maybe, or not this year. Any answer is a good one, and saying so is the whole signup.",
    "We are building this to last, so however you answer, you stay connected to it from here on.",
  ];

  const text = [
    `${opts.name},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    INVITE_BOARD_URL,
    "",
    after[0],
    "",
    after[1],
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      ...lines.map((l) => emailParagraph(l)),
      emailButton(INVITE_BOARD_URL, "Find your name"),
      emailPlainUrl(INVITE_BOARD_URL),
      ...after.map((l) => emailParagraph(l)),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "See who is already coming.",
  );

  return { text, html };
}

/** ---------------------------------------------------------------------------
 *  t_minus_28: who from your years is coming.
 *  Copy is fixed. Dormant: no dispatcher reads this, and the sequence row stays
 *  active = false until someone switches it on deliberately.
 *  ------------------------------------------------------------------------ */

export const T_MINUS_28_BOARD_URL = "https://alumni.pittultimate.org/?src=email";

/** The subject carries the recipient's own board year. */
export function tMinus28Subject(year: number) {
  return `Who from ${year} is coming`;
}

export type CohortGoing = {
  /** The recipient's own board year. Null means we cannot compute a cohort. */
  year: number | null;
  /** Everyone going within plus or minus 3 board years, recipient excluded. */
  count: number;
  /** At most 12 names, already sorted by board year then last name. */
  names: string[];
};

/** Per recipient cohort: status 'going', board year within plus or minus 3 of
 *  the recipient's own, recipient excluded, deceased excluded, archived
 *  excluded. Sorted by board year then last name, list capped at 12 with no
 *  "and others" line. count is the full qualifying total, not the capped list. */
export async function loadCohortGoing(personId: string): Promise<CohortGoing> {
  const editionYear = await currentEditionYear();

  const { data: mine } = await supabaseAdmin
    .from("person_board_placement")
    .select("board_year")
    .eq("person_id", personId)
    .maybeSingle();
  let year = (mine as { board_year?: number | null } | null)?.board_year ?? null;
  if (year == null) {
    const { data: person } = await supabaseAdmin
      .from("people")
      .select("grad_year")
      .eq("id", personId)
      .maybeSingle();
    year = (person as { grad_year?: number | null } | null)?.grad_year ?? null;
  }
  if (year == null) return { year: null, count: 0, names: [] };

  const { data: going } = await supabaseAdmin
    .from("rsvps")
    .select("person_id")
    .eq("event_year", editionYear)
    .eq("status", "going");
  const ids = Array.from(
    new Set(
      ((going ?? []) as { person_id: string }[])
        .map((r) => r.person_id)
        .filter((id) => id && id !== personId),
    ),
  );
  if (ids.length === 0) return { year, count: 0, names: [] };

  const [{ data: people }, { data: placement }] = await Promise.all([
    supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, grad_year, deceased, archived")
      .in("id", ids),
    supabaseAdmin.from("person_board_placement").select("person_id, board_year").in("person_id", ids),
  ]);

  const placed = new Map<string, number | null>();
  for (const row of (placement ?? []) as { person_id: string; board_year: number | null }[]) {
    placed.set(row.person_id, row.board_year);
  }

  type Row = { year: number; last: string; name: string };
  const rows: Row[] = [];
  for (const p of (people ?? []) as {
    id: string;
    first_name: string;
    last_name: string | null;
    grad_year: number | null;
    deceased: boolean;
    archived: boolean;
  }[]) {
    if (p.deceased || p.archived) continue;
    const by = placed.get(p.id) ?? p.grad_year;
    if (by == null || Math.abs(by - year) > 3) continue;
    const last = p.last_name ?? "";
    rows.push({ year: by, last, name: [p.first_name, last].filter(Boolean).join(" ") });
  }

  rows.sort((a, b) => a.year - b.year || a.last.localeCompare(b.last) || a.name.localeCompare(b.name));

  return { year, count: rows.length, names: rows.slice(0, 12).map((r) => r.name) };
}

/** The t_minus_28 body. Returns null when the cohort is empty: a zero-count
 *  recipient must be skipped, never sent an email saying nobody is coming.
 *  The skip is enforced here, at the builder, so no future dispatcher can
 *  produce that message by forgetting to check. */
export function buildTMinus28Body(opts: {
  name: string;
  cohort: CohortGoing;
}): { text: string; html: string } | null {
  const { count, names } = opts.cohort;
  if (count <= 0 || names.length === 0) return null;

  const lead = `${count} ${count === 1 ? "person" : "people"} from your years ${
    count === 1 ? "has" : "have"
  } said they are coming to Alumni Weekend, October 2 to 4.`;

  const discordBlock = `There is now an Alumni Weekend channel in the Pitt Alumni Discord for anyone who wants to sort out plans, rides, or rooms with their own crew.`;

  const text = [
    `${opts.name},`,
    "",
    lead,
    "",
    ...names,
    "",
    "See the rest and add your answer:",
    "",
    T_MINUS_28_BOARD_URL,
    "",
    discordBlock,
    "",
    DISCORD_INVITE_URL,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lead),
      `<p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:15px;line-height:26px;color:${INK};">${names
        .map((n) => escapeHtml(n))
        .join("<br />")}</p>`,
      emailParagraph("See the rest and add your answer:"),
      emailButton(T_MINUS_28_BOARD_URL, "See who is coming"),
      emailPlainUrl(T_MINUS_28_BOARD_URL),
      emailParagraph(discordBlock),
      emailPlainUrl(DISCORD_INVITE_URL),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "Names from your years.",
  );

  return { text, html };
}

/** ---------------------------------------------------------------------------
 *  t_minus_14: the schedule is locked.
 *  ------------------------------------------------------------------------ */

export const T_MINUS_14_WEEKEND_URL = `${SITE_ORIGIN}/schedule?src=email`;

export const T_MINUS_14_SUBJECT = "Times are locked";

/** Plain schedule lines for the current edition: day, time, title, location.
 *  time_tbd renders as TBD. A time is never guessed and an event is never
 *  dropped for lacking one. */
export async function loadScheduleLines(): Promise<string[]> {
  const { loadEvents } = await import("./ics.server");
  const { editionDay, dayName } = await import("./edition-format");
  const edition = await loadCurrentEdition();
  const events = await loadEvents(edition.event_year);

  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  });

  return events.map((e) => {
    const day = dayName(editionDay(edition, e.day_number ?? 1));
    const time = e.time_tbd || !e.starts_at ? "TBD" : fmt.format(new Date(e.starts_at));
    return [day, time, e.title, e.location].filter(Boolean).join(", ");
  });
}

export const HOTEL_REMINDER_SUBJECT = "Book your hotel — Alumni Weekend is four weeks out";

/** The t_minus_28 body: hotel booking reminder. */
export function buildHotelReminderBody(opts: { name: string }): { text: string; html: string } {
  const lines = [
    "Alumni Weekend is October 2 to 4 in Pittsburgh. If you are coming from out of town and have not booked yet, now is the time.",
    "Hilton Garden Inn Pittsburgh University Place is closest to Oakland and where most alumni are staying. There is no group block, so book directly at the hotel rate.",
    "The full schedule and the board are on the site.",
  ];

  const text = [
    `${opts.name},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    lines[2],
    "",
    "https://alumni.pittultimate.org/?src=email",
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      ...lines.map((l) => emailParagraph(l)),
      emailButton("https://alumni.pittultimate.org/?src=email", "See the board"),
      emailPlainUrl("https://alumni.pittultimate.org/?src=email"),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "Book your hotel for Alumni Weekend.",
  );

  return { text, html };
}

const COUNT_WORDS = ["No", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten"];

function countWord(n: number): string {
  return COUNT_WORDS[n] ?? String(n);
}

/** Subject matches the number of pending events, so it stays correct if the
 *  prompt event set changes. */
export function eventRsvpPromptSubject(count: number): string {
  const noun = count === 1 ? "question" : "questions";
  return `${countWord(count)} more ${noun} about the weekend`;
}

/** The event_rsvp_prompt body: only ever sent to people already going, and only
 *  for the events they have not answered yet. Returns null when there is
 *  nothing left to ask, so the dispatcher skips the recipient. */
export function buildEventRsvpPromptBody(opts: {
  name: string;
  pending: string[];
}): { text: string; html: string } | null {
  if (opts.pending.length === 0) return null;

  const many = opts.pending.length > 1;

  const lines = [
    "You are down as coming to Alumni Weekend. Thank you.",
    `${many ? "Each of these still needs" : "One thing still needs"} a yes or a no of its own, because food, seating and roster sizes are planned off those numbers. A no is just as useful as a yes.`,
    // Never promise one tap when several answers are outstanding.
    many
      ? "You can answer all of them in one visit to the board."
      : "It takes one tap on the board.",
  ];

  const url = "https://alumni.pittultimate.org/?src=email";

  const text = [
    `${opts.name},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    ...opts.pending.map((item) => `- ${item}`),
    "",
    url,
    "",
    lines[2],
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lines[0]),
      emailParagraph(lines[1]),
      emailList(opts.pending),
      emailButton(url, "Answer on the board"),
      emailPlainUrl(url),
      emailParagraph(lines[2]),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    // The preheader used to say "Two quick headcounts", which was wrong the
    // moment the number of events changed. It no longer counts anything.
    "Each event needs its own yes or no.",
  );

  return { text, html };
}

export const T_MINUS_7_SUBJECT = "One week out";


/** The t_minus_7 body: the direct ask. */
export function buildTMinus7Body(opts: { name: string }): { text: string; html: string } {
  const lines = [
    "One week out. The Saturday BBQ shelter holds 24 people and we are planning food and seating off final numbers this week.",
    "Are you in?",
    "Not this year is a good answer too. Either way, tell us before Thursday.",
  ];

  const text = [
    `${opts.name},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    "https://alumni.pittultimate.org/?src=email",
    "",
    lines[2],
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lines[0]),
      emailParagraph(`<strong>${lines[1]}</strong>`),
      emailButton("https://alumni.pittultimate.org/?src=email", "Update your answer"),
      emailPlainUrl("https://alumni.pittultimate.org/?src=email"),
      emailParagraph(lines[2]),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "Are you coming to Alumni Weekend?",
  );

  return { text, html };
}

/** The t_minus_14 body. Copy is fixed and reproduced verbatim. */
export function buildTMinus14Body(opts: { name: string; schedule: string[] }) {
  const lead = "Alumni Weekend is two weeks out. The schedule is set.";
  const after = "Everything is on the site, and you can add it to your calendar in one click.";
  const nudge = "If you have not told us yet, now is a good time.";

  const text = [
    `${opts.name},`,
    "",
    lead,
    "",
    ...opts.schedule,
    "",
    after,
    "",
    T_MINUS_14_WEEKEND_URL,
    "",
    nudge,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lead),
      `<p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:15px;line-height:26px;color:${INK};">${opts.schedule
        .map((l) => escapeHtml(l))
        .join("<br />")}</p>`,
      emailParagraph(after),
      emailButton(T_MINUS_14_WEEKEND_URL, "See the schedule"),
      emailPlainUrl(T_MINUS_14_WEEKEND_URL),
      emailParagraph(nudge),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "The full schedule.",
  );

  return { text, html };
}

/** ---------------------------------------------------------------------------
 *  t_minus_10_headcount: how many are you bringing.
 *  Audience is status 'going' only. party_size stays private: it is never
 *  added to a public view and the link below changes that one number and
 *  nothing else. Dormant until the sequence row is switched on.
 *  ------------------------------------------------------------------------ */

export const T_MINUS_10_SUBJECT = "How many are you bringing?";

/** The body needs the recipient's own one-click link, minted by the existing
 *  builder in party-token.server.ts. Returns null when no link can be made,
 *  so a headcount email is never sent without the tap it asks for. */
export function buildTMinus10Body(opts: {
  name: string;
  oneClickLink: string | null;
}): { text: string; html: string } | null {
  const link = opts.oneClickLink;
  if (!link) return null;

  const lead = "Glad you are coming. One quick thing so we can plan food and seating.";
  const ask = "How many people total, including you?";
  const close = "Takes one tap. Kids count.";

  const text = [
    `${opts.name},`,
    "",
    lead,
    "",
    ask,
    "",
    link,
    "",
    close,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lead),
      emailParagraph(ask),
      emailButton(link, "Set my headcount"),
      emailPlainUrl(link),
      emailParagraph(close),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "One tap, so we can plan.",
  );

  return { text, html };
}

/** ---------------------------------------------------------------------------
 *  t_minus_2: this weekend. Audience is status 'going' only.
 *  ------------------------------------------------------------------------ */

export const T_MINUS_2_SUBJECT = "This weekend";

/** Schedule lines come from loadScheduleLines(): same source, same TBD rule. */
export function buildTMinus2Body(opts: { name: string; schedule: string[] }) {
  const lead = "See you Friday.";
  const logistics =
    "Parking near Schenley Park is tight on a football Saturday, so give yourself extra time. The shelter has no electricity. Bring a chair if you want one.";

  const text = [
    `${opts.name},`,
    "",
    lead,
    "",
    ...opts.schedule,
    "",
    logistics,
    "",
    T_MINUS_14_WEEKEND_URL,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      emailParagraph(lead),
      `<p style="margin:0 0 20px;font-family:${FONT_STACK};font-size:15px;line-height:26px;color:${INK};">${opts.schedule
        .map((l) => escapeHtml(l))
        .join("<br />")}</p>`,
      emailParagraph(logistics),
      emailButton(T_MINUS_14_WEEKEND_URL, "See the schedule"),
      emailPlainUrl(T_MINUS_14_WEEKEND_URL),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "See you Friday.",
  );

  return { text, html };
}

/** ---------------------------------------------------------------------------
 *  t_plus_3: thank you, and next year.
 *  Goes to everyone who touched it, including people who said not this year,
 *  so the copy never assumes attendance. No headcount, no photos, and no 2027
 *  date: we do not know it yet.
 *  ------------------------------------------------------------------------ */

export const T_PLUS_3_SUBJECT = "Thank you, and next year";

export function buildTPlus3Body(opts: { name: string }) {
  const lines = [
    "Thank you. That was a good weekend.",
    "We will announce next year's dates by email once they are set. Look out for that one.",
    "Your record stays where it is. If anything on it is wrong, fix it and we will find you again next year.",
  ];

  const text = [
    `${opts.name},`,
    "",
    lines[0],
    "",
    lines[1],
    "",
    lines[2],
    "",
    T_MINUS_28_BOARD_URL,
    "",
    "Pitt Club Ultimate Alumni",
  ].join("\n");

  const html = emailShell(
    [
      emailParagraph(`${opts.name},`),
      ...lines.map((l) => emailParagraph(l)),
      emailButton(T_MINUS_28_BOARD_URL, "Check your record"),
      emailPlainUrl(T_MINUS_28_BOARD_URL),
      emailFooter([
        "Pitt Club Ultimate Alumni",
        "You are receiving this because you have a record on the alumni board.",
      ]),
    ].join("\n"),
    "Thank you.",
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
      const reason = `outbound email is paused (transactional_only); "${kind}" is not permitted while paused`;
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

    // Forward only. A confirmation exists to acknowledge an answer that was
    // just written, so an answer older than the cutoff is never confirmed.
    if (kind === "rsvp_confirmation") {
      const gate = await rsvpConfirmationAllowed(opts.personId);
      if (!gate.ok) {
        const reason = `rsvp confirmation refused: ${gate.reason}`;
        await logSend({
          personId: opts.personId,
          kind,
          toEmail: to,
          provider: "none",
          providerMessageId: null,
          status: "blocked",
          error: reason,
        });
        return { sent: false, provider: "none", messageId: null, reason };
      }
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

    // Duplicate guard, sign-in links only. Inside the window we neither mint a
    // token nor send: the person already has a live link in their inbox.
    const reusable = kind === "magic_link" ? await recentMagicLink(to) : null;
    if (reusable) {
      const reason = "a sign-in link was already sent to this address in the last 60 seconds";
      await logSend({
        personId: opts.personId,
        kind,
        toEmail: to,
        provider: "none",
        providerMessageId: null,
        status: "throttled",
        error: reason,
      });
      await logAuthAttempt({
        email: to,
        personId: opts.personId,
        outcome: "throttled",
        detail: reason,
      });
      return { sent: false, provider: "none", messageId: null, reason };
    }

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

    const name = opts.firstName?.trim() || "Hello";
    const isSignIn = kind === "magic_link" || kind === "admin_test";

    let body: { text: string; html: string };
    let subject: string;
    if (isSignIn) {
      body = buildBody({ name, link });
      subject = SIGNIN_SUBJECT;
    } else {
      const edition = await loadCurrentEdition().catch(() => null);
      body = buildConfirmationBody({
        name,
        statusLine: STATUS_LINE[opts.status] ?? "Your answer is recorded.",
        link,
        dates: edition ? formatRange(edition.starts_on, edition.ends_on) : "",
      });
      subject = CONFIRMATION_SUBJECT;
    }

    if (kind === "magic_link") await rememberMagicLink(to, opts.personId, link);

    const delivery = await resendDeliver({
      kind,
      to,
      personId: opts.personId,
      subject,
      text: body.text,
      html: body.html,
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
  /** Only the drip dispatcher sets this; it lands on the sends row. */
  sequenceId?: string | null;
}): Promise<MagicLinkResult> {
  const to = opts.to.trim().toLowerCase();
  const { apiKey, fromAddress } = mailConfig();

  try {
    if (await isSuppressed(to)) {
      await logSend({
        personId: opts.personId,
        kind: opts.kind,
        sequenceId: opts.sequenceId ?? null,
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
        sequenceId: opts.sequenceId ?? null,
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
        sequenceId: opts.sequenceId ?? null,
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
        sequenceId: opts.sequenceId ?? null,
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
      sequenceId: opts.sequenceId ?? null,
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