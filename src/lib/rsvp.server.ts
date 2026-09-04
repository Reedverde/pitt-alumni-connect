import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nameScore, nameScoreWithNicknames } from "./fuzzy";
import { rankMatches } from "./name-match";
import { currentEditionYear } from "./editions.server";
import {
  evaluateRsvpThrottle,
  hashIp,
  recordThrottleEvent,
} from "./throttle.server";
import {
  normalizePartySize,
  normalizeRsvpSource,
  RSVP_STATUSES,
  type PersonMatch,
  type RsvpResult,
  type RsvpStatus,
  type RsvpSource,
} from "./rsvp-types";

type TeamName = { division: string; name: string | null; start_year: number | null; end_year: number | null };

let teamNamesCache: TeamName[] | null = null;

async function teamNames() {
  if (teamNamesCache) return teamNamesCache;
  const { data } = await supabaseAdmin.from("team_names").select("division, name, start_year, end_year");
  teamNamesCache = (data ?? []) as TeamName[];
  return teamNamesCache;
}

export async function teamLabel(division: string | null, year: number | null) {
  if (!division || !year) return null;
  const rows = await teamNames();
  const hit = rows.find(
    (t) =>
      t.division === division &&
      year >= (t.start_year ?? -100000) &&
      year <= (t.end_year ?? 100000),
  );
  return hit?.name ?? null;
}

export function isValidEmail(value: unknown): value is string {
  return (
    typeof value === "string" &&
    value.length <= 254 &&
    /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim())
  );
}

export function cleanName(value: unknown, max = 80) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

type PersonRow = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  grad_year: number | null;
  seed_division: string | null;
  deceased: boolean;
};

/** Marks a people row as created by the anonymous RSVP endpoint. The row stays
 *  off the board until the email behind it is verified; the marker is cleared
 *  at that moment so an admin can hide the chip again permanently. */
export const SELF_ADDED_SEED_PREFIX = "selfadd:";

async function placement(personIds: string[]) {
  const { data } = await supabaseAdmin
    .from("person_board_placement")
    .select("person_id, board_year, board_division")
    .in("person_id", personIds);
  const map = new Map<string, { board_year: number | null; board_division: string | null }>();
  for (const row of data ?? []) {
    map.set(row.person_id as string, {
      board_year: row.board_year as number | null,
      board_division: row.board_division as string | null,
    });
  }
  return map;
}

async function stateFor(personIds: string[]) {
  const eventYear = await currentEditionYear();
  const [rsvpRes, identRes] = await Promise.all([
    supabaseAdmin.from("rsvps").select("person_id, status").eq("event_year", eventYear).in("person_id", personIds),
    supabaseAdmin.from("identities").select("person_id, verified_at").in("person_id", personIds),
  ]);
  const rsvp = new Map<string, string>();
  for (const r of rsvpRes.data ?? []) rsvp.set(r.person_id as string, r.status as string);
  const verified = new Set<string>();
  for (const i of identRes.data ?? []) if (i.verified_at) verified.add(i.person_id as string);
  return { rsvp, verified };
}

function resolveState(
  deceased: boolean,
  status: string | undefined,
  verified: boolean,
): PersonMatch["state"] {
  if (deceased) return "memorial";
  if (status === "going") return "going";
  if (status === "maybe") return "maybe";
  if (verified) return "claimed";
  return "unclaimed";
}

async function yearsLabel(personId: string, fallbackYear: number | null) {
  const { data } = await supabaseAdmin.from("stints").select("year").eq("person_id", personId);
  const years = (data ?? []).map((s) => s.year as number).sort((a, b) => a - b);
  if (years.length === 0) return fallbackYear ? `Class of ${fallbackYear}` : null;
  if (years.length === 1) return String(years[0]);
  return `${years[0]}–${years[years.length - 1]}`;
}

/** Fuzzy match against living people only. Includes show_on_board = false so
 *  records with no grad year can still claim themselves. */
