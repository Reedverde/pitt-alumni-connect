import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyPersonId } from "./account-resolve";
import { normalizePartySize, type RsvpStatus } from "./rsvp-types";

const CURRENT_YEAR = new Date().getFullYear();

/** One row of the annual card's event list. `answer` is null when the person
 *  has genuinely not answered: an unanswered event is never collapsed into a
 *  no. Phase 5 turns these rows into a three position control. */
export type MyEventAnswer = {
  id: string;
  title: string;
  starts_at: string | null;
  ends_at: string | null;
  time_tbd: boolean;
  location: string | null;
  is_placeholder: boolean;
  answer: "yes" | "no" | null;
  /** Heads for this event, meaningful only while the answer is yes. */
  party_size: number;
};

/** A past year, read only. */
export type MyYearAnswer = {
  event_year: number;
  status: RsvpStatus;
  party_size: number;
};

export type MyProfile = {
  person: {
    id: string;
    first_name: string;
    last_name: string | null;
    played_as: string | null;
    current_city: string | null;
    grad_year: number | null;
    show_on_board: boolean;
    share_email: boolean;
    open_to_network: boolean;
  } | null;
  emails: { id: string; email: string; is_primary: boolean; verified: boolean }[];
  stints: { id: string; division: string; role: string; year: number }[];
  rsvp: RsvpStatus | null;
  rsvpPartySize: number;
  edition: { event_year: number; title: string; starts_on: string; ends_on: string } | null;
  attended: number[];
  /** Phase 1 deadline rule: the actual end of the weekend, no grace period. */
  rsvpEditable: boolean;
  rsvpEditableUntil: string | null;
  events: MyEventAnswer[];
  history: MyYearAnswer[];
  divisions: { code: string; label: string }[];
};


export const finalizeLogin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    if (!email) return { linked: false, personId: null };
    const provider =
      ((context.claims as { app_metadata?: { provider?: string } }).app_metadata?.provider ===
      "google"
        ? "google"
        : "magic") as "google" | "magic";
    const { linkAuthUser } = await import("./account.server");
    return linkAuthUser(context.userId, email, provider);
  });

/** True when the signed-in caller has no person record but the organizers
 *  preapproved their address. Drives the claim panel on /me. */
export const amIPreapproved = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ preapproved: boolean }> => {
    const email = (context.claims as { email?: string }).email ?? "";
    if (!email) return { preapproved: false };
    const { isPreapprovedEmail } = await import("./account.server");
    return { preapproved: await isPreapprovedEmail(email) };
  });

/** The signed-in caller points at the name on the board that is theirs. */
export const claimPersonAsMe = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string }) => ({ personId: String(input?.personId ?? "") }))
  .handler(async ({ context, data }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    if (!email) throw new Error("We can't read your address.");
    if (!data.personId) throw new Error("Pick a name first.");
    const { attachMeToPerson } = await import("./account.server");
    return attachMeToPerson({ authUserId: context.userId, email, personId: data.personId });
  });

/** The signed-in caller is on no roster. Auto-approved: the inbox proved it. */
export const addMeAsPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { firstName: string; lastName?: string | null; gradYear?: number | null }) => ({
    firstName: String(input?.firstName ?? ""),
    lastName: input?.lastName ? String(input.lastName) : null,
    gradYear:
      typeof input?.gradYear === "number" && input.gradYear >= 1970 && input.gradYear <= 2100
        ? input.gradYear
        : null,
  }))
  .handler(async ({ context, data }) => {
    const email = (context.claims as { email?: string }).email ?? "";
    if (!email) throw new Error("We can't read your address.");
    const { addMeAsNewPerson } = await import("./account.server");
    return addMeAsNewPerson({
      authUserId: context.userId,
      email,
      firstName: data.firstName,
      lastName: data.lastName,
      gradYear: data.gradYear,
    });
  });

/** The Phase 1 deadline rule, enforced where the write happens. The weekend
 *  ends and the answer stops moving: no grace period, and the page's read only
 *  state is a courtesy, not the boundary. */
