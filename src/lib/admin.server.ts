import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";
import { nameScore, normalize, surnameGate } from "./fuzzy";
import { normalizeRsvpSource, rsvpSourceLabel } from "./rsvp-src";
import { SITE_ORIGIN } from "./site-url";
import { teamLabel } from "./rsvp.server";
import {
  currentEditionYear,
  firstOctoberWeekend,
  goingCounts,
  loadCurrentEdition,
  loadEditions,
  type Edition,
} from "./editions.server";

export type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

/** Schenley Overlook Shelter. Thorne Barn is the weather and overflow backup. */
export const SHELTER_CAPACITY = 24;

export const CURRENT_SEASON = new Date().getFullYear();

export type Actor = { personId: string | null };

/** Returns the acting admin's person_id, or null when the caller is not an
 *  admin. Every read and write in this module goes through this first, so a
 *  signed-in non-admin gets an empty payload rather than data or an error. */
export async function adminActor(
  supabase: SupabaseClient<Database>,
): Promise<string | null> {
  const [adminRes, personRes] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("current_person_id"),
  ]);
  if (adminRes.error || adminRes.data !== true) return null;
  return (personRes.data as string | null) ?? null;
}

async function audit(
  actor: string | null,
  action: string,
  table: string,
  recordId: string | null,
  before: unknown,
  after: unknown,
) {
  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: actor,
    action,
    table_name: table,
    record_id: recordId,
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
}

// ---------------------------------------------------------------- shared

export type PersonRow = {
  id: string;
  member_no: number;
  seed_id: string | null;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  current_city: string | null;
  grad_year: number | null;
  seed_division: string | null;
  deceased: boolean;
  deceased_note: string | null;
  deceased_confirmed_by: string | null;
  deceased_confirmed_at: string | null;
  show_on_board: boolean;
  share_email: boolean;
  open_to_network: boolean;
  needs_review: boolean;
  is_anchor: boolean;
};

const PERSON_COLUMNS =
  "id, member_no, seed_id, first_name, last_name, played_as, current_city, grad_year, seed_division, deceased, deceased_note, deceased_confirmed_by, deceased_confirmed_at, show_on_board, share_email, open_to_network, needs_review, is_anchor";

export type AdminEmail = {
  email: string;
  is_primary: boolean;
  verified: boolean;
};

export type AdminPerson = PersonRow & {
  emails: AdminEmail[];
  board_year: number | null;
  board_division: string | null;
  team_label: string | null;
  stint_count: number;
  state: "unclaimed" | "claimed" | "going" | "maybe" | "not_this_year" | "memorial";
};

type Context = {
  placement: Map<string, { board_year: number | null; board_division: string | null }>;
  stints: Map<string, number>;
  rsvp: Map<string, string>;
  verified: Set<string>;
  /** Any identity row at all, verified or not. A claim in progress still counts. */
  hasIdentity: Set<string>;
  /** Admin only. Never joined into a public view or a member facing payload. */
  emails: Map<string, AdminEmail[]>;
};

async function loadContext(): Promise<Context> {
  const currentYear = (await loadCurrentEdition()).event_year;
  const [placeRes, stintRes, rsvpRes, identRes] = await Promise.all([
    supabaseAdmin.from("person_board_placement").select("person_id, board_year, board_division"),
    supabaseAdmin.from("stints").select("person_id"),
    supabaseAdmin.from("rsvps").select("person_id, status").eq("event_year", currentYear),
    supabaseAdmin
      .from("identities")
      .select("person_id, email, is_primary, verified_at")
      .order("is_primary", { ascending: false }),
  ]);
  const placement = new Map<string, { board_year: number | null; board_division: string | null }>();
  for (const row of placeRes.data ?? [])
    placement.set(row.person_id as string, {
      board_year: row.board_year as number | null,
      board_division: row.board_division as string | null,
    });
  const stints = new Map<string, number>();
  for (const row of stintRes.data ?? [])
    stints.set(row.person_id as string, (stints.get(row.person_id as string) ?? 0) + 1);
  const rsvp = new Map<string, string>();
  for (const row of rsvpRes.data ?? []) rsvp.set(row.person_id as string, row.status as string);
  const verified = new Set<string>();
  const hasIdentity = new Set<string>();
  const emails = new Map<string, AdminEmail[]>();
  for (const row of identRes.data ?? []) {
    const pid = row.person_id as string;
    hasIdentity.add(pid);
    if (row.verified_at) verified.add(pid);
    const list = emails.get(pid) ?? [];
    list.push({
      email: (row as { email: string }).email,
      is_primary: Boolean((row as { is_primary: boolean }).is_primary),
      verified: Boolean(row.verified_at),
    });
    emails.set(pid, list);
  }
  return { placement, stints, rsvp, verified, hasIdentity, emails };
}

function decorate(person: PersonRow, ctx: Context, label: string | null): AdminPerson {
  const place = ctx.placement.get(person.id);
  const status = ctx.rsvp.get(person.id);
  const state: AdminPerson["state"] = person.deceased
    ? "memorial"
    : status === "going"
      ? "going"
      : status === "maybe"
        ? "maybe"
        : status === "not_this_year"
          ? "not_this_year"
          : ctx.verified.has(person.id)
            ? "claimed"
            : "unclaimed";
  return {
    ...person,
    emails: ctx.emails.get(person.id) ?? [],
    board_year: place?.board_year ?? person.grad_year,
    board_division: place?.board_division ?? person.seed_division,
    team_label: label,
    stint_count: ctx.stints.get(person.id) ?? 0,
    state,
  };
}

async function decorateAll(rows: PersonRow[], ctx: Context) {
  const out: AdminPerson[] = [];
  for (const row of rows) {
    const place = ctx.placement.get(row.id);
    const label = await teamLabel(
      place?.board_division ?? row.seed_division,
      place?.board_year ?? row.grad_year,
    );
    out.push(decorate(row, ctx, label));
  }
  return out;
}

function fullName(p: { first_name: string; last_name?: string | null }) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

// ---------------------------------------------------------------- people

/** The admin table sorts and filters client side over the whole set, so this
 *  returns every record decorated once. 468 rows is nothing to render. */
export async function listPeople(): Promise<AdminPerson[]> {
  const { data } = await supabaseAdmin
    .from("people")
    .select(PERSON_COLUMNS)
    .order("member_no", { ascending: true })
    .limit(2000);
  const ctx = await loadContext();
  return decorateAll((data ?? []) as PersonRow[], ctx);
}

const EDITABLE_FIELDS = [
  "first_name",
  "last_name",
  "played_as",
  "current_city",
  "grad_year",
  "seed_division",
  "show_on_board",
  "needs_review",
  "is_anchor",
  "share_email",
  "open_to_network",
  "deceased_note",
] as const;

export async function updatePerson(
  actor: string | null,
  personId: string,
  patch: Record<string, unknown>,
) {
  const { data: before } = await supabaseAdmin
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("id", personId)
    .maybeSingle();
  if (!before) throw new Error("No such person.");

  const clean: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (!(key in patch)) continue;
    const value = patch[key];
    if (key === "grad_year")
      clean[key] = value === null || value === "" ? null : Number(value) || null;
    else if (typeof value === "boolean") clean[key] = value;
    else clean[key] = typeof value === "string" ? value.trim().slice(0, 400) || null : null;
  }
  if (typeof clean.first_name === "string" && !clean.first_name) delete clean.first_name;
  if (Object.keys(clean).length === 0) return { ok: true };

  const { error } = await supabaseAdmin.from("people").update(clean as never).eq("id", personId);
  if (error) throw new Error(error.message);
  await audit(actor, "admin_person_update", "people", personId, before, clean);
  return { ok: true };
}

/** Roles live on stints because a role is a thing someone did in a season, not
 *  a property of a person. A coach whose years nobody remembers gets a stint
 *  with a null year rather than an invented one. */
export const STINT_ROLES = ["player", "captain", "coach", "assistant_coach", "manager"] as const;
export type StintRole = (typeof STINT_ROLES)[number];

export type PersonStint = {
  id: string;
  division: string;
  role: string;
  year: number | null;
  source: string | null;
};

export async function listPersonStints(personId: string): Promise<PersonStint[]> {
  const { data } = await supabaseAdmin
    .from("stints")
    .select("id, division, role, year, source")
    .eq("person_id", personId)
    .order("year", { ascending: true, nullsFirst: false });
  return (data ?? []) as PersonStint[];
}

export async function addPersonStint(
  actor: string | null,
  input: { personId: string; division: string; role: string; year: number | null },
) {
  const role = (STINT_ROLES as readonly string[]).includes(input.role)
    ? (input.role as StintRole)
    : null;
  if (!role) throw new Error("Pick a role.");
  if (!input.division) throw new Error("Pick a division.");

  const year = input.year === null || Number.isNaN(input.year) ? null : Number(input.year);
  if (year !== null && (year < 1970 || year > 2100)) throw new Error("That year is out of range.");

  // A null year is only ever acceptable for the sidelines. A playing season is
  // a claim about a specific year, so it must name one.
  const onField = role === "player" || role === "captain";
  if (onField && year === null) throw new Error("A playing season needs a year.");
  // The current-season block stays exactly where it was: nobody currently on a
  // roster is an alumnus, and this path does not get to say otherwise.
  if (onField && year === CURRENT_SEASON)
    throw new Error("The current season cannot be added here.");

  const { error } = await supabaseAdmin.from("stints").insert({
    person_id: input.personId,
    division: input.division,
    role,
    year,
    source: "admin",
  } as never);
  if (error) throw new Error(error.message);

  await audit(actor, "admin_stint_add", "stints", input.personId, null, {
    division: input.division,
    role,
    year,
  });
  return { ok: true };
}

export async function deletePersonStint(actor: string | null, id: string) {
  const { data: before } = await supabaseAdmin
    .from("stints")
    .select("id, person_id, division, role, year, source")
    .eq("id", id)
    .maybeSingle();
  if (!before) throw new Error("No such stint.");
  const { error } = await supabaseAdmin.from("stints").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(actor, "admin_stint_delete", "stints", before.person_id as string, before, null);
  return { ok: true };
}