export async function searchPeopleServer(query: string): Promise<PersonMatch[]> {
  const q = cleanName(query);
  if (q.length < 2) return [];

  const [{ data }, { data: divisionRows }] = await Promise.all([
    supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased")
      .eq("deceased", false)
      .eq("archived", false)
      .limit(5000),
    supabaseAdmin.from("divisions").select("code, visible"),
  ]);

  const hidden = new Set(
    (divisionRows ?? []).filter((d) => d.visible === false).map((d) => d.code as string),
  );

  const rows = ((data ?? []) as PersonRow[]).filter(
    (p) => !(p.seed_division && hidden.has(p.seed_division)),
  );
  // Three tiers, in order: direct, nickname equivalence, fuzzy. Rows here are
  // already living people only, so no memorial record can reach any tier.
  const ranked = rankMatches(q, rows).slice(0, 6);
  const scored = ranked
    .map(({ item, tier }) => {
      const full = [item.first_name, item.last_name].filter(Boolean).join(" ");
      return {
        p: item,
        tier,
        score: Math.max(
          nameScoreWithNicknames(q, full),
          nameScore(q, item.last_name ?? ""),
          nameScoreWithNicknames(q, item.first_name),
          item.played_as ? nameScore(q, item.played_as) : 0,
        ),
      };
    })
    // Tiers never interleave; score only breaks ties inside a tier.
    .sort((a, b) => a.tier - b.tier || b.score - a.score);

  if (scored.length === 0) return [];

  const ids = scored.map((s) => s.p.id);
  const [place, states] = await Promise.all([placement(ids), stateFor(ids)]);

  return Promise.all(
    scored.map(async ({ p, tier }) => {
      const pl = place.get(p.id);
      const boardYear = pl?.board_year ?? p.grad_year ?? null;
      const division = pl?.board_division ?? p.seed_division ?? null;
      return {
        id: p.id,
        first_name: p.first_name,
        last_name: p.last_name,
        played_as: p.played_as,
        board_year: boardYear,
        team_label: await teamLabel(division, boardYear),
        years_label: await yearsLabel(p.id, p.grad_year),
        state: resolveState(p.deceased, states.rsvp.get(p.id), states.verified.has(p.id)),
        tier,
      } satisfies PersonMatch;
    }),
  );
}

export type SubmitInput = {
  personId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  /** Mandatory. The claim cannot be completed without an answer. */
  status: RsvpStatus;
  /** Heads including the person. Ignored unless the status is "going". */
  partySize?: number | null;
  email: string;
  src?: RsvpSource | null;
  origin?: string | null;
  /** Set by the claim flow, which has just sent this address a sign in link.
   *  The answer is still recorded; only the second email is skipped. */
  skipConfirmationEmail?: boolean | null;
};


/** The RSVP confirmation. It carries a sign-in link, but it is NOT the sign-in
 *  magic link: it is triggered by answering, not by asking to sign in, so it is
 *  refused at the choke point while outbound email is paused.
 *
 *  Guarded to one confirmation per person, per edition, per status change. The
 *  guard row is claimed before the send so two concurrent submissions cannot
 *  both get through, and released again if the send never left the building. */
async function sendRsvpConfirmation(opts: {
  to: string;
  personId: string;
  firstName: string | null;
  status: RsvpStatus | null;
  origin: string | null | undefined;
  eventYear: number;
}) {
  const guardStatus = opts.status ?? "claimed";
  const { error: claimError } = await supabaseAdmin.from("confirmation_sends").insert({
    person_id: opts.personId,
    event_year: opts.eventYear,
    status: guardStatus,
  });
  // Unique violation: this person already had a confirmation for this answer in
  // this edition. Nothing changed, so nothing is sent.
  if (claimError) return;

  const { sendMagicLinkEmail } = await import("./mail.server");
  const result = await sendMagicLinkEmail({
    to: opts.to,
    personId: opts.personId,
    firstName: opts.firstName,
    status: guardStatus,
    origin: opts.origin,
    kind: "rsvp_confirmation",
  });

  if (!result.sent) {
    await supabaseAdmin
      .from("confirmation_sends")
      .delete()
      .eq("person_id", opts.personId)
      .eq("event_year", opts.eventYear)
      .eq("status", guardStatus);
  }
}

