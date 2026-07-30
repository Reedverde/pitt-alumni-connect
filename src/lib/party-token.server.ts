import { createHmac, timingSafeEqual } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { loadCurrentEdition } from "./editions.server";
import { normalizePartySize } from "./rsvp-types";
import { siteUrl } from "./mail.server";

/** Deliberately a different secret path and a different code path from the
 *  magic link. This token proves one thing only: that the holder may change
 *  one number on one row. It never touches auth, never mints a session and
 *  never verifies an identity. */
function secret() {
  const raw = process.env.MAIL_UNSUBSCRIBE_SECRET ?? "";
  return `party-size:${raw}`;
}

function sign(payload: string) {
  return createHmac("sha256", secret()).update(payload).digest("hex");
}

export function partySizeToken(personId: string, eventYear: number, expiresAt: number) {
  const payload = `${personId}.${eventYear}.${expiresAt}`;
  return `${Buffer.from(payload).toString("base64url")}.${sign(payload)}`;
}

export type PartyTokenClaim = { personId: string; eventYear: number };

export function readPartySizeToken(token: string): PartyTokenClaim | null {
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
  const [personId, yearRaw, expRaw] = payload.split(".");
  const eventYear = Number(yearRaw);
  const exp = Number(expRaw);
  if (!personId || !Number.isFinite(eventYear) || !Number.isFinite(exp)) return null;
  // Expires after the event. A stale link does nothing at all.
  if (Date.now() > exp) return null;
  return { personId, eventYear };
}

/** Builds the one link the headcount email carries. */
export async function partySizeLink(personId: string) {
  const base = siteUrl();
  if (!base) return null;
  const edition = await loadCurrentEdition();
  const expiresAt = Date.parse(`${edition.ends_on}T23:59:59Z`) + 86400000;
  const token = partySizeToken(personId, edition.event_year, expiresAt);
  return `${base}/api/public/headcount?t=${encodeURIComponent(token)}`;
}

/** Updates party_size and nothing else. Status is never read from the request
 *  and never written: silence and a number change are both non-events for
 *  attendance. */
export async function applyPartySizeToken(token: string, size: number) {
  const claim = readPartySizeToken(token);
  if (!claim) return { ok: false as const, reason: "invalid" as const };
  const partySize = normalizePartySize("going", size);
  const { error } = await supabaseAdmin
    .from("rsvps")
    .update({ party_size: partySize })
    .eq("person_id", claim.personId)
    .eq("event_year", claim.eventYear)
    .eq("status", "going");
  if (error) return { ok: false as const, reason: "failed" as const };
  await supabaseAdmin.from("audit_log").insert({
    action: "party_size_updated_by_token",
    table_name: "rsvps",
    record_id: claim.personId,
    after: { party_size: partySize, event_year: claim.eventYear },
  });
  return { ok: true as const, partySize };
}

/** Current heads for the token holder, so the page can open on their number. */
export async function partySizeForToken(token: string) {
  const claim = readPartySizeToken(token);
  if (!claim) return null;
  const { data } = await supabaseAdmin
    .from("rsvps")
    .select("party_size")
    .eq("person_id", claim.personId)
    .eq("event_year", claim.eventYear)
    .eq("status", "going")
    .maybeSingle();
  if (!data) return null;
  return Number(data.party_size ?? 1);
}