/** The ONLY path to deceased = true. Requires an admin to type the name of the
 *  person who confirmed it off site and the date they confirmed it. */
export async function recordMemorialConfirmation(
  actor: string | null,
  input: {
    personId: string;
    suggestionId: string | null;
    note: string;
    confirmedByName: string;
    confirmedAt: string;
    markDeceased: boolean;
  },
) {
  const note = input.note.trim().slice(0, 2000);
  const confirmedBy = input.confirmedByName.trim().slice(0, 120);
  const confirmedAt = input.confirmedAt.trim();

  const { data: before } = await supabaseAdmin
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("id", input.personId)
    .maybeSingle();
  if (!before) throw new Error("No such person.");

  const patch: Record<string, unknown> = {};
  if (note) patch.deceased_note = note;

  if (input.markDeceased) {
    if (!confirmedBy || !confirmedAt)
      throw new Error(
        "Type who confirmed it and the date they confirmed it before marking a record.",
      );
    const when = new Date(`${confirmedAt}T12:00:00Z`);
    if (Number.isNaN(when.getTime())) throw new Error("That date isn't readable.");
    patch.deceased = true;
    patch.deceased_confirmed_at = when.toISOString();
    patch.deceased_confirmed_by = actor;
    patch.deceased_note = `${note}${note ? "\n" : ""}Confirmed by ${confirmedBy} on ${confirmedAt}.`;
    patch.show_on_board = true;
  }

  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabaseAdmin.from("people").update(patch as never).eq("id", input.personId);
  if (error) throw new Error(error.message);

  // Suppression already happens the moment a memorial is reported. This repeats
  // it for the admin-initiated path, where no report was ever filed.
  const { data: memorialEmails } = await supabaseAdmin
    .from("identities")
    .select("email")
    .eq("person_id", input.personId);
  for (const row of memorialEmails ?? []) {
    await supabaseAdmin.from("suppressions").upsert(
      {
        email: (row.email as string).toLowerCase(),
        reason: input.markDeceased ? "memorial" : "memorial_pending",
      },
      { onConflict: "email" },
    );
  }

  if (input.suggestionId) {
    await supabaseAdmin
      .from("suggestions")
      .update({
        payload: {
          person_id: input.personId,
          note,
          private: true,
          confirmed_by_name: confirmedBy || null,
          confirmed_at: confirmedAt || null,
        } as never,
        reviewed_by: actor,
        reviewed_at: new Date().toISOString(),
        status: input.markDeceased ? "approved" : "pending",
      })
      .eq("id", input.suggestionId);
  }

  await audit(
    actor,
    input.markDeceased ? "memorial_confirmed" : "memorial_note",
    "people",
    input.personId,
    before,
    patch,
  );
  return { ok: true };
}

// ---------------------------------------------------------------- queue

export type QueueItem = {
  id: string;
  type: "new_person" | "edit" | "memorial" | "roster_import";
  status: string;
  created_at: string | null;
  submitter: string | null;
  peer_vouched: boolean;
  payload: Record<string, Json>;
  proposedName: string | null;
  matches: { id: string; name: string; grad_year: number | null; score: number }[];
  diff: { field: string; before: string; after: string }[];
  person: { id: string; name: string; grad_year: number | null; team_label: string | null } | null;
  stale: boolean;
};

export async function reviewQueue(): Promise<QueueItem[]> {
  const { data } = await supabaseAdmin
    .from("suggestions")
    .select("id, type, status, payload, created_at, submitted_by, peer_verified_by")
    .order("created_at", { ascending: true })
    .limit(500);
  const rows = data ?? [];
  if (rows.length === 0) return [];

  const { data: peopleRows } = await supabaseAdmin
    .from("people")
    .select(PERSON_COLUMNS)
    .limit(3000);
  const people = (peopleRows ?? []) as PersonRow[];
  const byId = new Map(people.map((p) => [p.id, p]));
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;

  const out: QueueItem[] = [];
  for (const row of rows) {
    const payload = (row.payload ?? {}) as Record<string, Json>;
    const submitter = byId.get(row.submitted_by as string);
    const item: QueueItem = {
      id: row.id as string,
      type: row.type as QueueItem["type"],
      status: row.status as string,
      created_at: (row.created_at as string | null) ?? null,
      submitter: submitter ? fullName(submitter) : null,
      peer_vouched: Boolean(row.peer_verified_by),
      payload,
      proposedName: null,
      matches: [],
      diff: [],
      person: null,
      stale: false,
    };

    if (row.type === "new_person") {
      const name = [payload.first_name, payload.last_name].filter(Boolean).join(" ");
      item.proposedName = name || null;
      item.matches = people
        .map((p) => ({
          id: p.id,
          name: fullName(p),
          grad_year: p.grad_year,
          score: nameScore(name, fullName(p)),
        }))
        .filter((m) => m.score >= 0.72)
        .sort((a, b) => b.score - a.score)
        .slice(0, 4);
      item.stale =
        row.status === "pending" &&
        !row.peer_verified_by &&
        new Date((row.created_at as string) ?? Date.now()).getTime() < cutoff;
    }

    const targetId = typeof payload.person_id === "string" ? payload.person_id : null;
    const target = targetId ? byId.get(targetId) : undefined;
    if (target) {
      item.person = {
        id: target.id,
        name: fullName(target),
        grad_year: target.grad_year,
        team_label: await teamLabel(target.seed_division, target.grad_year),
      };
    }

    if (row.type === "edit" && target) {
      const fields = (payload.fields ?? payload.changes ?? {}) as Record<string, unknown>;
      for (const [field, value] of Object.entries(fields)) {
        const current = (target as unknown as Record<string, unknown>)[field];
        item.diff.push({
          field,
          before: current === null || current === undefined ? "—" : String(current),
          after: value === null || value === undefined ? "—" : String(value),
        });
      }
    }

    out.push(item);
  }

  const rank = (s: string) => (s === "pending" ? 0 : 1);
  return out.sort(
    (a, b) => rank(a.status) - rank(b.status) || a.type.localeCompare(b.type),
  );
}

export async function resolveSuggestion(
  actor: string | null,
  suggestionId: string,
  action: "approve" | "reject",
) {
  const { data: row } = await supabaseAdmin
    .from("suggestions")
    .select("id, type, status, payload, submitted_by")
    .eq("id", suggestionId)
    .maybeSingle();
  if (!row || row.status !== "pending") throw new Error("That item is no longer open.");
  if (row.type === "memorial")
    throw new Error("A memorial is never approved with a button.");

  const payload = (row.payload ?? {}) as Record<string, unknown>;

  if (action === "reject") {
    await supabaseAdmin
      .from("suggestions")
      .update({ status: "rejected", reviewed_by: actor, reviewed_at: new Date().toISOString() })
      .eq("id", suggestionId);
    await audit(actor, "admin_suggestion_reject", "suggestions", suggestionId, payload, {
      status: "rejected",
    });
    return { ok: true, createdId: null as string | null };
  }

  let createdId: string | null = null;

  if (row.type === "new_person") {
    // Only write what the submitter actually gave us. A missing grad year, a
    // missing division and a missing playing year each stay missing: an
    // invented one reads as fact forever after.
    const firstName = String(payload.first_name ?? "").trim().slice(0, 80);
    if (!firstName) throw new Error("That request has no first name to write.");

    const insert: Record<string, unknown> = {
      first_name: firstName,
      needs_review: false,
      // Approval gates one thing only: whether the name appears on the board.
      show_on_board: true,
    };
    if (typeof payload.last_name === "string" && payload.last_name.trim())
      insert.last_name = payload.last_name.trim().slice(0, 80);
    if (typeof payload.played_as === "string" && payload.played_as.trim())
      insert.played_as = payload.played_as.trim().slice(0, 80);
    if (typeof payload.grad_year === "number") insert.grad_year = payload.grad_year;
    if (typeof payload.division === "string" && payload.division.trim())
      insert.seed_division = payload.division.trim();

    // member_no is assigned by the database identity column, never by hand.
    const { data: created, error } = await supabaseAdmin
      .from("people")
      .insert(insert as never)
      .select("id")
      .single();
    if (error || !created) throw new Error(error?.message ?? "Couldn't create that record.");
    createdId = created.id as string;

    // A stint is a claim about a season someone actually played. It is written
    // only when the submitter named both the division and the year.
    const stintYear =
      typeof payload.stint_year === "number"
        ? payload.stint_year
        : typeof payload.start_year === "number"
          ? payload.start_year
          : null;
    if (
      typeof insert.seed_division === "string" &&
      stintYear !== null &&
      stintYear >= 1970 &&
      stintYear <= 2100
    ) {
      await supabaseAdmin.from("stints").insert({
        person_id: createdId,
        division: insert.seed_division as string,
        year: stintYear,
        source: "self",
      } as never);
    }

    // The email the submitter typed. If they already clicked their link it is
    // proven, so it attaches verified and they are signed in on arrival.
    if (typeof payload.email === "string" && payload.email.includes("@")) {
      await supabaseAdmin
        .from("identities")
        .insert({
          person_id: createdId,
          email: payload.email.trim().toLowerCase(),
          is_primary: true,
          ...(payload.email_verified === true
            ? { verified_at: new Date().toISOString(), provider: "magic" }
            : {}),
        } as never)
        .select("id")
        .maybeSingle();
    }

    // Saying you are coming IS the signup, so the answer survives review. It is
    // carried onto the new record here and is never contingent on approval.
    const requested = payload.requested_status;
    if (requested === "going" || requested === "maybe" || requested === "not_this_year") {
      const eventYear = (await loadCurrentEdition()).event_year;
      const { data: already } = await supabaseAdmin
        .from("rsvps")
        .select("id")
        .eq("person_id", createdId)
        .eq("event_year", eventYear)
        .maybeSingle();
      if (!already) {
        const src = normalizeRsvpSource(payload.src);
        await supabaseAdmin.from("rsvps").insert({
          person_id: createdId,
          event_year: eventYear,
          status: requested,
          ...(src ? { src } : {}),
          ...(typeof payload.party_size === "number" ? { party_size: payload.party_size } : {}),
        } as never);
      }
    }
  }

  if (row.type === "edit" && typeof payload.person_id === "string") {
    const fields = (payload.fields ?? payload.changes ?? {}) as Record<string, unknown>;
    await updatePerson(actor, payload.person_id, fields);
  }

  await supabaseAdmin
    .from("suggestions")
    .update({ status: "approved", reviewed_by: actor, reviewed_at: new Date().toISOString() })
    .eq("id", suggestionId);
  await audit(actor, "admin_suggestion_approve", "suggestions", suggestionId, payload, {
    status: "approved",
    created_person_id: createdId,
  });
  return { ok: true, createdId };
}