function normalizedName(first: string, last: string | null) {
  return [first, last ?? ""].join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

/** Every non-success branch of the RSVP path leaves a trace. Logging must never
 *  be the reason a submission fails, so it swallows its own errors only. */
export async function logRsvpEvent(
  action: string,
  personId: string | null,
  after: Record<string, unknown>,
) {
  console.error(`[rsvp] ${action} ${personId ?? "unknown"} ${JSON.stringify(after)}`);
  try {
    await supabaseAdmin.from("audit_log").insert({
      action,
      table_name: "rsvps",
      record_id: personId,
      after: after as never,
    });
  } catch (err) {
    console.error(`[rsvp] could not record ${action}: ${String(err)}`);
  }
}

/** An unmatched name never creates a people row. It becomes a pending request
 *  the organizers review. The answer and the email are still captured, and a
 *  sign-in link still goes out: a decline is a signup too. */
async function requestNewPerson(args: {
  firstName: string;
  lastName: string | null;
  email: string;
  status: RsvpStatus | null;
  partySize: number;
  src: RsvpSource | null;
  ipHash: string;
  origin: string | null | undefined;
}): Promise<RsvpResult> {
  const { data: preapproved } = await supabaseAdmin
    .from("preapproved_emails")
    .select("email")
    .eq("email", args.email)
    .maybeSingle();

  const payload = {
    first_name: args.firstName,
    last_name: args.lastName,
    email: args.email,
    requested_status: args.status,
    party_size: args.partySize,
    src: args.src,
    ip_hash: args.ipHash,
    ...(preapproved ? { preapproved: true } : {}),
  };

  const { data: existing } = await supabaseAdmin
    .from("suggestions")
    .select("id, payload")
    .eq("type", "new_person")
    .eq("status", "pending")
    .eq("payload->>email", args.email)
    .limit(50);

  const key = normalizedName(args.firstName, args.lastName);
  const dupe = (existing ?? []).find((row) => {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    return (
      normalizedName(
        typeof p.first_name === "string" ? p.first_name : "",
        typeof p.last_name === "string" ? p.last_name : null,
      ) === key
    );
  });

  if (dupe) {
    await supabaseAdmin.from("suggestions").update({ payload }).eq("id", dupe.id as string);
  } else {
    await supabaseAdmin
      .from("suggestions")
      .insert({ type: "new_person", status: "pending", submitted_by: null, payload });
  }

  await supabaseAdmin.from("audit_log").insert({
    action: "rsvp_new_person_request",
    table_name: "suggestions",
    record_id: null,
    after: {
      status: args.status,
      src: args.src,
      ip_hash: args.ipHash,
      email_domain: args.email.split("@")[1] ?? null,
      preapproved: Boolean(preapproved),
      deduplicated: Boolean(dupe),
    },
  });

  const { notifyAdminsOfPendingSuggestions } = await import("./admin-notify.server");
  await notifyAdminsOfPendingSuggestions(args.origin);

  // The email they typed is the contact record, whatever they answered. The
  // link verifies it and creates the session, exactly as for a matched name.
  // Mail must never throw: the request is already filed.
  try {
    const { sendMagicLinkEmail } = await import("./mail.server");
    await sendMagicLinkEmail({
      to: args.email,
      personId: null,
      firstName: args.firstName,
      status: args.status ?? "",
      origin: args.origin,
      kind: "magic_link",
    });
  } catch (err) {
    console.error(`[rsvp] new-person sign-in link failed: ${String(err)}`);
  }

  return { ok: true, outcome: "review_requested", person: null };
}

/** Public write endpoint: creates or updates the RSVP before the person has
 *  authenticated. Every outcome returns the same shape; existence of an email
 *  or a person is never disclosed. */
export async function submitRsvpServer(input: SubmitInput, ip: string): Promise<RsvpResult> {
  // The answer is mandatory. No status, no record.
  const status = input.status as RsvpStatus;
  if (!RSVP_STATUSES.includes(status)) throw new Error("Please pick an answer.");
  const partySize = normalizePartySize(status, input.partySize ?? 1);
  // Unknown or absent means NULL. An invalid source never blocks the answer.
  const src: RsvpSource | null = normalizeRsvpSource(input.src);
  if (!isValidEmail(input.email)) throw new Error("That email doesn't look right.");
  const email = input.email.trim().toLowerCase();

  const ipHash = hashIp(ip);
  const verdict = await evaluateRsvpThrottle(ipHash, email);
  if (verdict.level === "hard") throw new Error("Something went wrong. Try again later.");

  // Every accepted submission counts on all three dimensions.
  await Promise.all([
    recordThrottleEvent("rsvp_ip", ipHash),
    recordThrottleEvent("rsvp_email", email),
    recordThrottleEvent("rsvp_global", "all"),
  ]);

  const eventYear = await currentEditionYear();

  let person: PersonRow | null = null;
  let magicLinkEmail = email;

  if (input.personId) {
    const { data } = await supabaseAdmin
      .from("people")
      .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased, archived")
      .eq("id", input.personId)
      .maybeSingle();
    // Archived records are folded into a survivor; nobody may claim or be
    // mailed through one.
    if (!data || (data as PersonRow).deceased || (data as { archived?: boolean }).archived)
      throw new Error("Something went wrong. Try again.");
    person = data as PersonRow;
  } else {
    const firstName = cleanName(input.firstName);
    const lastName = cleanName(input.lastName) || null;
    if (!firstName) throw new Error("Please enter your name.");
    return requestNewPerson({
      firstName,
      lastName,
      email,
      status,
      partySize,
      src,
      ipHash,
      origin: input.origin,
    });
  }

  // A person whose email is already verified owns their own RSVP. An anonymous
  // caller may not overwrite it, and must not be able to tell that it refused.
  const { data: verifiedIdentities } = await supabaseAdmin
    .from("identities")
    .select("id, email, is_primary, verified_at")
    .eq("person_id", person.id)
    .not("verified_at", "is", null)
    .order("is_primary", { ascending: false });

  const verifiedOwner = (verifiedIdentities ?? [])[0] as
    | { id: string; email: string; is_primary: boolean }
    | undefined;

  // The caller is the owner only when the address they typed is itself one of
  // the verified addresses on this record.
  const ownedByCaller = (verifiedIdentities ?? []).some(
    (i) => String((i as { email: string }).email).trim().toLowerCase() === email,
  );

  if (verifiedOwner && !ownedByCaller) {
    // Nothing is written. This must never look like success.
    await logRsvpEvent("rsvp_refused_unverified_email", person.id, {
      status,
      email_domain: email.split("@")[1] ?? null,
      ip_hash: ipHash,
    });
    return { ok: false, outcome: "sign_in_required", written: false, rsvp: null, person: null };
  }

  let existingIdentity: { id: string; person_id: string } | null = null;
  const effectiveStatus: RsvpStatus | null = status;

  {
    // RSVP first: the record must save whether or not the email work succeeds.
    const { data: existingRsvp } = await supabaseAdmin
      .from("rsvps")
      .select("id")
      .eq("person_id", person.id)
      .eq("event_year", eventYear)
      .maybeSingle();

    if (existingRsvp) {
      const { error } = await supabaseAdmin
        .from("rsvps")
        // First touch wins: src is written at insert time only, never on a change.
        .update({ status, party_size: partySize, responded_at: new Date().toISOString() })
        .eq("id", existingRsvp.id as string);
      if (error) {
        await logRsvpEvent("rsvp_write_failed", person.id, { op: "update", error: error.message });
        throw new Error("We could not save your answer. Nothing was recorded, please try again.");
      }
    } else {
      const { error } = await supabaseAdmin
        .from("rsvps")
        .insert({ person_id: person.id, event_year: eventYear, status, src, party_size: partySize });
      if (error) {
        await logRsvpEvent("rsvp_write_failed", person.id, { op: "insert", error: error.message });
        throw new Error("We could not save your answer. Nothing was recorded, please try again.");
      }
    }

    // Identity: if this email is already on file (for anyone), leave it alone.
    const { data: found } = await supabaseAdmin
      .from("identities")
      .select("id, person_id")
      .eq("email", email)
      .maybeSingle();
    existingIdentity = (found as { id: string; person_id: string } | null) ?? null;

    if (!existingIdentity) {
      const { count } = await supabaseAdmin
        .from("identities")
        .select("id", { count: "exact", head: true })
        .eq("person_id", person.id);
      await supabaseAdmin.from("identities").insert({
        person_id: person.id,
        email,
        provider: "magic",
        is_primary: (count ?? 0) === 0,
      });
    }
  }

  // Read the row back. No row, no success, no stamp.
  const { data: persisted, error: readBackError } = await supabaseAdmin
    .from("rsvps")
    .select("id, status, party_size, responded_at")
    .eq("person_id", person.id)
    .eq("event_year", eventYear)
    .maybeSingle();

  if (readBackError || !persisted) {
    await logRsvpEvent("rsvp_write_failed", person.id, {
      op: "read_back",
      error: readBackError?.message ?? "no row after write",
    });
    throw new Error("We could not save your answer. Nothing was recorded, please try again.");
  }

  await supabaseAdmin.from("audit_log").insert({
    action: "rsvp_signup",
    table_name: "rsvps",
    record_id: person.id,
    after: {
      status,
      party_size: partySize,
      src,
      ip_hash: hashIp(ip),
      email_domain: email.split("@")[1] ?? null,
      matched_existing_email: Boolean(existingIdentity),
      matched_other_person: Boolean(existingIdentity && existingIdentity.person_id !== person.id),
      rsvp_id: persisted.id,
      ...(verdict.level === "soft" ? { mail_held_by_throttle: true } : {}),
    },
  });

  const { data: pl } = await supabaseAdmin
    .from("person_board_placement")
    .select("board_year, board_division")
    .eq("person_id", person.id)
    .maybeSingle();

  const boardYear = (pl?.board_year as number | null) ?? person.grad_year ?? null;

  if (input.skipConfirmationEmail === true) {
    // The claim step already sent this address its sign in link a moment ago.
    // One message, not two. The answer above is written either way.
    const { logSend } = await import("./mail.server");
    await logSend({
      personId: person.id,
      kind: "rsvp_confirmation",
      toEmail: magicLinkEmail,
      provider: "none",
      providerMessageId: null,
      status: "blocked",
      error: "not sent: the claim step already sent this address a sign in link",
    });
  } else if (verdict.level === "soft") {
    // The record is saved. The mail is held back, and the hold is visible to
    // the organizers. The caller cannot tell the difference.
    const { logSend } = await import("./mail.server");
    await logSend({
      personId: person.id,
      kind: "rsvp_confirmation",
      toEmail: magicLinkEmail,
      provider: "none",
      providerMessageId: null,
      status: "throttled",
      error: `held back by the ${verdict.reason}`,
    });
  } else {
    await sendRsvpConfirmation({
      to: magicLinkEmail,
      personId: person.id,
      firstName: person.first_name,
      status: effectiveStatus,
      origin: input.origin,
      eventYear,
    });
  }


  return {
    ok: true,
    outcome: "recorded",
    written: true,
    rsvp: {
      id: persisted.id as string,
      status: persisted.status as RsvpStatus,
      party_size: (persisted.party_size as number | null) ?? 1,
      responded_at: (persisted.responded_at as string | null) ?? null,
    },
    person: {
      first_name: person.first_name,
      last_name: person.last_name,
      board_year: boardYear,
      team_label: await teamLabel(
        (pl?.board_division as string | null) ?? person.seed_division ?? null,
        boardYear,
      ),
      state:
        effectiveStatus === "going"
          ? "going"
          : effectiveStatus === "maybe"
            ? "maybe"
            : "unclaimed",
    },
  };
}

// --------------------------------------------------------------- claim flow
//
// Claiming a profile and answering the annual RSVP are separate acts. Nothing
// below writes an rsvps row: someone who claims and stops is genuinely
// unanswered, and the organizers' "no response" count says so.

import type {
  ClaimPerson,
  ClaimResult,
  DivisionOption,
  MissingPersonInput,
  MissingPersonResult,
  RosterCorrectionInput,
} from "./claim-types";

async function divisionLabel(code: string | null) {
  if (!code) return null;
  const { data } = await supabaseAdmin
    .from("divisions")
    .select("label")
    .eq("code", code)
    .maybeSingle();
  return (data?.label as string | null) ?? null;
}

export async function listDivisionsServer(): Promise<DivisionOption[]> {
  const { data } = await supabaseAdmin
    .from("divisions")
    .select("code, label, sort_order, visible")
    .eq("visible", true)
    .order("sort_order");
  return (data ?? []).map((d) => ({ code: d.code as string, label: d.label as string }));
}

/** The public face of a claimed record: the same facts the board already shows,
 *  plus the roster fields we ask the person to confirm. Never an email. */
async function claimPersonView(person: PersonRow): Promise<ClaimPerson> {
  const { data: pl } = await supabaseAdmin
    .from("person_board_placement")
    .select("board_year, board_division")
    .eq("person_id", person.id)
    .maybeSingle();

  const boardYear = (pl?.board_year as number | null) ?? person.grad_year ?? null;
  const division = (pl?.board_division as string | null) ?? person.seed_division ?? null;

  return {
    id: person.id,
    first_name: person.first_name,
    last_name: person.last_name,
    played_as: person.played_as,
    board_year: boardYear,
    team_label: await teamLabel(division, boardYear),
    years_label: await yearsLabel(person.id, person.grad_year),
    grad_year: person.grad_year,
    division,
    division_label: await divisionLabel(division),
  };
}

/** Attaches an address to an existing record and sends the sign in link. No
 *  attendance answer is asked for, implied, or written. */
export async function submitClaimServer(
  input: { personId: string; email: string; src?: RsvpSource | null; origin?: string | null },
  ip: string,
): Promise<ClaimResult> {
  if (!isValidEmail(input.email)) throw new Error("That email doesn't look right.");
  const email = input.email.trim().toLowerCase();
  const src: RsvpSource | null = normalizeRsvpSource(input.src);

  const ipHash = hashIp(ip);
  const verdict = await evaluateRsvpThrottle(ipHash, email);
  if (verdict.level === "hard") throw new Error("Something went wrong. Try again later.");
  await Promise.all([
    recordThrottleEvent("rsvp_ip", ipHash),
    recordThrottleEvent("rsvp_email", email),
    recordThrottleEvent("rsvp_global", "all"),
  ]);

  const { data } = await supabaseAdmin
    .from("people")
    .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased, archived")
    .eq("id", input.personId)
    .maybeSingle();
  if (!data || (data as PersonRow).deceased || (data as { archived?: boolean }).archived)
    throw new Error("Something went wrong. Try again.");
  const person = data as PersonRow;

  // A record with a verified owner may only be claimed again from one of its
  // own verified addresses. Nothing is written otherwise, and the refusal must
  // not disclose which address that is.
  const { data: verifiedIdentities } = await supabaseAdmin
    .from("identities")
    .select("id, email, is_primary, verified_at")
    .eq("person_id", person.id)
    .not("verified_at", "is", null)
    .order("is_primary", { ascending: false });

  const verifiedOwner = (verifiedIdentities ?? [])[0];
  const ownedByCaller = (verifiedIdentities ?? []).some(
    (i) => String((i as { email: string }).email).trim().toLowerCase() === email,
  );

  if (verifiedOwner && !ownedByCaller) {
    await logRsvpEvent("claim_refused_unverified_email", person.id, {
      email_domain: email.split("@")[1] ?? null,
      ip_hash: ipHash,
    });
    return { ok: false, outcome: "sign_in_required", person: null };
  }

  // If this address is already on file for anyone, leave it exactly as it is.
  const { data: found } = await supabaseAdmin
    .from("identities")
    .select("id, person_id")
    .eq("email", email)
    .maybeSingle();
  const existingIdentity = (found as { id: string; person_id: string } | null) ?? null;

  if (!existingIdentity) {
    const { count } = await supabaseAdmin
      .from("identities")
      .select("id", { count: "exact", head: true })
      .eq("person_id", person.id);
    const { error } = await supabaseAdmin.from("identities").insert({
      person_id: person.id,
      email,
      provider: "magic",
      is_primary: (count ?? 0) === 0,
    });
    if (error) {
      await logRsvpEvent("claim_write_failed", person.id, { error: error.message });
      throw new Error("We could not save that. Nothing was recorded, please try again.");
    }
  }

  await supabaseAdmin.from("audit_log").insert({
    action: "profile_claimed",
    table_name: "identities",
    record_id: person.id,
    after: {
      src,
      ip_hash: ipHash,
      email_domain: email.split("@")[1] ?? null,
      matched_existing_email: Boolean(existingIdentity),
      matched_other_person: Boolean(existingIdentity && existingIdentity.person_id !== person.id),
      ...(verdict.level === "soft" ? { mail_held_by_throttle: true } : {}),
    },
  });

  // Mail must never throw: the claim is already recorded.
  if (verdict.level === "soft") {
    const { logSend } = await import("./mail.server");
    await logSend({
      personId: person.id,
      kind: "magic_link",
      toEmail: email,
      provider: "none",
      providerMessageId: null,
      status: "throttled",
      error: `held back by the ${verdict.reason}`,
    });
  } else {
    try {
      const { sendMagicLinkEmail } = await import("./mail.server");
      await sendMagicLinkEmail({
        to: email,
        personId: person.id,
        firstName: person.first_name,
        status: "claimed",
        origin: input.origin,
        kind: "magic_link",
      });
    } catch (err) {
      console.error(`[claim] sign-in link failed: ${String(err)}`);
    }
  }

  return { ok: true, outcome: "claimed", person: await claimPersonView(person) };
}

function boundedYear(value: unknown): number | null {
  const n = Math.round(Number(value));
  if (!Number.isFinite(n) || n < 1970 || n > 2100) return null;
  return n;
}

/** A name that is not on the board never creates a people row. It becomes a
 *  pending request carrying everything the person could tell us, so the
 *  organizers can place them without writing back and forth. No RSVP is
 *  requested here and none is created on approval. */
export async function submitMissingPersonServer(
  input: MissingPersonInput,
  ip: string,
): Promise<MissingPersonResult> {
  const firstName = cleanName(input.firstName);
  const lastName = cleanName(input.lastName) || null;
  if (!firstName) throw new Error("Please enter a first name.");
  if (!isValidEmail(input.email)) throw new Error("That email doesn't look right.");
  const email = input.email.trim().toLowerCase();

  const ipHash = hashIp(ip);
  const verdict = await evaluateRsvpThrottle(ipHash, email);
  if (verdict.level === "hard") throw new Error("Something went wrong. Try again later.");
  await Promise.all([
    recordThrottleEvent("rsvp_ip", ipHash),
    recordThrottleEvent("rsvp_email", email),
    recordThrottleEvent("rsvp_global", "all"),
  ]);

  const playedAs = cleanName(input.playedAs) || null;
  const division = typeof input.division === "string" && input.division.trim()
    ? input.division.trim().slice(0, 40)
    : null;
  const startYear = boundedYear(input.startYear);
  const endYear = boundedYear(input.endYear);
  const gradYear = boundedYear(input.gradYear);
  const note = typeof input.note === "string" ? input.note.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  const src = normalizeRsvpSource(input.src);

  const { data: preapproved } = await supabaseAdmin
    .from("preapproved_emails")
    .select("email")
    .eq("email", email)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    first_name: firstName,
    last_name: lastName,
    played_as: playedAs,
    division,
    division_unsure: division === null,
    start_year: startYear,
    end_year: endYear,
    years_unsure: Boolean(input.yearsUnsure) || (startYear === null && endYear === null),
    grad_year: gradYear,
    email,
    note: note || null,
    src,
    ip_hash: ipHash,
    source_flow: "missing_person",
    ...(startYear !== null ? { stint_year: startYear } : {}),
    ...(preapproved ? { preapproved: true } : {}),
  };

  const { data: existing } = await supabaseAdmin
    .from("suggestions")
    .select("id, payload")
    .eq("type", "new_person")
    .eq("status", "pending")
    .eq("payload->>email", email)
    .limit(50);

  const key = normalizedName(firstName, lastName);
  const dupe = (existing ?? []).find((row) => {
    const p = (row.payload ?? {}) as Record<string, unknown>;
    return (
      normalizedName(
        typeof p.first_name === "string" ? p.first_name : "",
        typeof p.last_name === "string" ? p.last_name : null,
      ) === key
    );
  });

  if (dupe) {
    await supabaseAdmin.from("suggestions").update({ payload: payload as never }).eq("id", dupe.id as string);
  } else {
    const { error } = await supabaseAdmin
      .from("suggestions")
      .insert({ type: "new_person", status: "pending", submitted_by: null, payload: payload as never });
    if (error) {
      await logRsvpEvent("missing_person_write_failed", null, { error: error.message });
      throw new Error("We could not send that to the organizers. Please try again.");
    }
  }

  await supabaseAdmin.from("audit_log").insert({
    action: "missing_person_request",
    table_name: "suggestions",
    record_id: null,
    after: {
      src,
      ip_hash: ipHash,
      email_domain: email.split("@")[1] ?? null,
      preapproved: Boolean(preapproved),
      deduplicated: Boolean(dupe),
      has_division: division !== null,
      has_years: startYear !== null || endYear !== null,
      has_grad_year: gradYear !== null,
    },
  });

  try {
    const { notifyAdminsOfPendingSuggestions } = await import("./admin-notify.server");
    await notifyAdminsOfPendingSuggestions(input.origin);
  } catch (err) {
    console.error(`[missing-person] admin notice failed: ${String(err)}`);
  }

  // The address they typed is their contact record either way. The link
  // verifies it, so it is already proven by the time an organizer approves.
  try {
    const { sendMagicLinkEmail } = await import("./mail.server");
    await sendMagicLinkEmail({
      to: email,
      personId: null,
      firstName,
      status: "requested",
      origin: input.origin,
      kind: "magic_link",
    });
  } catch (err) {
    console.error(`[missing-person] sign-in link failed: ${String(err)}`);
  }

  return { ok: true, outcome: "review_requested" };
}

