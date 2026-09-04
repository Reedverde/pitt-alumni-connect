import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyPersonId } from "./account-resolve";
import { normalizePartySize, type RsvpStatus } from "./rsvp-types";

const CURRENT_YEAR = new Date().getFullYear();

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

    const personId = await resolveMyPersonId(supabase, context.userId);
    if (!personId) return { person: null, emails: [], stints: [], rsvp: null, rsvpPartySize: 1, edition, attended: [] };

    const { data: mine } = await supabase
      .from("identities")
      .select("id, email, is_primary, verified_at, person_id")
      .eq("person_id", personId)
      .order("is_primary", { ascending: false });

    const [personRes, stintRes, rsvpRes, historyRes] = await Promise.all([
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
      supabase
        .from("rsvps")
        .select("event_year, status")
        .eq("person_id", personId)
        .eq("status", "going"),
    ]);

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
      attended: (historyRes.data ?? [])
        .map((r) => r.event_year as number)
        .filter((y) => y < edition.event_year)
        .sort((a, b) => a - b),
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
    const { error } = await context.supabase
      .from("rsvps")
      .update({ party_size: normalizePartySize("going", data.partySize) })
      .eq("person_id", personId)
      .eq("event_year", eventYear)
      .eq("status", "going");
    if (error) throw new Error(error.message);
    return { ok: true };
  });

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
  }> => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) return { personId: null, firstName: null, rsvpStatus: null };
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
