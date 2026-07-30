import { createHash } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { nameScore } from "./fuzzy";
import {
  EVENT_YEAR,
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

function hashIp(ip: string) {
  return createHash("sha256").update(`pitt-alumni:${ip}`).digest("hex").slice(0, 32);
}

/** Max 10 submissions per IP per hour, counted off audit_log. */
export async function overRateLimit(ip: string) {
  const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count } = await supabaseAdmin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "rsvp_signup")
    .gte("created_at", since)
    .eq("after->>ip_hash", hashIp(ip));
  return (count ?? 0) >= 10;
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
  const [rsvpRes, identRes] = await Promise.all([
    supabaseAdmin.from("rsvps").select("person_id, status").eq("event_year", EVENT_YEAR).in("person_id", personIds),
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

  const { data } = await supabaseAdmin
    .from("people")
    .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased")
    .eq("deceased", false)
    .limit(5000);

  const rows = (data ?? []) as PersonRow[];
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
  status: RsvpStatus;
  email: string;
  src?: RsvpSource | null;
};

/** Public write endpoint: creates or updates the RSVP before the person has
 *  authenticated. Every outcome returns the same shape; existence of an email
 *  or a person is never disclosed. */
export async function submitRsvpServer(input: SubmitInput, ip: string): Promise<RsvpResult> {
  const status = input.status;
  if (!RSVP_STATUSES.includes(status)) throw new Error("Something went wrong. Try again.");
  const src: RsvpSource = RSVP_SOURCES.includes(input.src as RsvpSource)
    ? (input.src as RsvpSource)
    : "email";
  if (!isValidEmail(input.email)) throw new Error("That email doesn't look right.");
  const email = input.email.trim().toLowerCase();

  if (await overRateLimit(ip)) throw new Error("Something went wrong. Try again later.");

  let person: PersonRow | null = null;

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

    const { data: maxRow } = await supabaseAdmin
      .from("people")
      .select("member_no")
      .order("member_no", { ascending: false })
      .limit(1)
      .maybeSingle();
    const memberNo = ((maxRow?.member_no as number | undefined) ?? 0) + 1;

    const { data: created, error } = await supabaseAdmin
      .from("people")
      .insert({
        member_no: memberNo,
        first_name: firstName,
        last_name: lastName,
        needs_review: true,
        show_on_board: true,
      })
      .select("id, first_name, last_name, played_as, grad_year, seed_division, deceased")
      .single();
    if (error || !created) throw new Error("Something went wrong. Try again.");
    person = created as PersonRow;
  }

  // RSVP first: the record must save whether or not the email work succeeds.
  const { data: existingRsvp } = await supabaseAdmin
    .from("rsvps")
    .select("id")
    .eq("person_id", person.id)
    .eq("event_year", EVENT_YEAR)
    .maybeSingle();

  if (existingRsvp) {
    await supabaseAdmin
      .from("rsvps")
      .update({ status, src, responded_at: new Date().toISOString() })
      .eq("id", existingRsvp.id as string);
  } else {
    await supabaseAdmin
      .from("rsvps")
      .insert({ person_id: person.id, event_year: EVENT_YEAR, status, src });
  }

  // Identity: if this email is already on file (for anyone), leave it alone.
  const { data: existingIdentity } = await supabaseAdmin
    .from("identities")
    .select("id, person_id")
    .eq("email", email)
    .maybeSingle();

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

  await supabaseAdmin.from("audit_log").insert({
    action: "rsvp_signup",
    table_name: "rsvps",
    record_id: person.id,
    after: {
      status,
      src,
      ip_hash: hashIp(ip),
      email_domain: email.split("@")[1] ?? null,
      matched_existing_email: Boolean(existingIdentity),
      matched_other_person: Boolean(existingIdentity && existingIdentity.person_id !== person.id),
    },
  });

  const { data: pl } = await supabaseAdmin
    .from("person_board_placement")
    .select("board_year, board_division")
    .eq("person_id", person.id)
    .maybeSingle();

  const boardYear = (pl?.board_year as number | null) ?? person.grad_year ?? null;

  return {
    ok: true,
    person: {
      first_name: person.first_name,
      last_name: person.last_name,
      board_year: boardYear,
      team_label: await teamLabel(
        (pl?.board_division as string | null) ?? person.seed_division ?? null,
        boardYear,
      ),
      state: status === "going" ? "going" : status === "maybe" ? "maybe" : "unclaimed",
    },
  };
}