async function assertRsvpEditable(
  client: SupabaseClient,
  eventYear: number,
) {
  const { data } = await client.rpc("rsvp_is_editable", { _event_year: eventYear });
  if (data === false)
    throw new Error("That weekend is over, so the answer can no longer be changed.");
}

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase } = context;
    const { loadCurrentEdition } = await import("./editions.server");
    const current = await loadCurrentEdition();
    const edition = {
      event_year: current.event_year,
      title: current.title,
      starts_on: current.starts_on,
      ends_on: current.ends_on,
    };

    // The deadline is the database's answer, not the browser's clock. Phase 1
    // fixed it at the real end of the weekend with no grace period.
    const { data: editableRaw } = await supabase.rpc("rsvp_is_editable", {
      _event_year: edition.event_year,
    });
    const { data: untilRaw } = await supabase.rpc("rsvp_editable_until", {
      _event_year: edition.event_year,
    });
    const rsvpEditable = editableRaw !== false;
    const rsvpEditableUntil = (untilRaw as string | null) ?? null;

    const { data: divisionRows } = await supabase
      .from("divisions")
      .select("code, label, sort_order, visible")
      .eq("visible", true)
      .order("sort_order");
    const divisions = (divisionRows ?? []).map((d) => ({
      code: d.code as string,
      label: d.label as string,
    }));

    const personId = await resolveMyPersonId(supabase, context.userId);
    if (!personId)
      return {
        person: null,
        emails: [],
        stints: [],
        rsvp: null,
        rsvpPartySize: 1,
        edition,
        attended: [],
        rsvpEditable,
        rsvpEditableUntil,
        events: [],
        history: [],
        divisions,
      };

    const { data: mine } = await supabase
      .from("identities")
      .select("id, email, is_primary, verified_at, person_id")
      .eq("person_id", personId)
      .order("is_primary", { ascending: false });

    const [personRes, stintRes, rsvpRes, historyRes, eventsRes] = await Promise.all([
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, played_as, current_city, grad_year, show_on_board, share_email, open_to_network",
        )
        .eq("id", personId)
        .maybeSingle(),
      supabase.from("stints").select("id, division, role, year").eq("person_id", personId).order("year"),
      // party_size is not readable by the authenticated role any more, so the
      // owner's own detail is read server side, scoped to the resolved person.
      (async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return supabaseAdmin
          .from("rsvps")
          .select("status, party_size")
          .eq("person_id", personId)
          .eq("event_year", edition.event_year)
          .maybeSingle();
      })(),
      // Every past answer, not only the yesses: the history is a record of what
      // this person said, including the years they sat out.
      (async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        return supabaseAdmin
          .from("rsvps")
          .select("event_year, status, party_size")
          .eq("person_id", personId)
          .order("event_year", { ascending: false });
      })(),
      // The edition's published events that ask a question, with this person's
      // own answer. A missing row stays null: unanswered is not a no.
      (async () => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: events } = await supabaseAdmin
          .from("events")
          .select(
            "id, title, starts_at, ends_at, time_tbd, location, is_placeholder, sort_order, published, prompt_rsvp",
          )
          .eq("event_year", edition.event_year)
          .eq("published", true)
          .eq("prompt_rsvp", true)
          .order("sort_order");
        const { data: answers } = await supabaseAdmin
          .from("event_rsvps")
          .select("event_id, status, party_size")
          .eq("person_id", personId);
        const byEvent = new Map(
          (answers ?? []).map((a) => [
            a.event_id as string,
            { status: a.status as string, party: Number(a.party_size ?? 1) },
          ]),
        );
        return (events ?? []).map((e) => {
          const row = byEvent.get(e.id as string);
          const answer = row?.status;
          return {
            id: e.id as string,
            title: e.title as string,
            starts_at: (e.starts_at as string | null) ?? null,
            ends_at: (e.ends_at as string | null) ?? null,
            time_tbd: Boolean(e.time_tbd),
            location: (e.location as string | null) ?? null,
            is_placeholder: Boolean(e.is_placeholder),
            answer: answer === "yes" ? "yes" : answer === "no" ? "no" : null,
            party_size: Math.min(10, Math.max(1, row?.party ?? 1)),
          } satisfies MyEventAnswer;
        });
      })(),
    ]);

    const allAnswers = (historyRes.data ?? []) as {
      event_year: number;
      status: string;
      party_size: number | null;
    }[];

    return {
      person: (personRes.data ?? null) as MyProfile["person"],
      emails: (mine ?? []).map((row) => ({
        id: row.id as string,
        email: row.email as string,
        is_primary: Boolean(row.is_primary),
        verified: Boolean(row.verified_at),
      })),
      stints: (stintRes.data ?? []) as MyProfile["stints"],
      rsvp: ((rsvpRes.data?.status as RsvpStatus | undefined) ?? null),
      rsvpPartySize: Number(rsvpRes.data?.party_size ?? 1),
      edition,
      attended: allAnswers
        .filter((r) => r.status === "going" && r.event_year < edition.event_year)
        .map((r) => r.event_year)
        .sort((a, b) => a - b),
      rsvpEditable,
      rsvpEditableUntil,
      events: eventsRes,
      history: allAnswers
        .filter((r) => r.event_year !== edition.event_year)
        .map((r) => ({
          event_year: r.event_year,
          status: r.status as RsvpStatus,
          party_size: Number(r.party_size ?? 1),
        })),
      divisions,

    };
  });

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      personId: string;
      first_name: string;
      last_name: string | null;
      played_as: string | null;
      current_city: string | null;
      show_on_board: boolean;
      share_email: boolean;
      open_to_network: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const first = data.first_name.trim().slice(0, 80);
    if (!first) throw new Error("Your name can't be blank.");
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    // The person wins over seed data: saved outright, never queued for review.
    const { error } = await context.supabase
      .from("people")
      .update({
        first_name: first,
        last_name: data.last_name?.trim().slice(0, 80) || null,
        played_as: data.played_as?.trim().slice(0, 80) || null,
        current_city: data.current_city?.trim().slice(0, 120) || null,
        show_on_board: data.show_on_board,
        share_email: data.share_email,
        open_to_network: data.open_to_network,
      })
      .eq("id", personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; email: string }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error("That email doesn't look right.");
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("identities")
      .insert({ person_id: personId, email, provider: "magic", is_primary: false });
    if (error) throw new Error("Couldn't add that address.");
    return { ok: true };
  });

