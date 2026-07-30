import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nameScore } from "./fuzzy";
import { currentEditionYear } from "./editions.server";
import {
  evaluateRsvpThrottle,
  hashIp,
  recordThrottleEvent,
} from "./throttle.server";
import {
  normalizePartySize,
  RSVP_SOURCES,
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
      .limit(5000),
    supabaseAdmin.from("divisions").select("code, visible"),
  ]);

  const hidden = new Set(
    (divisionRows ?? []).filter((d) => d.visible === false).map((d) => d.code as string),
  );

  const rows = ((data ?? []) as PersonRow[]).filter(
    (p) => !(p.seed_division && hidden.has(p.seed_division)),
  );
  const scored = rows
    .map((p) => {
      const full = [p.first_name, p.last_name].filter(Boolean).join(" ");
      const score = Math.max(
        nameScore(q, full),
        nameScore(q, p.last_name ?? ""),
        nameScore(q, p.first_name),
        p.played_as ? nameScore(q, p.played_as) : 0,
      );
      return { p, score };
    })
    .filter((row) => row.score >= 0.45)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (scored.length === 0) return [];

  const ids = scored.map((s) => s.p.id);
  const [place, states] = await Promise.all([placement(ids), stateFor(ids)]);

  return Promise.all(
    scored.map(async ({ p }) => {
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
};

/** Sends the sign-in link server-side so the destination address is never
 *  disclosed to the caller. Never throws: the RSVP must not depend on it. */
async function sendMagicLink(opts: {
  to: string;
  personId: string;
  firstName: string | null;
  status: RsvpStatus | null;
  origin: string | null | undefined;
}) {
  const { sendMagicLinkEmail } = await import("./mail.server");
  await sendMagicLinkEmail({ ...opts, status: opts.status ?? "claimed" });
}

function normalizedName(first: string, last: string | null) {
  return [first, last ?? ""].join(" ").toLowerCase().replace(/\s+/g, " ").trim();
}

/** An unmatched name never creates a people row. It becomes a pending request
 *  the organizers review. No RSVP, no identity, no sign-in link yet. */
async function requestNewPerson(args: {
  firstName: string;
  lastName: string | null;
  email: string;
  status: RsvpStatus | null;
  src: RsvpSource;
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
  const src: RsvpSource = RSVP_SOURCES.includes(input.src as RsvpSource)
    ? (input.src as RsvpSource)
    : "email";
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
      .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased")
      .eq("id", input.personId)
      .maybeSingle();
    if (!data || (data as PersonRow).deceased) throw new Error("Something went wrong. Try again.");
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

  let existingIdentity: { id: string; person_id: string } | null = null;
  let effectiveStatus: RsvpStatus | null = status;

  if (verifiedOwner) {
    // No RSVP write, no identity write. Magic link goes to the address on file.
    magicLinkEmail = verifiedOwner.email;

    const { data: currentRsvp } = await supabaseAdmin
      .from("rsvps")
      .select("status")
      .eq("person_id", person.id)
      .eq("event_year", eventYear)
      .maybeSingle();
    effectiveStatus = (currentRsvp?.status as RsvpStatus | undefined) ?? null;
  } else {
    // RSVP first: the record must save whether or not the email work succeeds.
    const { data: existingRsvp } = await supabaseAdmin
      .from("rsvps")
      .select("id")
      .eq("person_id", person.id)
      .eq("event_year", eventYear)
      .maybeSingle();

    if (existingRsvp) {
      await supabaseAdmin
        .from("rsvps")
        .update({ status, src, party_size: partySize, responded_at: new Date().toISOString() })
        .eq("id", existingRsvp.id as string);
    } else {
      await supabaseAdmin
        .from("rsvps")
        .insert({ person_id: person.id, event_year: eventYear, status, src, party_size: partySize });
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
      ...(verifiedOwner ? { refused_verified_overwrite: true } : {}),
      ...(verdict.level === "soft" ? { mail_held_by_throttle: true } : {}),
    },
  });

  const { data: pl } = await supabaseAdmin
    .from("person_board_placement")
    .select("board_year, board_division")
    .eq("person_id", person.id)
    .maybeSingle();

  const boardYear = (pl?.board_year as number | null) ?? person.grad_year ?? null;

  if (verdict.level === "soft") {
    // The record is saved. The mail is held back, and the hold is visible to
    // the organizers. The caller cannot tell the difference.
    const { logSend } = await import("./mail.server");
    await logSend({
      personId: person.id,
      kind: "magic_link",
      toEmail: magicLinkEmail,
      provider: "none",
      providerMessageId: null,
      status: "throttled",
      error: `held back by the ${verdict.reason}`,
    });
  } else {
    await sendMagicLink({
      to: magicLinkEmail,
      personId: person.id,
      firstName: person.first_name,
      status: effectiveStatus,
      origin: input.origin,
    });
  }

  return {
    ok: true,
    outcome: "recorded",
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
            : verifiedOwner
              ? "claimed"
              : "unclaimed",
    },
  };
}
