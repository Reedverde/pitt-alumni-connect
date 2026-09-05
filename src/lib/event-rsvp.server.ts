import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { loadCurrentEdition } from "./editions.server";

export type PromptEvent = {
  id: string;
  key: string;
  label: string;
  title: string;
  starts_at: string | null;
  location: string | null;
};

/** Prompt events are the current edition's events flagged prompt_rsvp: only
 *  these collect an individual RSVP answer. Placeholders are eligible too (a
 *  placeholder can still collect interest signal before its time or location
 *  locks). key is the event id itself now, since there is no longer a fixed
 *  small set of named slots to key by. */
export async function loadPromptEvents(): Promise<PromptEvent[]> {
  const edition = await loadCurrentEdition();
  const { data } = await supabaseAdmin
    .from("events")
    .select("id, title, starts_at, location, sort_order")
    .eq("event_year", edition.event_year)
    .eq("prompt_rsvp", true)
    // Only a published, uncancelled event may ask anyone for an answer.
    .eq("published", true)
    .neq("status", "cancelled")
    .order("sort_order", { ascending: true });

  return (data ?? []).map((e) => ({
    id: e.id as string,
    key: e.id as string,
    label: e.title as string,
    title: e.title as string,
    starts_at: (e.starts_at as string | null) ?? null,
    location: (e.location as string | null) ?? null,
  }));
}

export type EventAnswer = { eventId: string; status: "yes" | "no"; partySize?: number | null };

function clampPartySize(status: "yes" | "no", raw: unknown) {
  if (status !== "yes") return 1;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return 1;
  return Math.min(20, Math.max(1, n));
}

/** Writes a person's per event answers.
 *
 *  This runs on the anonymous claim path, so it carries its own authorisation
 *  rather than leaning on row level security:
 *   - the person must be going for the current edition. Nothing else is ever
 *     asked, so nothing else may be written.
 *   - the event must be one of the prompt events on the current edition.
 *  A verified owner can still change their own answers through the same path
 *  because the answer set is not sensitive and is overwritten, never appended. */
export async function submitEventRsvpsServer(input: {
  personId: string;
  answers: EventAnswer[];
}): Promise<{ ok: boolean; written: number }> {
  const edition = await loadCurrentEdition();

  const { data: person } = await supabaseAdmin
    .from("people")
    .select("id, deceased, archived")
    .eq("id", input.personId)
    .maybeSingle();
  if (!person || person.deceased || (person as { archived?: boolean }).archived)
    return { ok: false, written: 0 };

  const { data: rsvp } = await supabaseAdmin
    .from("rsvps")
    .select("status")
    .eq("person_id", input.personId)
    .eq("event_year", edition.event_year)
    .maybeSingle();
  const going = rsvp?.status === "going";
  // A yes to a piece of the weekend from someone not marked going is a
  // promotion, not a rejection: saying yes to the BBQ or the alumni game IS
  // saying you are coming. A no never changes the weekend answer, so the
  // event cards let a maybe rule an event out freely.
  const saysYes = (input.answers ?? []).some((a) => a.status === "yes");
  if (!going && saysYes) {
    const nowIso = new Date().toISOString();
    const { data: promoted, error: promoteError } = await supabaseAdmin
      .from("rsvps")
      .upsert(
        {
          person_id: input.personId,
          event_year: edition.event_year,
          status: "going",
          responded_at: nowIso,
        },
        { onConflict: "person_id,event_year" },
      )
      .select("id")
      .maybeSingle();
    if (promoteError) return { ok: false, written: 0 };
    // Silent on purpose: no confirmation email. The person answered an event
    // question, not a weekend question, and a surprise confirmation is noise.
    await supabaseAdmin.from("audit_log").insert({
      actor_person_id: input.personId,
      action: "rsvp_promoted_by_event_answer",
      table_name: "rsvps",
      record_id: (promoted?.id as string) ?? null,
      after: {
        status: "going",
        previous_status: rsvp?.status ?? null,
        event_year: edition.event_year,
      },
    });
  }




  const allowed = new Set((await loadPromptEvents()).map((e) => e.id));
  let written = 0;

  for (const answer of input.answers ?? []) {
    if (!allowed.has(answer.eventId)) continue;
    const status = answer.status === "no" ? "no" : "yes";
    const { error } = await supabaseAdmin.from("event_rsvps").upsert(
      {
        person_id: input.personId,
        event_id: answer.eventId,
        status,
        party_size: clampPartySize(status, answer.partySize ?? 1),
        responded_at: new Date().toISOString(),
      },
      { onConflict: "person_id,event_id" },
    );
    if (!error) written++;
  }

  return { ok: written > 0, written };
}

export type PersonEventAnswer = {
  event_id: string;
  label: string;
  status: "yes" | "no";
  party_size: number;
};

/** Admin only: every person's answers for the current edition's prompt events,
 *  keyed by person. Joined into the People tab, not a separate dashboard. */
export async function loadEventAnswersByPerson(): Promise<Map<string, PersonEventAnswer[]>> {
  const events = await loadPromptEvents();
  if (events.length === 0) return new Map();
  const labels = new Map(events.map((e) => [e.id, e.label]));

  const { data } = await supabaseAdmin
    .from("event_rsvps")
    .select("person_id, event_id, status, party_size")
    .in(
      "event_id",
      events.map((e) => e.id),
    );

  const out = new Map<string, PersonEventAnswer[]>();
  for (const row of data ?? []) {
    const pid = row.person_id as string;
    const list = out.get(pid) ?? [];
    list.push({
      event_id: row.event_id as string,
      label: labels.get(row.event_id as string) ?? "Event",
      status: (row.status as "yes" | "no") ?? "no",
      party_size: Number(row.party_size ?? 1),
    });
    out.set(pid, list);
  }
  return out;
}

/** Person ids that already answered for at least one prompt event, and the ids
 *  that have answered for every prompt event. The drip prompt only skips people
 *  who have nothing left to answer. */
export async function personIdsWithNothingLeftToAnswer(): Promise<Set<string>> {
  const events = await loadPromptEvents();
  const answered = await loadEventAnswersByPerson();
  const done = new Set<string>();
  if (events.length === 0) return done;
  for (const [pid, list] of answered) {
    if (list.length >= events.length) done.add(pid);
  }
  return done;
}