export const removeMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("identities")
      .delete()
      .eq("id", data.id)
      .eq("person_id", personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; id: string }) => input)
  .handler(async ({ data, context }) => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    await context.supabase
      .from("identities")
      .update({ is_primary: false, primary_set_manually_at: null })
      .eq("person_id", personId);
    const { error } = await context.supabase
      .from("identities")
      // Stamping the manual choice stops a later verification from moving it.
      .update({ is_primary: true, primary_set_manually_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("person_id", personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string | null; personId: string; division: string; role: string; year: number }) => input)
  .handler(async ({ data, context }) => {
    if (data.year === CURRENT_YEAR) throw new Error("The current season can't be edited.");
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const payload = {
      person_id: personId,
      division: data.division,
      role: data.role,
      year: data.year,
      source: "self",
    };
    const { error } = data.id
      ? await context.supabase
          .from("stints")
          .update(payload)
          .eq("id", data.id)
          .eq("person_id", personId)
      : await context.supabase.from("stints").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const { error } = await context.supabase
      .from("stints")
      .delete()
      .eq("id", data.id)
      .eq("person_id", personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; status: RsvpStatus; partySize?: number | null }) => input)
  .handler(async ({ data, context }) => {
    const { currentEditionYear } = await import("./editions.server");
    const eventYear = await currentEditionYear();
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    await assertRsvpEditable(context.supabase, eventYear);
    const { data: existing } = await context.supabase
      .from("rsvps")
      .select("id")
      .eq("person_id", personId)
      .eq("event_year", eventYear)
      .maybeSingle();
    // An omitted party size means "don't touch it": the board's status bar
    // changes the answer without knowing the heads already on record.
    const partySizePatch =
      data.partySize == null && data.status === "going"
        ? {}
        : { party_size: normalizePartySize(data.status, data.partySize ?? 1) };
    const { error } = existing
      ? await context.supabase
          .from("rsvps")
          .update({
            status: data.status,
            ...partySizePatch,
            responded_at: new Date().toISOString(),
          })
          .eq("id", existing.id as string)
          .eq("person_id", personId)
      : await context.supabase
          .from("rsvps")
          .insert({
            person_id: personId,
            event_year: eventYear,
            status: data.status,
            party_size: normalizePartySize(data.status, data.partySize ?? 1),
            src: "email",
          });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Heads only. Never touches status: changing the number is not a new answer. */
export const setMyPartySize = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { partySize: number }) => input)
  .handler(async ({ data, context }) => {
    const { currentEditionYear } = await import("./editions.server");
    const eventYear = await currentEditionYear();
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    await assertRsvpEditable(context.supabase, eventYear);
    const { error } = await context.supabase
      .from("rsvps")
      .update({ party_size: normalizePartySize("going", data.partySize) })
      .eq("person_id", personId)
      .eq("event_year", eventYear)
      .eq("status", "going");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** One event, one answer, saved on its own.
 *
 *  "unanswered" deletes the row rather than writing a no, so the organizers'
 *  reports keep silence and a refusal apart. A yes from someone who is not
 *  marked going promotes the weekend answer to going, and the caller is told
 *  so it can say that out loud rather than changing it invisibly. */
export const setMyEventAnswer = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { eventId: string; state: "yes" | "no" | "unanswered"; partySize?: number | null }) => ({
      eventId: String(input?.eventId ?? ""),
      state:
        input?.state === "yes" ? ("yes" as const) : input?.state === "no" ? ("no" as const) : ("unanswered" as const),
      partySize: input?.partySize ?? 1,
    }),
  )
  .handler(
    async ({ data, context }): Promise<{ ok: true; promotedToGoing: boolean }> => {
      const { currentEditionYear } = await import("./editions.server");
      const eventYear = await currentEditionYear();
      const personId = await resolveMyPersonId(context.supabase, context.userId);
      if (!personId) throw new Error("Forbidden");
      await assertRsvpEditable(context.supabase, eventYear);

      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

      // The event has to be one this edition actually asks about.
      const { data: event } = await supabaseAdmin
        .from("events")
        .select("id")
        .eq("id", data.eventId)
        .eq("event_year", eventYear)
        .eq("published", true)
        .eq("prompt_rsvp", true)
        .maybeSingle();
      if (!event) throw new Error("That event is not asking for an answer.");

      if (data.state === "unanswered") {
        const { error } = await supabaseAdmin
          .from("event_rsvps")
          .delete()
          .eq("person_id", personId)
          .eq("event_id", data.eventId);
        if (error) throw new Error(error.message);
        return { ok: true, promotedToGoing: false };
      }

      const heads =
        data.state === "yes"
          ? Math.min(10, Math.max(1, Math.round(Number(data.partySize ?? 1)) || 1))
          : 1;

      const { error } = await supabaseAdmin.from("event_rsvps").upsert(
        {
          person_id: personId,
          event_id: data.eventId,
          status: data.state,
          party_size: heads,
          responded_at: new Date().toISOString(),
        },
        { onConflict: "person_id,event_id" },
      );
      if (error) throw new Error(error.message);

      let promotedToGoing = false;
      if (data.state === "yes") {
        const { data: rsvp } = await supabaseAdmin
          .from("rsvps")
          .select("id, status")
          .eq("person_id", personId)
          .eq("event_year", eventYear)
          .maybeSingle();
        if (rsvp?.status !== "going") {
          const { data: promoted } = await supabaseAdmin
            .from("rsvps")
            .upsert(
              {
                person_id: personId,
                event_year: eventYear,
                status: "going",
                responded_at: new Date().toISOString(),
              },
              { onConflict: "person_id,event_year" },
            )
            .select("id")
            .maybeSingle();
          promotedToGoing = true;
          await supabaseAdmin.from("audit_log").insert({
            actor_person_id: personId,
            action: "rsvp_promoted_by_event_answer",
            table_name: "rsvps",
            record_id: (promoted?.id as string) ?? null,
            after: {
              status: "going",
              previous_status: rsvp?.status ?? null,
              event_year: eventYear,
              event_id: data.eventId,
            },
          });
        }
      }

      return { ok: true, promotedToGoing };
    },
  );

export const suggestNewPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      submittedBy: string;
      first_name: string;
      last_name: string | null;
      played_as: string | null;
      grad_year: number | null;
      division: string | null;
      note: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    if (!data.first_name.trim()) throw new Error("Please enter a name.");
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const { error } = await context.supabase.from("suggestions").insert({
      submitted_by: personId,
      type: "new_person",
      status: "pending",
      payload: {
        first_name: data.first_name.trim().slice(0, 80),
        last_name: data.last_name?.trim().slice(0, 80) || null,
        played_as: data.played_as?.trim().slice(0, 80) || null,
        grad_year: data.grad_year,
        division: data.division,
        note: data.note?.trim().slice(0, 500) || null,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reportMemorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { submittedBy: string; personId: string; note: string }) => input)
  .handler(async ({ data, context }) => {
    // Never trust a client-supplied submittedBy: resolve the acting person server-side.
    const { data: actingPersonId } = await context.supabase.rpc("current_person_id");
    if (!actingPersonId) throw new Error("Forbidden");
    const { fileMemorialReport } = await import("./account.server");
    return fileMemorialReport(actingPersonId, data.personId, data.note.slice(0, 1000));
  });

export const getPendingVerifications = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string }) => input)
  .handler(async ({ context }) => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) return [];
    const { pendingForPeer } = await import("./account.server");
    return pendingForPeer(personId);
  });

