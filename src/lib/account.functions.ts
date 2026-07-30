import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { RsvpStatus } from "./rsvp-types";

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

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase } = context;
    const { data: mine } = await supabase
      .from("identities")
      .select("id, email, is_primary, verified_at, person_id")
      .order("is_primary", { ascending: false });

    const { loadCurrentEdition } = await import("./editions.server");
    const current = await loadCurrentEdition();
    const edition = {
      event_year: current.event_year,
      title: current.title,
      starts_on: current.starts_on,
      ends_on: current.ends_on,
    };

    const personId = mine?.[0]?.person_id as string | undefined;
    if (!personId) return { person: null, emails: [], stints: [], rsvp: null, edition, attended: [] };

    const [personRes, stintRes, rsvpRes, historyRes] = await Promise.all([
      supabase
        .from("people")
        .select(
          "id, first_name, last_name, played_as, current_city, grad_year, show_on_board, share_email, open_to_network",
        )
        .eq("id", personId)
        .maybeSingle(),
      supabase.from("stints").select("id, division, role, year").eq("person_id", personId).order("year"),
      supabase
        .from("rsvps")
        .select("status")
        .eq("person_id", personId)
        .eq("event_year", edition.event_year)
        .maybeSingle(),
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
        needs_review: false,
      })
      .eq("id", data.personId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const addMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; email: string }) => input)
  .handler(async ({ data, context }) => {
    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) throw new Error("That email doesn't look right.");
    const { error } = await context.supabase
      .from("identities")
      .insert({ person_id: data.personId, email, provider: "magic", is_primary: false });
    if (error) throw new Error("Couldn't add that address.");
    return { ok: true };
  });

export const removeMyEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("identities").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryEmail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; id: string }) => input)
  .handler(async ({ data, context }) => {
    await context.supabase
      .from("identities")
      .update({ is_primary: false, primary_set_manually_at: null })
      .eq("person_id", data.personId);
    const { error } = await context.supabase
      .from("identities")
      // Stamping the manual choice stops a later verification from moving it.
      .update({ is_primary: true, primary_set_manually_at: new Date().toISOString() })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id?: string | null; personId: string; division: string; role: string; year: number }) => input)
  .handler(async ({ data, context }) => {
    if (data.year === CURRENT_YEAR) throw new Error("The current season can't be edited.");
    const payload = {
      person_id: data.personId,
      division: data.division,
      role: data.role,
      year: data.year,
      source: "self",
    };
    const { error } = data.id
      ? await context.supabase.from("stints").update(payload).eq("id", data.id)
      : await context.supabase.from("stints").insert(payload);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("stints").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setMyRsvp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; status: RsvpStatus }) => input)
  .handler(async ({ data, context }) => {
    const { currentEditionYear } = await import("./editions.server");
    const eventYear = await currentEditionYear();
    const { data: existing } = await context.supabase
      .from("rsvps")
      .select("id")
      .eq("person_id", data.personId)
      .eq("event_year", eventYear)
      .maybeSingle();
    const { error } = existing
      ? await context.supabase
          .from("rsvps")
          .update({ status: data.status, responded_at: new Date().toISOString() })
          .eq("id", existing.id as string)
      : await context.supabase
          .from("rsvps")
          .insert({ person_id: data.personId, event_year: eventYear, status: data.status, src: "email" });
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
    const { error } = await context.supabase.from("suggestions").insert({
      submitted_by: data.submittedBy,
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
  .handler(async ({ data }) => {
    const { pendingForPeer } = await import("./account.server");
    return pendingForPeer(data.personId);
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