// ---------------------------------------------------------------- roster

export type RosterLine = {
  raw: string;
  parsed: string;
  bucket: "matched" | "new" | "ambiguous";
  candidates: { id: string; name: string; grad_year: number | null; score: number }[];
  personId: string | null;
};

export function parseRosterName(line: string) {
  const trimmed = line.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  if (trimmed.includes(",")) {
    const [last, first] = trimmed.split(",");
    return `${(first ?? "").trim()} ${last.trim()}`.trim();
  }
  return trimmed;
}

export async function rosterDryRun(text: string): Promise<{
  lines: RosterLine[];
  summary: { matched: number; created: number; ambiguous: number; total: number };
}> {
  const { data } = await supabaseAdmin
    .from("people")
    .select("id, first_name, last_name, played_as, grad_year")
    .eq("archived", false)
    .limit(3000);
  const people = (data ?? []) as {
    id: string;
    first_name: string;
    last_name: string | null;
    played_as: string | null;
    grad_year: number | null;
  }[];

  const lines: RosterLine[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const parsed = parseRosterName(raw);
    if (!parsed) continue;
    const scored = people
      .map((p) => ({
        id: p.id,
        name: fullName(p),
        grad_year: p.grad_year,
        score: Math.max(nameScore(parsed, fullName(p)), p.played_as ? nameScore(parsed, p.played_as) : 0),
      }))
      .filter((c) => c.score >= 0.7)
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    let bucket: RosterLine["bucket"] = "new";
    let personId: string | null = null;
    if (scored.length === 0) bucket = "new";
    else if (scored.length === 1 || scored[0].score - scored[1].score >= 0.12) {
      bucket = "matched";
      personId = scored[0].id;
    } else bucket = "ambiguous";

    lines.push({ raw: raw.trim(), parsed, bucket, candidates: scored, personId });
  }

  return {
    lines,
    summary: {
      matched: lines.filter((l) => l.bucket === "matched").length,
      created: lines.filter((l) => l.bucket === "new").length,
      ambiguous: lines.filter((l) => l.bucket === "ambiguous").length,
      total: lines.length,
    },
  };
}

/** The only path that writes a current-year stint. Alumni self-inserts of a
 *  current-year stint stay blocked by RLS; this runs with elevated rights. */
export async function rosterCommit(
  actor: string | null,
  input: {
    division: string;
    year: number;
    lines: { parsed: string; personId: string | null; create: boolean }[];
  },
) {
  const year = input.year;
  let matched = 0;
  let created = 0;
  let skipped = 0;

  for (const line of input.lines) {
    let personId = line.personId;
    if (!personId) {
      if (!line.create) {
        skipped++;
        continue;
      }
      const parts = line.parsed.split(" ");
      const first = parts.shift() ?? line.parsed;
      const { data: person, error } = await supabaseAdmin
        .from("people")
        .insert({
          first_name: first.slice(0, 80),
          last_name: parts.join(" ").slice(0, 80) || null,
          seed_division: input.division,
          needs_review: false,
        })
        .select("id")
        .single();
      if (error || !person) {
        skipped++;
        continue;
      }
      personId = person.id as string;
      created++;
    } else matched++;

    const { data: existing } = await supabaseAdmin
      .from("stints")
      .select("id")
      .eq("person_id", personId)
      .eq("division", input.division)
      .eq("year", year)
      .maybeSingle();
    if (existing) continue;

    await supabaseAdmin.from("stints").insert({
      person_id: personId,
      division: input.division,
      year,
      role: "player",
      source: "roster_import",
      confirmed_by: actor,
      confirmed_at: new Date().toISOString(),
    });
  }

  await audit(actor, "roster_import", "stints", null, null, {
    division: input.division,
    year,
    matched,
    created,
    skipped,
  });
  return { ok: true, matched, created, skipped };
}

// ---------------------------------------------------------------- merge

export type DuplicatePair = {
  key: string;
  a: AdminPerson;
  b: AdminPerson;
  score: number;
  /** Chosen automatically: more stints wins, ties go to the lower member_no. */
  survivorId: string;
  loserId: string;
  moves: { stints: number; identities: number; rsvps: number };
};

function pairKey(a: string, b: string) {
  return a < b ? `${a}:${b}` : `${b}:${a}`;
}

async function ruledPairKeys(): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("duplicate_rulings")
    .select("person_a_id, person_b_id");
  return new Set(
    (data ?? []).map((r) => pairKey(r.person_a_id as string, r.person_b_id as string)),
  );
}

export async function duplicateCandidates(): Promise<DuplicatePair[]> {
  const { data } = await supabaseAdmin
    .from("people")
    .select(PERSON_COLUMNS)
    .eq("archived", false)
    .limit(3000);
  const [ctx, ruled] = await Promise.all([loadContext(), ruledPairKeys()]);
  const rows = (data ?? []) as PersonRow[];
  const pairs: { a: PersonRow; b: PersonRow; score: number }[] = [];

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (ruled.has(pairKey(a.id, b.id))) continue;
      // Hard gate: different surnames are never duplicate candidates, no matter
      // how well the first names, grad year, or division line up.
      if (!surnameGate(a.last_name, b.last_name)) continue;
      const score = nameScore(fullName(a), fullName(b));
      if (score < 0.86) continue;
      const ya = ctx.placement.get(a.id)?.board_year ?? a.grad_year;
      const yb = ctx.placement.get(b.id)?.board_year ?? b.grad_year;
      const overlap = ya === null || yb === null || Math.abs(ya - yb) <= 5;
      if (!overlap) continue;
      pairs.push({ a, b, score });
    }
  }

  pairs.sort((x, y) => y.score - x.score);
  const top = pairs.slice(0, 30);
  const decorated = await decorateAll(
    top.flatMap((p) => [p.a, p.b]),
    ctx,
  );
  const byId = new Map(decorated.map((p) => [p.id, p]));
  const out: DuplicatePair[] = [];
  for (const p of top) {
    const a = byId.get(p.a.id)!;
    const b = byId.get(p.b.id)!;
    const survivor =
      a.stint_count !== b.stint_count
        ? a.stint_count > b.stint_count
          ? a
          : b
        : a.member_no <= b.member_no
          ? a
          : b;
    const loser = survivor.id === a.id ? b : a;
    const [identRes, rsvpRes] = await Promise.all([
      supabaseAdmin
        .from("identities")
        .select("id", { count: "exact", head: true })
        .eq("person_id", loser.id),
      supabaseAdmin
        .from("rsvps")
        .select("id", { count: "exact", head: true })
        .eq("person_id", loser.id),
    ]);
    out.push({
      key: pairKey(a.id, b.id),
      a,
      b,
      score: p.score,
      survivorId: survivor.id,
      loserId: loser.id,
      moves: {
        stints: loser.stint_count,
        identities: identRes.count ?? 0,
        rsvps: rsvpRes.count ?? 0,
      },
    });
  }
  return out;
}

async function writeRuling(
  actor: string | null,
  aId: string,
  bId: string,
  ruling: "keep_separate" | "merged",
  note: string | null,
) {
  const [first, second] = aId < bId ? [aId, bId] : [bId, aId];
  await supabaseAdmin.from("duplicate_rulings").upsert(
    {
      person_a_id: first,
      person_b_id: second,
      ruling,
      ruled_by: actor,
      ruled_at: new Date().toISOString(),
      note,
    },
    { onConflict: "person_a_id,person_b_id" },
  );
}

/** "Keep separate" is permanent: the pair never surfaces on a future scan. */
export async function rulePairSeparate(
  actor: string | null,
  input: { aId: string; bId: string; note: string | null },
) {
  if (input.aId === input.bId) throw new Error("Pick two different records.");
  await writeRuling(actor, input.aId, input.bId, "keep_separate", input.note?.trim() || null);
  await audit(actor, "duplicate_keep_separate", "duplicate_rulings", null, null, {
    person_a_id: input.aId,
    person_b_id: input.bId,
    note: input.note ?? null,
  });
  return { ok: true };
}

/** Merge with the survivor already decided by the scan, then record the ruling. */
export async function mergeDuplicatePair(
  actor: string | null,
  input: { survivorId: string; loserId: string },
) {
  await mergePeople(actor, {
    survivorId: input.survivorId,
    loserId: input.loserId,
    playedAs: null,
  });
  await writeRuling(actor, input.survivorId, input.loserId, "merged", null);
  return { ok: true };
}

