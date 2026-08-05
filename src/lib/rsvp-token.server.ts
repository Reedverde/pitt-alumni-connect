import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { currentEditionYear } from "./editions.server";
import { siteUrl } from "./mail.server";
import { RSVP_STATUSES, type RsvpStatus } from "./rsvp-types";

/** One-click answer links carried by drip email.
 *
 *  The link NEVER writes. Email security scanners open every URL in a message
 *  before the human does, so a GET that recorded an answer would record robots.
 *  Loading only reads and logs an open; the tap on the landing page commits.
 *
 *  Its own secret namespace and its own code path: this token is not a sign-in
 *  token and cannot be exchanged for one on its own. */
const TTL_MS = 90 * 24 * 60 * 60 * 1000;

function secret() {
  return `rsvp-answer:${process.env.MAIL_UNSUBSCRIBE_SECRET ?? ""}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export type RsvpTokenClaim = { personId: string; eventYear: number; issuedAt: number };

function encode(claim: RsvpTokenClaim) {
  const payload = `${claim.personId}.${claim.eventYear}.${claim.issuedAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export function readRsvpToken(token: string): RsvpTokenClaim | null {
  const parts = String(token ?? "").split(".");
  if (parts.length !== 2) return null;
  let payload: string;
  try {
    payload = Buffer.from(parts[0], "base64url").toString("utf8");
  } catch {
    return null;
  }
  const expected = Buffer.from(sign(payload));
  const got = Buffer.from(parts[1]);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  const [personId, yearRaw, issuedRaw] = payload.split(".");
  const eventYear = Number(yearRaw);
  const issuedAt = Number(issuedRaw);
  if (!personId || !Number.isFinite(eventYear) || !Number.isFinite(issuedAt)) return null;
  if (Date.now() > issuedAt + TTL_MS) return null;
  return { personId, eventYear, issuedAt };
}

/** Never issued for a memorial record, at any point, for any sequence. */
export async function issueRsvpToken(personId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("people")
    .select("id, deceased")
    .eq("id", personId)
    .maybeSingle();
  if (!data || data.deceased) return null;
  const eventYear = await currentEditionYear();
  return encode({ personId, eventYear, issuedAt: Date.now() });
}

/** The three links a drip message carries. Null for a memorial record or when
 *  no public site URL is configured. Nothing here sends anything. */
export async function rsvpAnswerLinks(personId: string, origin?: string | null) {
  const base = origin ?? siteUrl();
  if (!base) return null;
  const token = await issueRsvpToken(personId);
  if (!token) return null;
  const link = (a: RsvpStatus) => `${base}/rsvp?t=${encodeURIComponent(token)}&a=${a}`;
  return { going: link("going"), maybe: link("maybe"), not_this_year: link("not_this_year") };
}

async function logLinkEvent(
  action: "rsvp_link_opened" | "rsvp_link_confirmed",
  personId: string | null,
  after: Record<string, unknown>,
) {
  try {
    await supabaseAdmin.from("audit_log").insert({
      action,
      table_name: "rsvps",
      record_id: personId,
      after: after as never,
    });
  } catch (err) {
    console.error(`[rsvp-link] could not record ${action}: ${String(err)}`);
  }
}

export type RsvpTokenTarget = {
  ok: true;
  firstName: string;
  eventYear: number;
  currentStatus: RsvpStatus | null;
};

/** Read-only. Verifies, reads who the token is for and what they already said,
 *  and records the open so the gap between opens and confirms is visible. */
export async function loadRsvpTokenTarget(
  token: string,
  intent: string | null,
): Promise<RsvpTokenTarget | null> {
  const claim = readRsvpToken(token);
  if (!claim) return null;

  const { data: person } = await supabaseAdmin
    .from("people")
    .select("id, first_name, deceased")
    .eq("id", claim.personId)
    .maybeSingle();
  if (!person || person.deceased) return null;

  const { data: rsvp } = await supabaseAdmin
    .from("rsvps")
    .select("status")
    .eq("person_id", claim.personId)
    .eq("event_year", claim.eventYear)
    .maybeSingle();

  await logLinkEvent("rsvp_link_opened", claim.personId, {
    event_year: claim.eventYear,
    intent,
  });

  return {
    ok: true,
    firstName: person.first_name as string,
    eventYear: claim.eventYear,
    currentStatus: (rsvp?.status as RsvpStatus | null) ?? null,
  };
}

export type RsvpTokenCommit =
  | { ok: false }
  | { ok: true; status: RsvpStatus; firstName: string; signInUrl: string | null };

/** The tap. Writes the answer, verifies the address the link was mailed to
 *  (possession of the token proves inbox access) and hands back an unspent
 *  one-time sign-in link so the person lands on their own record signed in.
 *  There is never a sign-up step: the link is the account. */
export async function commitRsvpToken(
  token: string,
  rawStatus: string,
  origin: string | null,
): Promise<RsvpTokenCommit> {
  const claim = readRsvpToken(token);
  if (!claim) return { ok: false };
  if (!(RSVP_STATUSES as readonly string[]).includes(rawStatus)) return { ok: false };
  const status = rawStatus as RsvpStatus;

  const { data: person } = await supabaseAdmin
    .from("people")
    .select("id, first_name, deceased")
    .eq("id", claim.personId)
    .maybeSingle();
  if (!person || person.deceased) return { ok: false };

  const { data: existing } = await supabaseAdmin
    .from("rsvps")
    .select("id")
    .eq("person_id", claim.personId)
    .eq("event_year", claim.eventYear)
    .maybeSingle();

  if (existing) {
    // First touch wins on src: it is written at insert time only.
    const { error } = await supabaseAdmin
      .from("rsvps")
      .update({ status, responded_at: new Date().toISOString() })
      .eq("id", existing.id as string);
    if (error) return { ok: false };
  } else {
    const { error } = await supabaseAdmin.from("rsvps").insert({
      person_id: claim.personId,
      event_year: claim.eventYear,
      status,
      src: "email",
      party_size: 1,
    });
    if (error) return { ok: false };
  }

  // The address the drip would have mailed. Possession of the token verifies it.
  const { data: identities } = await supabaseAdmin
    .from("identities")
    .select("id, email, verified_at, is_primary")
    .eq("person_id", claim.personId)
    .order("is_primary", { ascending: false });

  const identity = (identities ?? [])[0] as
    | { id: string; email: string; verified_at: string | null }
    | undefined;

  if (identity && !identity.verified_at) {
    await supabaseAdmin
      .from("identities")
      .update({ verified_at: new Date().toISOString() })
      .eq("id", identity.id);
    await supabaseAdmin.rpc("promote_verified_primary", { _identity_id: identity.id }).catch?.(() => {});
  }

  let signInUrl: string | null = null;
  if (identity?.email) {
    const { sessionLinkFor } = await import("./mail.server");
    signInUrl = await sessionLinkFor(identity.email, origin ?? siteUrl());
  }

  await logLinkEvent("rsvp_link_confirmed", claim.personId, {
    event_year: claim.eventYear,
    status,
    src: "email",
    verified_identity: Boolean(identity && !identity.verified_at),
  });

  return { ok: true, status, firstName: person.first_name as string, signInUrl };
}

/** How many answer links were opened versus actually confirmed. A wide gap is
 *  the scanner signature: robots open, people confirm. */
export async function rsvpLinkTotals(): Promise<{ opened: number; confirmed: number }> {
  const count = async (action: string) => {
    const { count: n } = await supabaseAdmin
      .from("audit_log")
      .select("id", { count: "exact", head: true })
      .eq("action", action);
    return n ?? 0;
  };
  const [opened, confirmed] = await Promise.all([
    count("rsvp_link_opened"),
    count("rsvp_link_confirmed"),
  ]);
  return { opened, confirmed };
}