/** A correction to the roster facts shown during a claim. Filed as an edit for
 *  review; the record itself is never changed from here. */
export async function submitRosterCorrectionServer(
  input: RosterCorrectionInput,
  ip: string,
): Promise<{ ok: boolean }> {
  const { data } = await supabaseAdmin
    .from("people")
    .select("id, grad_year, played_as, seed_division, archived, deceased")
    .eq("id", input.personId)
    .maybeSingle();
  if (!data || (data as { archived?: boolean }).archived || (data as { deceased?: boolean }).deceased)
    throw new Error("Something went wrong. Try again.");

  const fields: Record<string, unknown> = {};
  const gradYear = boundedYear(input.gradYear);
  if (gradYear !== null && gradYear !== (data.grad_year as number | null)) fields.grad_year = gradYear;
  const playedAs = cleanName(input.playedAs) || null;
  if (playedAs && playedAs !== (data.played_as as string | null)) fields.played_as = playedAs;
  const division =
    typeof input.division === "string" && input.division.trim() ? input.division.trim().slice(0, 40) : null;
  if (division && division !== (data.seed_division as string | null)) fields.seed_division = division;

  const note = typeof input.note === "string" ? input.note.replace(/\s+/g, " ").trim().slice(0, 500) : "";
  if (Object.keys(fields).length === 0 && !note) return { ok: true };

  const sourceFlow =
    typeof input.source === "string" && input.source.trim()
      ? input.source.trim().slice(0, 40)
      : "claim_roster_facts";

  const { data: inserted, error } = await supabaseAdmin
    .from("suggestions")
    .insert({
      type: "edit",
      status: "pending",
      submitted_by: null,
      payload: {
        person_id: input.personId,
        fields,
        note: note || null,
        source_flow: sourceFlow,
        ip_hash: hashIp(ip),
      } as never,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    await logRsvpEvent("roster_correction_failed", input.personId, { error: error.message });
    throw new Error("We could not send that to the organizers. Please try again.");
  }

  await supabaseAdmin.from("audit_log").insert({
    action: "claim_roster_correction",
    table_name: "suggestions",
    record_id: input.personId,
    after: { fields: fields as never, has_note: Boolean(note) },
  });

  // A correction means they read their facts: reviewed, but explicitly not
  // confirmed until an organizer applies it.
  const { recordProfileReview } = await import("./profile-review.server");
  await recordProfileReview({
    personId: input.personId,
    outcome: "correction_pending",
    source: sourceFlow,
    suggestionId: (inserted?.id as string | undefined) ?? null,
  });

  return { ok: true };
}

/** The person pressed "Looks right" after seeing their permanent roster facts
 *  in the claim flow. Only accepted when the address they just claimed with is
 *  actually on that record: a review is an act by the person, not a POST. */
export async function confirmRosterFactsServer(input: {
  personId: string;
  email: string;
}): Promise<{ ok: boolean }> {
  const email = String(input.email ?? "").trim().toLowerCase();
  const personId = String(input.personId ?? "");
  if (!personId || !email) return { ok: false };

  const { data: identity } = await supabaseAdmin
    .from("identities")
    .select("id")
    .eq("person_id", personId)
    .eq("email", email)
    .maybeSingle();
  if (!identity) return { ok: false };

  const { recordProfileReview } = await import("./profile-review.server");
  await recordProfileReview({ personId, outcome: "confirmed", source: "claim_roster_facts" });
  return { ok: true };
}