export async function mergePeople(
  actor: string | null,
  input: { survivorId: string; loserId: string; playedAs: string | null },
) {
  if (input.survivorId === input.loserId) throw new Error("Pick two different records.");
  const [survivorRes, loserRes] = await Promise.all([
    supabaseAdmin.from("people").select("*").eq("id", input.survivorId).maybeSingle(),
    supabaseAdmin.from("people").select("*").eq("id", input.loserId).maybeSingle(),
  ]);
  const survivor = survivorRes.data as (PersonRow & Record<string, unknown>) | null;
  const loser = loserRes.data as (PersonRow & Record<string, unknown>) | null;
  if (!survivor || !loser) throw new Error("One of those records is gone.");
  if (loser.archived) throw new Error("That record is already archived.");

  // Capture the exact before state of every row this merge is about to touch.
  // Undo replays these ids, so nothing here may be approximated.
  const ids = async (table: string, column: string) =>
    ((
      await supabaseAdmin
        .from(table as "stints")
        .select("id")
        .eq(column as "person_id", input.loserId)
    ).data ?? []).map((r) => (r as { id: string }).id);

  const identityRows =
    (
      await supabaseAdmin
        .from("identities")
        .select("id, is_primary")
        .eq("person_id", input.loserId)
    ).data ?? [];

  const before = {
    survivor,
    loser,
    moved: {
      stints: await ids("stints", "person_id"),
      identities: identityRows.map((r) => ({
        id: r.id as string,
        is_primary: r.is_primary as boolean,
      })),
      verifications_person: await ids("verifications", "person_id"),
      verifications_verified_by: await ids("verifications", "verified_by"),
      suggestions_submitted_by: await ids("suggestions", "submitted_by"),
      suggestions_peer_verified_by: await ids("suggestions", "peer_verified_by"),
      suggestions_reviewed_by: await ids("suggestions", "reviewed_by"),
      sends: await ids("sends", "person_id"),
      rsvps_moved: [] as string[],
      rsvps_deleted: [] as Record<string, unknown>[],
    },
  };

  // Repoint every child row before the delete so nothing is orphaned.
  await supabaseAdmin.from("stints").update({ person_id: input.survivorId }).eq("person_id", input.loserId);
  await supabaseAdmin
    .from("identities")
    .update({ person_id: input.survivorId, is_primary: false })
    .eq("person_id", input.loserId);
  await supabaseAdmin.from("verifications").update({ person_id: input.survivorId }).eq("person_id", input.loserId);
  await supabaseAdmin.from("verifications").update({ verified_by: input.survivorId }).eq("verified_by", input.loserId);
  await supabaseAdmin.from("suggestions").update({ submitted_by: input.survivorId }).eq("submitted_by", input.loserId);
  await supabaseAdmin.from("suggestions").update({ peer_verified_by: input.survivorId }).eq("peer_verified_by", input.loserId);
  await supabaseAdmin.from("suggestions").update({ reviewed_by: input.survivorId }).eq("reviewed_by", input.loserId);
  await supabaseAdmin.from("sends").update({ person_id: input.survivorId }).eq("person_id", input.loserId);

  // rsvps are one row per person per year; keep the survivor's, move the rest.
  const { data: survivorRsvps } = await supabaseAdmin
    .from("rsvps")
    .select("event_year")
    .eq("person_id", input.survivorId);
  const heldYears = new Set((survivorRsvps ?? []).map((r) => r.event_year as number));
  const { data: loserRsvps } = await supabaseAdmin
    .from("rsvps")
    .select("*")
    .eq("person_id", input.loserId);
  for (const row of loserRsvps ?? []) {
    if (heldYears.has(row.event_year as number)) {
      before.moved.rsvps_deleted.push(row as Record<string, unknown>);
      await supabaseAdmin.from("rsvps").delete().eq("id", row.id as string);
    } else {
      before.moved.rsvps_moved.push(row.id as string);
      await supabaseAdmin
        .from("rsvps")
        .update({ person_id: input.survivorId })
        .eq("id", row.id as string);
    }
  }

  const playedAs = input.playedAs?.trim().slice(0, 80) || survivor.played_as;
  await supabaseAdmin
    .from("people")
    .update({
      played_as: playedAs,
      grad_year: survivor.grad_year ?? loser.grad_year,
      current_city: survivor.current_city ?? loser.current_city,
      seed_division: survivor.seed_division ?? loser.seed_division,
      is_anchor: survivor.is_anchor || loser.is_anchor,
    })
    .eq("id", input.survivorId);

  // Soft archive. The losing record keeps every column it had so an undo can
  // restore it byte for byte; only the archive markers change.
  const { error } = await supabaseAdmin
    .from("people")
    .update({
      archived: true,
      merged_into_person_id: input.survivorId,
      merged_at: new Date().toISOString(),
      show_on_board: false,
    } as never)
    .eq("id", input.loserId);
  if (error) throw new Error(error.message);

  const [{ data: afterSurvivor }, { data: afterLoser }] = await Promise.all([
    supabaseAdmin.from("people").select("*").eq("id", input.survivorId).maybeSingle(),
    supabaseAdmin.from("people").select("*").eq("id", input.loserId).maybeSingle(),
  ]);
  await audit(actor, "admin_merge_people", "people", input.survivorId, before, {
    survivor: afterSurvivor,
    loser: afterLoser,
    archived_person_id: input.loserId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------- undo merge

export type ArchivedRecord = {
  id: string;
  member_no: number;
  name: string;
  merged_at: string | null;
  merged_into_person_id: string | null;
  merged_into_name: string | null;
  merged_into_member_no: number | null;
  restorable: boolean;
};

/** Archived records stay visible here, and nowhere else. */
export async function archivedRecords(): Promise<ArchivedRecord[]> {
  const { data } = await supabaseAdmin
    .from("people")
    .select("id, member_no, first_name, last_name, merged_at, merged_into_person_id")
    .eq("archived", true)
    .order("merged_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as Record<string, unknown>[];
  if (rows.length === 0) return [];

  const targetIds = [
    ...new Set(rows.map((r) => r.merged_into_person_id as string | null).filter(Boolean)),
  ] as string[];
  const { data: targets } = await supabaseAdmin
    .from("people")
    .select("id, member_no, first_name, last_name")
    .in("id", targetIds.length > 0 ? targetIds : ["00000000-0000-0000-0000-000000000000"]);
  const byId = new Map(
    (targets ?? []).map((t) => [
      t.id as string,
      {
        name: [t.first_name, t.last_name].filter(Boolean).join(" "),
        member_no: t.member_no as number,
      },
    ]),
  );

  const out: ArchivedRecord[] = [];
  for (const r of rows) {
    const target = byId.get((r.merged_into_person_id as string) ?? "");
    out.push({
      id: r.id as string,
      member_no: r.member_no as number,
      name: [r.first_name, r.last_name].filter(Boolean).join(" "),
      merged_at: (r.merged_at as string | null) ?? null,
      merged_into_person_id: (r.merged_into_person_id as string | null) ?? null,
      merged_into_name: target?.name ?? null,
      merged_into_member_no: target?.member_no ?? null,
      restorable: (await mergeSnapshot(r.id as string)) !== null,
    });
  }
  return out;
}

type MergeSnapshot = {
  auditId: number;
  survivorId: string;
  before: {
    survivor: Record<string, unknown>;
    loser: Record<string, unknown>;
    moved: {
      stints: string[];
      identities: { id: string; is_primary: boolean }[];
      verifications_person: string[];
      verifications_verified_by: string[];
      suggestions_submitted_by: string[];
      suggestions_peer_verified_by: string[];
      suggestions_reviewed_by: string[];
      sends: string[];
      rsvps_moved: string[];
      rsvps_deleted: Record<string, unknown>[];
    };
  };
};

/** The newest merge snapshot that archived this person, or null when the merge
 *  predates snapshotting and therefore cannot be undone exactly. */
async function mergeSnapshot(loserId: string): Promise<MergeSnapshot | null> {
  const { data } = await supabaseAdmin
    .from("audit_log")
    .select("id, record_id, before, after")
    .eq("action", "admin_merge_people")
    .order("created_at", { ascending: false })
    .limit(500);
  for (const row of (data ?? []) as Record<string, unknown>[]) {
    const after = row.after as { archived_person_id?: string } | null;
    const before = row.before as MergeSnapshot["before"] | null;
    if (!before || !before.moved || !before.loser) continue;
    if (after?.archived_person_id !== loserId) continue;
    return {
      auditId: row.id as number,
      survivorId: row.record_id as string,
      before,
    };
  }
  return null;
}

/** Exact reversal of a merge: every repointed row goes back by id, deleted
 *  RSVP rows are reinserted with their original ids, the survivor's edited
 *  fields are restored, and the archive markers are cleared. */
export async function undoMerge(actor: string | null, input: { loserId: string }) {
  const snap = await mergeSnapshot(input.loserId);
  if (!snap)
    throw new Error(
      "No complete before state was recorded for this merge, so it cannot be undone exactly. Restore it by hand instead.",
    );
  const { survivorId, before } = snap;
  const m = before.moved;
  const back = async (table: string, column: string, rowIds: string[]) => {
    if (rowIds.length === 0) return;
    const { error } = await supabaseAdmin
      .from(table as "stints")
      .update({ [column]: input.loserId } as never)
      .in("id", rowIds);
    if (error) throw new Error(error.message);
  };

  await back("stints", "person_id", m.stints);
  for (const ident of m.identities) {
    const { error } = await supabaseAdmin
      .from("identities")
      .update({ person_id: input.loserId, is_primary: ident.is_primary })
      .eq("id", ident.id);
    if (error) throw new Error(error.message);
  }
  await back("verifications", "person_id", m.verifications_person);
  await back("verifications", "verified_by", m.verifications_verified_by);
  await back("suggestions", "submitted_by", m.suggestions_submitted_by);
  await back("suggestions", "peer_verified_by", m.suggestions_peer_verified_by);
  await back("suggestions", "reviewed_by", m.suggestions_reviewed_by);
  await back("sends", "person_id", m.sends);
  await back("rsvps", "person_id", m.rsvps_moved);

  if (m.rsvps_deleted.length > 0) {
    const { error } = await supabaseAdmin
      .from("rsvps")
      .upsert(m.rsvps_deleted as never, { onConflict: "id" });
    if (error) throw new Error(error.message);
  }

  const s = before.survivor;
  const { error: survivorError } = await supabaseAdmin
    .from("people")
    .update({
      played_as: (s.played_as as string | null) ?? null,
      grad_year: (s.grad_year as number | null) ?? null,
      current_city: (s.current_city as string | null) ?? null,
      seed_division: (s.seed_division as string | null) ?? null,
      is_anchor: Boolean(s.is_anchor),
    })
    .eq("id", survivorId);
  if (survivorError) throw new Error(survivorError.message);

  const l = before.loser;
  const { error: loserError } = await supabaseAdmin
    .from("people")
    .update({
      archived: false,
      merged_into_person_id: null,
      merged_at: null,
      show_on_board: Boolean(l.show_on_board),
    } as never)
    .eq("id", input.loserId);
  if (loserError) throw new Error(loserError.message);

  // The pair goes back on the candidate list; the merge ruling no longer holds.
  const [first, second] =
    survivorId < input.loserId ? [survivorId, input.loserId] : [input.loserId, survivorId];
  await supabaseAdmin
    .from("duplicate_rulings")
    .delete()
    .eq("person_a_id", first)
    .eq("person_b_id", second)
    .eq("ruling", "merged");

  await audit(actor, "admin_undo_merge", "people", input.loserId, before, {
    restored_person_id: input.loserId,
    survivor_id: survivorId,
    from_audit_log_id: snap.auditId,
  });
  return { ok: true };
}

// ---------------------------------------------------------------- export

export async function exportCsv(actor: string | null) {
  const { data } = await supabaseAdmin.from("people").select(PERSON_COLUMNS).limit(3000);
  const ctx = await loadContext();
  const rows = await decorateAll((data ?? []) as PersonRow[], ctx);

  const { data: identities } = await supabaseAdmin
    .from("identities")
    .select("person_id, email, is_primary, verified_at")
    .order("is_primary", { ascending: false });
  const primary = new Map<string, string>();
  for (const row of identities ?? [])
    if (!primary.has(row.person_id as string)) primary.set(row.person_id as string, row.email as string);

  const header = [
    "member_no",
    "first_name",
    "last_name",
    "played_as",
    "board_year",
    "board_division",
    "team_label",
    "state",
    "is_anchor",
    "needs_review",
    "primary_email",
  ];
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const body = rows.map((r) =>
    [
      r.member_no,
      r.first_name,
      r.last_name,
      r.played_as,
      r.board_year,
      r.board_division,
      r.team_label,
      r.state,
      r.is_anchor,
      r.needs_review,
      primary.get(r.id) ?? "",
    ]
      .map(esc)
      .join(","),
  );
  const csv = [header.join(","), ...body].join("\n");
  const date = new Date().toISOString().slice(0, 10);
  await audit(actor, "admin_csv_export", "people", null, null, { rows: rows.length, date });
  return { filename: `pitt-alumni-export-${date}.csv`, csv, rows: rows.length };
}

// ---------------------------------------------------------------- panels

export type TeamNameRow = {
  id: string;
  division: string;
  name: string | null;
  start_year: number | null;
  end_year: number | null;
  confidence: string;
};

export async function updateTeamName(
  actor: string | null,
  input: { id: string; name: string | null; start_year: number | null; end_year: number | null; confidence: string },
) {
  const { data: before } = await supabaseAdmin
    .from("team_names")
    .select("id, division, name, start_year, end_year, confidence")
    .eq("id", input.id)
    .maybeSingle();
  if (!before) throw new Error("No such span.");
  const confidence = ["verified", "assumed", "unknown"].includes(input.confidence)
    ? input.confidence
    : "assumed";
  const patch = {
    name: input.name?.trim().slice(0, 80) || null,
    start_year: input.start_year ?? null,
    end_year: input.end_year ?? null,
    confidence,
  };
  const { error } = await supabaseAdmin.from("team_names").update(patch).eq("id", input.id);
  if (error) throw new Error(error.message);
  await audit(actor, "admin_team_name_update", "team_names", input.id, before, patch);
  return { ok: true };
}

export type DivisionRow = {
  code: string;
  label: string | null;
  sort_order: number | null;
  visible: boolean;
};

export async function setDivisionVisible(actor: string | null, input: { code: string; visible: boolean }) {
  const { data: before } = await supabaseAdmin
    .from("divisions")
    .select("code, label, visible")
    .eq("code", input.code)
    .maybeSingle();
  if (!before) throw new Error("No such division.");
  const { error } = await supabaseAdmin
    .from("divisions")
    .update({ visible: input.visible })
    .eq("code", input.code);
  if (error) throw new Error(error.message);
  await audit(actor, "admin_division_visibility", "divisions", input.code, before, {
    visible: input.visible,
  });
  return { ok: true };
}

export type DigestCohort = {
  admin: string;
  from: number;
  to: number;
  counts: { claimed: number; maybe: number; going: number; never_opened: number };
  going: string[];
  maybe: string[];
  claimed: string[];
  never_opened: string[];
};

async function cohortRange(personId: string, ctx: Context, person: PersonRow | undefined) {
  const { data: stints } = await supabaseAdmin.from("stints").select("year").eq("person_id", personId);
  const years = (stints ?? []).map((s) => s.year as number);
  if (years.length > 0) return { from: Math.min(...years) - 3, to: Math.max(...years) + 3 };
  const anchor = ctx.placement.get(personId)?.board_year ?? person?.grad_year ?? null;
  if (anchor === null) return null;
  return { from: anchor - 3, to: anchor + 3 };
}

export async function organizerDigest(): Promise<DigestCohort[]> {
  const { data: adminRows } = await supabaseAdmin.from("admins").select("person_id");
  const { data: peopleRows } = await supabaseAdmin.from("people").select(PERSON_COLUMNS).limit(3000);
  const ctx = await loadContext();
  const people = (peopleRows ?? []) as PersonRow[];
  const byId = new Map(people.map((p) => [p.id, p]));

  const out: DigestCohort[] = [];
  for (const row of adminRows ?? []) {
    const personId = row.person_id as string;
    const admin = byId.get(personId);
    const range = await cohortRange(personId, ctx, admin);
    if (!range) continue;

    const cohort: DigestCohort = {
      admin: admin ? fullName(admin) : "Admin",
      from: range.from,
      to: range.to,
      counts: { claimed: 0, maybe: 0, going: 0, never_opened: 0 },
      going: [],
      maybe: [],
      claimed: [],
      never_opened: [],
    };

    for (const person of people) {
      if (person.deceased) continue;
      const year = ctx.placement.get(person.id)?.board_year ?? person.grad_year;
      if (year === null || year < range.from || year > range.to) continue;
      const status = ctx.rsvp.get(person.id);
      const name = fullName(person);
      if (status === "going") {
        cohort.going.push(name);
        cohort.counts.going++;
      } else if (status === "maybe") {
        cohort.maybe.push(name);
        cohort.counts.maybe++;
      } else if (ctx.verified.has(person.id)) {
        cohort.claimed.push(name);
        cohort.counts.claimed++;
      } else if (status !== "not_this_year") {
        cohort.never_opened.push(name);
        cohort.counts.never_opened++;
      }
    }
    out.push(cohort);
  }
  return out;
}

export type DataGaps = {
  no_stints: number;
  no_grad_year: number;
  thin_years: { year: number; count: number }[];
  mens_a_recent: { year: number; count: number }[];
  /** Verified identity, no rsvps row for the current edition. */
  claimed_no_answer: { id: string; name: string; year: number | null; division: string | null }[];
};

export async function dataGaps(): Promise<DataGaps> {
  const { data } = await supabaseAdmin
    .from("people")
    .select("id, first_name, last_name, played_as, grad_year, deceased")
    .limit(3000);
  const ctx = await loadContext();
  const people = data ?? [];
  const yearCounts = new Map<number, number>();
  let noStints = 0;
  let noGrad = 0;
  const claimedNoAnswer: DataGaps["claimed_no_answer"] = [];
  for (const person of people) {
    const id = person.id as string;
    if ((ctx.stints.get(id) ?? 0) === 0) noStints++;
    if (person.grad_year === null) noGrad++;
    const year = ctx.placement.get(id)?.board_year ?? (person.grad_year as number | null);
    if (year !== null && year !== undefined) yearCounts.set(year, (yearCounts.get(year) ?? 0) + 1);
    if (!person.deceased && ctx.hasIdentity.has(id) && !ctx.rsvp.has(id)) {
      claimedNoAnswer.push({
        id,
        // Names, year and division only. No addresses on this panel.
        name: [person.first_name, person.last_name].filter(Boolean).join(" "),
        year: year ?? null,
        division: ctx.placement.get(id)?.board_division ?? null,
      });
    }
  }

  const { data: mensA } = await supabaseAdmin
    .from("stints")
    .select("year")
    .eq("division", "MENS_A")
    .in("year", [2023, 2024, 2025]);
  const mensCounts = new Map<number, number>([
    [2023, 0],
    [2024, 0],
    [2025, 0],
  ]);
  for (const row of mensA ?? [])
    mensCounts.set(row.year as number, (mensCounts.get(row.year as number) ?? 0) + 1);

  return {
    no_stints: noStints,
    no_grad_year: noGrad,
    thin_years: [...yearCounts.entries()]
      .filter(([, count]) => count < 6)
      .sort((a, b) => a[0] - b[0])
      .map(([year, count]) => ({ year, count })),
    mens_a_recent: [...mensCounts.entries()].map(([year, count]) => ({ year, count })),
    claimed_no_answer: claimedNoAnswer.sort(
      (a, b) => (a.year ?? 9999) - (b.year ?? 9999) || a.name.localeCompare(b.name),
    ),
  };
}

export type DripData = {
  sequences: {
    id: string;
    key: string;
    offset_days: number;
    audience_states: string[];
    anchors_only: boolean;
    active: boolean;
    send_on: string;
  }[];
  anchorDate: string;
  suppressions: { email: string; reason: string; created_at: string | null }[];
  bounces: { hard: number; soft: number; complaints: number };
};

export async function dripData(): Promise<DripData> {
  const edition = await loadCurrentEdition();
  const [seqRes, supRes, sendRes] = await Promise.all([
    supabaseAdmin
      .from("sequences")
      .select("id, key, offset_days, audience_states, anchors_only, active")
      .order("offset_days", { ascending: true }),
    supabaseAdmin.from("suppressions").select("email, reason, created_at").limit(500),
    supabaseAdmin.from("sends").select("bounced, bounce_type, complained").limit(5000),
  ]);

  let hard = 0;
  let soft = 0;
  let complaints = 0;
  for (const row of sendRes.data ?? []) {
    if (row.complained) complaints++;
    if (!row.bounced) continue;
    if (row.bounce_type === "hard") hard++;
    else soft++;
  }

  return {
    anchorDate: edition.starts_on,
    sequences: ((seqRes.data ?? []) as Omit<DripData["sequences"][number], "send_on">[]).map((seq) => ({
      ...seq,
      // Offsets resolve against the current edition, never a fixed date.
      send_on: new Date(
        Date.parse(`${edition.starts_on}T00:00:00Z`) + seq.offset_days * 86400000,
      )
        .toISOString()
        .slice(0, 10),
    })),
    suppressions: (supRes.data ?? []) as DripData["suppressions"],
    bounces: { hard, soft, complaints },
  };
}

export type Headcount = {
  going: number;
  heads: number;
  capacity: number;
};

/** The drip dispatcher, admin triggered. Dry run by default and audited either
 *  way, so a preview and a real run both leave a trace with a name on it. */
export async function runDripDispatch(actor: string | null, dryRun: boolean) {
  const { runDrip } = await import("./dispatcher.server");
  const report = await runDrip({ dryRun });
  await audit(actor, dryRun ? "drip_preview" : "drip_send", "sequences", null, null, {
    dryRun,
    totalEligible: report.totalEligible,
    totalSent: report.totalSent,
    stoppedReason: report.stoppedReason,
    sequences: report.sequences.map((s) => ({
      key: s.key,
      due: s.due,
      eligible: s.eligible,
      sent: s.sent,
      failed: s.failed,
    })),
  });
  return report;
}

/** Heads, not people. The going count stays one chip one person; this is the
 *  number the shelter has to hold. */
export async function headcount(): Promise<Headcount> {
  const eventYear = await currentEditionYear();
  const { data } = await supabaseAdmin
    .from("rsvps")
    .select("party_size")
    .eq("event_year", eventYear)
    .eq("status", "going");
  const rows = data ?? [];
  return {
    going: rows.length,
    heads: rows.reduce((sum, r) => sum + Number(r.party_size ?? 1), 0),
    capacity: SHELTER_CAPACITY,
  };
}

export type SourceCount = { src: string; label: string; count: number };

export type RsvpBreakdownPerson = {
  person_id: string;
  name: string;
  board_year: number | null;
  party_size: number | null;
  responded_at: string | null;
};

export type RsvpBreakdownBucket = {
  key: "going" | "maybe" | "not_this_year" | "claimed_no_rsvp";
  label: string;
  count: number;
  people: RsvpBreakdownPerson[];
};

export type RsvpBreakdown = { eventYear: number; buckets: RsvpBreakdownBucket[] };

/** Every answer for the current edition, by name. Admin only: this is the one
 *  place "not this year" is ever listed. */
export async function rsvpBreakdown(): Promise<RsvpBreakdown> {
  const eventYear = await currentEditionYear();
  const [rsvpRes, peopleRes, identRes, placeRes] = await Promise.all([
    supabaseAdmin
      .from("rsvps")
      .select("person_id, status, party_size, responded_at")
      .eq("event_year", eventYear),
    supabaseAdmin.from("people").select("id, first_name, last_name, grad_year, deceased").limit(2000),
    supabaseAdmin
      .from("identities")
      .select("person_id, email, is_primary, verified_at")
      .order("is_primary", { ascending: false }),
    supabaseAdmin.from("person_board_placement").select("person_id, board_year"),
  ]);

  const names = new Map<string, { name: string; grad_year: number | null; deceased: boolean }>();
  for (const row of peopleRes.data ?? [])
    names.set(row.id as string, {
      name: fullName(row as { first_name: string; last_name?: string | null }),
      grad_year: (row.grad_year as number | null) ?? null,
      deceased: Boolean(row.deceased),
    });
  const placement = new Map<string, number | null>();
  for (const row of placeRes.data ?? [])
    placement.set(row.person_id as string, (row.board_year as number | null) ?? null);
  const verified = new Set<string>();
  for (const row of identRes.data ?? [])
    if (row.verified_at) verified.add(row.person_id as string);

  const buckets: Record<RsvpBreakdownBucket["key"], RsvpBreakdownPerson[]> = {
    going: [],
    maybe: [],
    not_this_year: [],
    claimed_no_rsvp: [],
  };
  const answered = new Set<string>();

  for (const row of rsvpRes.data ?? []) {
    const personId = row.person_id as string;
    const info = names.get(personId);
    if (!info) continue;
    answered.add(personId);
    const status = row.status as string;
    if (status !== "going" && status !== "maybe" && status !== "not_this_year") continue;
    buckets[status].push({
      person_id: personId,
      name: info.name,
      board_year: placement.get(personId) ?? info.grad_year,
      party_size: status === "going" ? Number(row.party_size ?? 1) : null,
      responded_at: (row.responded_at as string | null) ?? null,
    });
  }

  for (const personId of verified) {
    if (answered.has(personId)) continue;
    const info = names.get(personId);
    if (!info || info.deceased) continue;
    buckets.claimed_no_rsvp.push({
      person_id: personId,
      name: info.name,
      board_year: placement.get(personId) ?? info.grad_year,
      party_size: null,
      responded_at: null,
    });
  }

  const order: { key: RsvpBreakdownBucket["key"]; label: string }[] = [
    { key: "going", label: "Going" },
    { key: "maybe", label: "Maybe" },
    { key: "not_this_year", label: "Not this year" },
    { key: "claimed_no_rsvp", label: "Claimed, no answer yet" },
  ];

  return {
    eventYear,
    buckets: order.map(({ key, label }) => ({
      key,
      label,
      count: buckets[key].length,
      people: buckets[key].sort(
        (a, b) => (b.board_year ?? 0) - (a.board_year ?? 0) || a.name.localeCompare(b.name),
      ),
    })),
  };
}

/** Where the answers came from. NULL is shown as "unknown", never guessed. */
export async function rsvpSources(): Promise<SourceCount[]> {
  const { data } = await supabaseAdmin.from("rsvps").select("src");
  const tally = new Map<string, number>();
  for (const row of (data ?? []) as { src: string | null }[]) {
    const key = row.src ?? "__null__";
    tally.set(key, (tally.get(key) ?? 0) + 1);
  }
  return [...tally.entries()]
    .map(([src, count]) => ({
      src,
      label: src === "__null__" ? "unknown" : rsvpSourceLabel(src),
      count,
    }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

export type AdminDashboard = {
  isAdmin: true;
  queue: QueueItem[];
  teamNames: TeamNameRow[];
  divisions: DivisionRow[];
  gaps: DataGaps;
  headcount: Headcount;
  digest: DigestCohort[];
  drip: DripData;
  duplicates: DuplicatePair[];
  archived: ArchivedRecord[];
  seasonYear: number;
  editions: EditionRow[];
  sends: SendRow[];
  sendTotals: SendTotals;
  rsvpSources: SourceCount[];
  rsvpBreakdown: RsvpBreakdown;
};

export async function dashboard(): Promise<AdminDashboard> {
  const [queue, teamRes, divisionRes, gaps, heads, digest, drip, duplicates, archived, editions, sends, totals, sources, breakdown] = await Promise.all([
    reviewQueue(),
    supabaseAdmin
      .from("team_names")
      .select("id, division, name, start_year, end_year, confidence")
      .order("division")
      .order("start_year"),
    supabaseAdmin.from("divisions").select("code, label, sort_order, visible").order("sort_order"),
    dataGaps(),
    headcount(),
    organizerDigest(),
    dripData(),
    duplicateCandidates(),
    archivedRecords(),
    listEditions(),
    recentSends(),
    sendTotals(),
    rsvpSources(),
    rsvpBreakdown(),
  ]);
  return {
    isAdmin: true,
    queue,
    teamNames: (teamRes.data ?? []) as TeamNameRow[],
    divisions: (divisionRes.data ?? []) as DivisionRow[],
    gaps,
    headcount: heads,
    digest,
    drip,
    duplicates,
    archived,
    editions,
    sends,
    sendTotals: totals,
    rsvpSources: sources,
    rsvpBreakdown: breakdown,
    seasonYear: CURRENT_SEASON,
  };
}

// ---------------------------------------------------------------- sends

export type SendRow = {
  id: string;
  created_at: string | null;
  kind: string;
  to_email: string | null;
  name: string | null;
  provider: string | null;
  provider_message_id: string | null;
  status: string;
  outcome: string;
  blocked_reason: string | null;
  error: string | null;
};

export type SendTotals = {
  sent: number;
  blocked: number;
  failed: number;
  suppressed: number;
  /** One-click answer links: loads versus taps. A wide gap between the two is
   *  email security scanners opening links before the human ever sees them. */
  linksOpened: number;
  linksConfirmed: number;
};

/** Deliveries are counted on outcome, never on status and never on a null
 *  timestamp. A blocked attempt is not a send. */
export async function sendTotals(): Promise<SendTotals> {
  const totals: SendTotals = {
    sent: 0,
    blocked: 0,
    failed: 0,
    suppressed: 0,
    linksOpened: 0,
    linksConfirmed: 0,
  };
  const outcomes = ["sent", "blocked", "failed", "suppressed"] as const;
  await Promise.all(
    outcomes.map(async (outcome) => {
      const { count } = await supabaseAdmin
        .from("sends")
        .select("id", { count: "exact", head: true })
        .eq("outcome", outcome);
      totals[outcome] = count ?? 0;
    }),
  );
  const { rsvpLinkTotals } = await import("./rsvp-token.server");
  const links = await rsvpLinkTotals();
  totals.linksOpened = links.opened;
  totals.linksConfirmed = links.confirmed;
  return totals;
}

/** The last fifty outbound messages, so a delivery failure is visible on a
 *  screen rather than buried in a log. */
export async function recentSends(): Promise<SendRow[]> {
  const { data } = await supabaseAdmin
    .from("sends")
    .select(
      "id, created_at, kind, to_email, provider, provider_message_id, status, outcome, blocked_reason, error, person_id",
    )
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.person_id as string).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabaseAdmin
      .from("people")
      .select("id, first_name, last_name")
      .in("id", ids);
    for (const p of people ?? []) {
      names.set(
        p.id as string,
        [p.first_name, p.last_name].filter(Boolean).join(" "),
      );
    }
  }

  return rows.map((r) => ({
    id: r.id as string,
    created_at: (r.created_at as string | null) ?? null,
    kind: (r.kind as string | null) ?? "transactional",
    to_email: (r.to_email as string | null) ?? null,
    name: names.get(r.person_id as string) ?? null,
    provider: (r.provider as string | null) ?? null,
    provider_message_id: (r.provider_message_id as string | null) ?? null,
    status: (r.status as string | null) ?? "unknown",
    outcome: (r.outcome as string | null) ?? "sent",
    blocked_reason: (r.blocked_reason as string | null) ?? null,
    error: (r.error as string | null) ?? null,
  }));
}

// ---------------------------------------------------------------- mail

export type MailStatus = {
  fromAddress: string | null;
  fromName: string | null;
  replyTo: string | null;
  siteUrl: string | null;
  hasApiKey: boolean;
  domain: string | null;
  verified: boolean;
  detail: string;
  clickTracking: boolean | null;
  openTracking: boolean | null;
  outboundMode: "transactional_only" | "all";
  outboundSentence: string;
};

export async function mailConfigStatus(): Promise<MailStatus> {
  const { mailStatus } = await import("./mail.server");
  return mailStatus();
}

/** The kill switch. Admin only, audited, and the only writer of this setting. */
export async function setOutboundEmailMode(
  actor: string,
  mode: "transactional_only" | "all",
): Promise<{ ok: boolean; mode: string; detail: string }> {
  const { outboundEmailMode, outboundEmailModeSentence } = await import("./mail.server");
  const before = await outboundEmailMode();
  const { error } = await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "outbound_email_mode", value: mode } as never, { onConflict: "key" });
  if (error) return { ok: false, mode: before, detail: error.message };
  await audit(actor, "outbound_email_mode", "app_settings", "outbound_email_mode", { mode: before }, { mode });
  return { ok: true, mode, detail: outboundEmailModeSentence(mode) };
}

const TEST_SEND_LIMIT = 10;

/** Admin only proof of the whole path. Ten an hour, every use audited, and it
 *  counts against the same global bucket the alumni path uses. */
export async function sendTestMagicLink(
  actor: string | null,
  rawEmail: string,
): Promise<{ ok: boolean; messageId: string | null; provider: string; detail: string }> {
  const email = String(rawEmail ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email))
    return { ok: false, messageId: null, provider: "none", detail: "That address is not readable." };

  const { countRecent, recordThrottleEvent, HOUR } = await import("./throttle.server");
  const used = await countRecent("rsvp_global", "admin_test_send", HOUR);
  if (used >= TEST_SEND_LIMIT)
    return {
      ok: false,
      messageId: null,
      provider: "none",
      detail: `Ten test sends an hour. Try again later.`,
    };
  await recordThrottleEvent("rsvp_global", "admin_test_send");
  await recordThrottleEvent("rsvp_global", "all");

  const { sendMagicLinkEmail } = await import("./mail.server");
  const result = await sendMagicLinkEmail({
    to: email,
    personId: actor,
    firstName: "Hello",
    status: "",
    kind: "admin_test",
  });

  await audit(actor, "admin_test_send", "sends", null, null, {
    to_email: email,
    provider: result.provider,
    provider_message_id: result.messageId,
    sent: result.sent,
    reason: result.reason,
  });

  return {
    ok: result.sent,
    messageId: result.messageId,
    provider: result.provider,
    detail: result.sent
      ? `Sent through ${result.provider}.`
      : (result.reason ?? "The send did not go out."),
  };
}

// ---------------------------------------------------------------- editions

export type EditionEventRow = {
  id: string;
  title: string;
  day_number: number | null;
  division: string | null;
  time_tbd: boolean;
  is_placeholder: boolean;
  location: string | null;
};

export type EditionRow = Edition & {
  going: number;
  event_count: number;
  events: EditionEventRow[];
};

export async function listEditions(): Promise<EditionRow[]> {
  const [editions, counts, eventsRes] = await Promise.all([
    loadEditions(),
    goingCounts(),
    supabaseAdmin
      .from("events")
      .select("id, event_year, title, day_number, division, time_tbd, is_placeholder, location")
      .order("day_number")
      .order("sort_order"),
  ]);
  const byYear = new Map<number, EditionEventRow[]>();
  for (const row of eventsRes.data ?? []) {
    const y = row.event_year as number;
    const list = byYear.get(y) ?? [];
    list.push({
      id: row.id as string,
      title: row.title as string,
      day_number: (row.day_number as number | null) ?? null,
      division: (row.division as string | null) ?? null,
      time_tbd: Boolean(row.time_tbd),
      is_placeholder: Boolean((row as { is_placeholder?: boolean }).is_placeholder),
      location: (row.location as string | null) ?? null,
    });
    byYear.set(y, list);
  }
  return editions.map((e) => ({
    ...e,
    going: counts.get(e.event_year) ?? 0,
    event_count: byYear.get(e.event_year)?.length ?? 0,
    events: byYear.get(e.event_year) ?? [],
  }));
}

/** Placeholder lane events are meant to be replaced, so deleting one is routine. */
export async function deleteEditionEvent(actor: string | null, id: string) {
  const { error } = await supabaseAdmin.from("events").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(actor, "edition.delete_event", "events", id, null, null);
  return { ok: true };
}

export function defaultEditionDates(eventYear: number) {
  return firstOctoberWeekend(eventYear);
}

/** Creating an edition never publishes it and never makes it current. */
export async function createEdition(
  actor: string | null,
  input: { event_year: number; title: string; starts_on?: string | null; ends_on?: string | null },
) {
  const year = Math.trunc(input.event_year);
  if (!Number.isInteger(year) || year < 2000 || year > 2200) throw new Error("That year isn't valid.");
  const fallback = firstOctoberWeekend(year);
  const row = {
    event_year: year,
    title: input.title.trim().slice(0, 120) || `Alumni Weekend ${year}`,
    starts_on: input.starts_on || fallback.starts_on,
    ends_on: input.ends_on || fallback.ends_on,
    is_current: false,
    published: false,
  };
  if (row.ends_on < row.starts_on) throw new Error("The end date is before the start date.");
  const { error } = await supabaseAdmin.from("editions").insert(row);
  if (error) throw new Error(error.message);
  await audit(actor, "edition.create", "editions", String(year), null, row);
  return { ok: true };
}

export async function updateEditionDates(
  actor: string | null,
  input: {
    event_year: number;
    title: string;
    starts_on: string;
    ends_on: string;
    lodging_note?: string | null;
    travel_note?: string | null;
  },
) {
  if (input.ends_on < input.starts_on) throw new Error("The end date is before the start date.");
  const before = await listEditions();
  const { error } = await supabaseAdmin
    .from("editions")
    .update({
      title: input.title.trim().slice(0, 120),
      starts_on: input.starts_on,
      ends_on: input.ends_on,
      lodging_note: input.lodging_note?.trim() ? input.lodging_note.trim().slice(0, 2000) : null,
      travel_note: input.travel_note?.trim() ? input.travel_note.trim().slice(0, 2000) : null,
    })
    .eq("event_year", input.event_year);
  if (error) throw new Error(error.message);
  await audit(
    actor,
    "edition.update",
    "editions",
    String(input.event_year),
    before.find((e) => e.event_year === input.event_year) ?? null,
    input,
  );

  // Conservative bulletin intake: only the two public notes and the dates
  // themselves are worth telling people about. Typo fixes on a title are not.
  const prev = before.find((e) => e.event_year === input.event_year) ?? null;
  const { addPendingUpdate } = await import("./news.server");
  const norm = (v: string | null | undefined) => (v ?? "").trim();
  const stamp = new Date().toISOString().slice(0, 16);
  if (prev && norm(prev.lodging_note) !== norm(input.lodging_note))
    await addPendingUpdate({
      kind: "lodging_note",
      title: "The lodging note changed",
      summary: norm(input.lodging_note).slice(0, 240) || "The lodging note was cleared.",
      category: "Lodging",
      relatedUrl: `${SITE_ORIGIN}/weekend`,
      dedupeKey: `lodging:${input.event_year}:${stamp}`,
    });
  if (prev && norm(prev.travel_note) !== norm(input.travel_note))
    await addPendingUpdate({
      kind: "travel_note",
      title: "The travel note changed",
      summary: norm(input.travel_note).slice(0, 240) || "The travel note was cleared.",
      category: "Travel",
      relatedUrl: `${SITE_ORIGIN}/weekend`,
      dedupeKey: `travel:${input.event_year}:${stamp}`,
    });
  if (prev && (prev.starts_on !== input.starts_on || prev.ends_on !== input.ends_on))
    await addPendingUpdate({
      kind: "edition_dates",
      title: `Alumni Weekend ${input.event_year} dates are set`,
      summary: `${input.starts_on} through ${input.ends_on}.`,
      category: "Weekend",
      relatedUrl: `${SITE_ORIGIN}/weekend`,
      dedupeKey: `dates:${input.event_year}:${input.starts_on}:${input.ends_on}`,
    });
  return { ok: true };
}

/** Publishing does not make an edition current. */
export async function setEditionPublished(actor: string | null, eventYear: number, published: boolean) {
  const { error } = await supabaseAdmin
    .from("editions")
    .update({ published })
    .eq("event_year", eventYear);
  if (error) throw new Error(error.message);
  await audit(actor, "edition.publish", "editions", String(eventYear), null, { published });
  return { ok: true };
}

/** Atomic: the database clears the previous current edition in the same call. */
export async function setEditionCurrent(actor: string | null, eventYear: number) {
  const previous = await loadCurrentEdition().catch(() => null);
  const { error } = await supabaseAdmin.rpc("set_current_edition", { _event_year: eventYear });
  if (error) throw new Error(error.message);
  await audit(
    actor,
    "edition.set_current",
    "editions",
    String(eventYear),
    previous ? { event_year: previous.event_year } : null,
    { event_year: eventYear },
  );
  return { ok: true };
}

/** Events can be added to any edition, so next year is built before it goes live. */
export async function createEditionEvent(
  actor: string | null,
  input: {
    event_year: number;
    title: string;
    day_number: number;
    division: string | null;
    location: string | null;
    notes: string | null;
    time_tbd: boolean;
    starts_at: string | null;
  },
) {
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Give the event a name.");
  const row = {
    event_year: input.event_year,
    title,
    day_number: Math.min(7, Math.max(1, Math.trunc(input.day_number || 1))),
    division: input.division || null,
    location: input.location?.trim().slice(0, 160) || null,
    notes: input.notes?.trim().slice(0, 400) || null,
    time_tbd: input.time_tbd || !input.starts_at,
    starts_at: input.time_tbd ? null : input.starts_at || null,
    sort_order: 0,
  };
  const { data, error } = await supabaseAdmin.from("events").insert(row).select("id").single();
  if (error) throw new Error(error.message);
  await audit(actor, "edition.add_event", "events", (data?.id as string) ?? null, null, row);

  // Only a confirmed time is news. A TBD placeholder waits until it is real.
  if (!row.time_tbd && row.starts_at) {
    const { addPendingUpdate } = await import("./news.server");
    await addPendingUpdate({
      kind: "schedule_confirmed",
      title: `${row.title} is on the schedule`,
      summary: row.location ? `At ${row.location}.` : "",
      category: "Schedule",
      relatedUrl: `${SITE_ORIGIN}/weekend`,
      dedupeKey: `event:${(data?.id as string) ?? row.title}`,
    });
  }
  return { ok: true };
}

export async function listEditionEvents(eventYear: number) {
  const { data } = await supabaseAdmin
    .from("events")
    .select("id, title, day_number, starts_at, time_tbd, location, division")
    .eq("event_year", eventYear)
    .order("day_number")
    .order("sort_order");
  return data ?? [];
}

/**
 * Editing an existing event. Only what the public can see on /weekend counts as
 * news: the day, the start time, the location, or a TBD becoming a real time.
 * Title tidy ups, notes, sort order, and no op saves stay quiet.
 */
export async function updateEditionEvent(
  actor: string | null,
  input: {
    id: string;
    title?: string;
    day_number?: number;
    division?: string | null;
    location?: string | null;
    notes?: string | null;
    time_tbd?: boolean;
    starts_at?: string | null;
  },
) {
  const { data: beforeRow } = await supabaseAdmin
    .from("events")
    .select("id, event_year, title, day_number, division, location, notes, time_tbd, starts_at")
    .eq("id", input.id)
    .maybeSingle();
  if (!beforeRow) throw new Error("That event no longer exists.");
  const before = beforeRow as Record<string, unknown>;

  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") {
    const title = input.title.trim().slice(0, 160);
    if (!title) throw new Error("Give the event a name.");
    patch.title = title;
  }
  if (typeof input.day_number === "number")
    patch.day_number = Math.min(7, Math.max(1, Math.trunc(input.day_number)));
  if (input.division !== undefined) patch.division = input.division || null;
  if (input.location !== undefined) patch.location = input.location?.trim().slice(0, 160) || null;
  if (input.notes !== undefined) patch.notes = input.notes?.trim().slice(0, 400) || null;
  if (input.time_tbd !== undefined || input.starts_at !== undefined) {
    const tbd = input.time_tbd ?? (before.time_tbd as boolean);
    const starts = input.starts_at !== undefined ? input.starts_at : (before.starts_at as string | null);
    patch.time_tbd = tbd || !starts;
    patch.starts_at = tbd ? null : starts || null;
  }
  if (Object.keys(patch).length === 0) return { ok: true, queuedNews: false };

  const { error } = await supabaseAdmin.from("events").update(patch as never).eq("id", input.id);
  if (error) throw new Error(error.message);
  await audit(actor, "edition.update_event", "events", input.id, before as Json, patch as Json);

  const after = { ...before, ...patch };
  const changedDay = after.day_number !== before.day_number;
  const changedTime = String(after.starts_at ?? "") !== String(before.starts_at ?? "");
  const changedPlace =
    String(after.location ?? "").trim().toLowerCase() !==
    String(before.location ?? "").trim().toLowerCase();
  const changedTbd = after.time_tbd !== before.time_tbd;
  if (!changedDay && !changedTime && !changedPlace && !changedTbd) {
    return { ok: true, queuedNews: false };
  }

  // A schedule that is still TBD in every way it just changed is not yet news.
  if (after.time_tbd && !changedPlace && !changedDay) return { ok: true, queuedNews: false };

  const title = String(after.title ?? "The schedule");
  const bits: string[] = [];
  if (changedTbd && !after.time_tbd) bits.push("has a confirmed time");
  else if (changedTime) bits.push("moved to a new time");
  if (changedDay) bits.push("moved to a different day");
  if (changedPlace) bits.push(after.location ? `is now at ${after.location}` : "changed location");
  const summary = bits.length ? `${title} ${bits.join(" and ")}.` : "";

  // Stable per distinct material state, so retries collapse and a later real
  // change still gets its own entry.
  const stamp = [after.day_number, after.starts_at ?? "tbd", String(after.location ?? "").trim()]
    .join("|")
    .toLowerCase();
  const { addPendingUpdate } = await import("./news.server");
  await addPendingUpdate({
    kind: "schedule_changed",
    title: `${title} has a schedule change`,
    summary,
    category: "Schedule",
    relatedUrl: `${SITE_ORIGIN}/weekend`,
    dedupeKey: `event_change:${input.id}:${stamp}`,
  });
  return { ok: true, queuedNews: true };
}

// ------------------------------------------------- sign-in attempts

export type AuthAttemptRow = {
  id: string;
  created_at: string | null;
  email_attempted: string;
  outcome: string;
  detail: string | null;
  name: string | null;
};

/** Every sign-in link request, including the ones the page deliberately keeps
 *  quiet about. A broken submit button used to be indistinguishable from a
 *  working one; this is the screen where it is not. */
export async function recentAuthAttempts(): Promise<AuthAttemptRow[]> {
  const { data } = await supabaseAdmin
    .from("auth_attempts")
    .select("id, created_at, email_attempted, outcome, detail, person_id")
    .order("created_at", { ascending: false })
    .limit(50);

  const rows = (data ?? []) as Record<string, unknown>[];
  const ids = [...new Set(rows.map((r) => r.person_id as string).filter(Boolean))];
  const names = new Map<string, string>();
  if (ids.length > 0) {
    const { data: people } = await supabaseAdmin
      .from("people")
      .select("id, first_name, last_name")
      .in("id", ids);
    for (const p of people ?? []) {
      names.set(p.id as string, [p.first_name, p.last_name].filter(Boolean).join(" "));
    }
  }

  return rows.map((r) => ({
    id: r.id as string,
    created_at: (r.created_at as string | null) ?? null,
    email_attempted: (r.email_attempted as string | null) ?? "",
    outcome: (r.outcome as string | null) ?? "unknown",
    detail: (r.detail as string | null) ?? null,
    name: names.get(r.person_id as string) ?? null,
  }));
}

// ---------------------------------------------------------------- news

/** Every organizer action on the bulletin lands in audit_log like the rest. */
export async function auditNews(
  actor: string | null,
  action: string,
  recordId: string | null,
  after: unknown,
) {
  await audit(actor, action, "news_items", recordId, null, after as Json);
}

export async function saveNewsPending(
  actor: string | null,
  input: {
    id: string;
    title?: string;
    summary?: string;
    category?: string;
    status?: "pending" | "suppressed";
  },
) {
  const patch: Record<string, unknown> = {};
  if (typeof input.title === "string") patch.title = input.title.trim().slice(0, 160);
  if (typeof input.summary === "string") patch.summary = input.summary.trim().slice(0, 400);
  if (typeof input.category === "string") patch.category = input.category;
  if (input.status) patch.status = input.status;
  if (Object.keys(patch).length === 0) return { ok: true };
  const { error } = await supabaseAdmin
    .from("news_pending_updates")
    .update(patch as never)
    .eq("id", input.id);
  if (error) throw new Error(error.message);
  await audit(actor, "news.pending_update", "news_pending_updates", input.id, null, patch as Json);
  return { ok: true };
}

export async function saveNewsItem(
  actor: string | null,
  input: {
    id?: string | null;
    title: string;
    summary: string;
    body: string;
    category: string;
    post_type?: string;
    related_url?: string | null;
    author?: string | null;
    publish?: boolean;
  },
): Promise<{ ok: boolean; id: string | null }> {
  const title = input.title.trim().slice(0, 160);
  if (!title) throw new Error("Give the update a title.");
  const row: Record<string, unknown> = {
    title,
    summary: input.summary.trim().slice(0, 400),
    body: input.body.trim().slice(0, 8000),
    category: input.category,
    post_type: input.post_type === "urgent" ? "urgent" : "manual",
    related_url: input.related_url?.trim() ? input.related_url.trim().slice(0, 500) : null,
    author: input.author?.trim() ? input.author.trim().slice(0, 80) : null,
  };
  if (input.publish) {
    row.status = "published";
    row.published_at = new Date().toISOString();
  } else if (!input.id) {
    row.status = "draft";
  }

  if (input.id) {
    const { error } = await supabaseAdmin.from("news_items").update(row as never).eq("id", input.id);
    if (error) throw new Error(error.message);
    await audit(actor, "news.edit", "news_items", input.id, null, row as Json);
    return { ok: true, id: input.id };
  }

  const { data, error } = await supabaseAdmin
    .from("news_items")
    .insert(row as never)
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Could not save that.");
  const id = (data as { id: string }).id;
  await audit(actor, input.publish ? "news.publish" : "news.draft", "news_items", id, null, row as Json);
  return { ok: true, id };
}

export async function setNewsStatus(
  actor: string | null,
  id: string,
  status: "draft" | "published" | "archived",
) {
  const patch: Record<string, unknown> = { status };
  if (status === "published") patch.published_at = new Date().toISOString();
  const { error } = await supabaseAdmin.from("news_items").update(patch as never).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(actor, `news.${status}`, "news_items", id, null, patch as Json);
  return { ok: true };
}

export async function saveNewsSettings(
  actor: string | null,
  input: { enabled: boolean; daily_digest_time: string; weekly_day: number; weekly_time: string },
) {
  const hhmm = (v: string, fallback: string) => (/^\d{2}:\d{2}$/.test(v) ? v : fallback);
  const patch = {
    enabled: !!input.enabled,
    timezone: "America/New_York",
    daily_digest_time: hhmm(input.daily_digest_time, "19:00"),
    weekly_day: Math.min(6, Math.max(0, Math.trunc(input.weekly_day))),
    weekly_time: hhmm(input.weekly_time, "09:00"),
  };
  const { error } = await supabaseAdmin
    .from("news_settings")
    .update(patch as never)
    .eq("id", true);
  if (error) throw new Error(error.message);
  await audit(actor, "news.settings", "news_settings", "singleton", null, patch as Json);
  const { loadSettings } = await import("./news.server");
  return loadSettings();
}