export const vouchForPerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { suggestionId: string; personId: string }) => input)
  .handler(async ({ data, context }) => {
    // The voucher is always the signed-in member, never a client-supplied id.
    const { data: actingPersonId } = await context.supabase.rpc("current_person_id");
    if (!actingPersonId) throw new Error("Forbidden");
    const { vouchForSuggestion } = await import("./account.server");
    return vouchForSuggestion(data.suggestionId, actingPersonId);
  });

/** Read by the (not yet built) admin page: anything unverified after 7 days. */
export const getStaleQueue = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!isAdmin) throw new Error("Forbidden");
    const { staleSuggestions } = await import("./account.server");
    return staleSuggestions();
  });
/**
 * Nav identity only. Returns the signed-in person's first name and id so the
 * nav can render "Reed" instead of "Sign in". Selects nothing else: no email
 * column, no other person's row.
 */
export const getNavIdentity = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    personId: string | null;
    firstName: string | null;
    rsvpStatus: RsvpStatus | null;
    isAdmin: boolean;
  }> => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    const { data: isAdmin } = await context.supabase.rpc("is_admin");
    if (!personId)
      return { personId: null, firstName: null, rsvpStatus: null, isAdmin: Boolean(isAdmin) };
    const { currentEditionYear } = await import("./editions.server");
    const eventYear = await currentEditionYear();
    const [personRes, rsvpRes] = await Promise.all([
      context.supabase.from("people").select("first_name").eq("id", personId).maybeSingle(),
      context.supabase
        .from("rsvps")
        .select("status")
        .eq("person_id", personId)
        .eq("event_year", eventYear)
        .maybeSingle(),
    ]);
    return {
      personId,
      firstName: (personRes.data?.first_name as string | null) ?? null,
      rsvpStatus: ((rsvpRes.data?.status as RsvpStatus | undefined) ?? null),
      isAdmin: Boolean(isAdmin),
    };
  });

/**
 * A member offers a way to reach an alum who has no email on file. Nothing is
 * applied automatically: it lands in the admin review queue as a contact tip.
 * The tip is write-only from the board; no existing address is ever returned.
 */
export const suggestContactTip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { personId: string; contactValue: string; contextNote: string }) => input,
  )
  .handler(async ({ data, context }) => {
    const contact = data.contactValue.trim();
    if (contact.length < 3) throw new Error("Please enter an email or phone number.");
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) throw new Error("Forbidden");
    const { error } = await context.supabase.from("suggestions").insert({
      submitted_by: personId,
      type: "contact_tip",
      status: "pending",
      payload: {
        person_id: data.personId,
        contact_value: contact.slice(0, 200),
        context_note: data.contextNote.trim().slice(0, 200) || null,
      },
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });
