import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyPersonId } from "./account-resolve";
import type { RsvpStatus } from "./rsvp-types";

export type DockEvent = {
  id: string;
  title: string;
  starts_at: string | null;
  location: string | null;
  is_placeholder: boolean;
  /** null is a genuine "no choice made", never collapsed into a no. */
  answer: "yes" | "no" | null;
  party_size: number;
};

export type RsvpDockData = {
  personId: string | null;
  firstName: string | null;
  eventYear: number;
  editionTitle: string;
  status: RsvpStatus | null;
  editable: boolean;
  editableUntil: string | null;
  events: DockEvent[];
};

/**
 * Everything the floating card needs in one read: the edition, the viewer's own
 * master answer, and their per event answers. Owner scoped through the auth
 * identity, never a client supplied person id, and it carries no email.
 *
 * Deliberately lean: the dock rides along on every page, so it must not pull
 * the whole /me profile with it.
 */
export const getMyRsvpDock = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RsvpDockData> => {
    const { supabase } = context;
    const { loadCurrentEdition } = await import("./editions.server");
    const edition = await loadCurrentEdition();

    const [{ data: editableRaw }, { data: untilRaw }] = await Promise.all([
      supabase.rpc("rsvp_is_editable", { _event_year: edition.event_year }),
      supabase.rpc("rsvp_editable_until", { _event_year: edition.event_year }),
    ]);

    const base = {
      eventYear: edition.event_year,
      editionTitle: edition.title,
      editable: editableRaw !== false,
      editableUntil: (untilRaw as string | null) ?? null,
    };

    const personId = await resolveMyPersonId(supabase, context.userId);
    if (!personId)
      return { ...base, personId: null, firstName: null, status: null, events: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [personRes, rsvpRes, eventsRes, answersRes] = await Promise.all([
      supabaseAdmin.from("people").select("first_name").eq("id", personId).maybeSingle(),
      supabaseAdmin
        .from("rsvps")
        .select("status")
        .eq("person_id", personId)
        .eq("event_year", edition.event_year)
        .maybeSingle(),
      supabaseAdmin
        .from("events")
        .select("id, title, starts_at, location, is_placeholder, sort_order")
        .eq("event_year", edition.event_year)
        .eq("published", true)
        .eq("prompt_rsvp", true)
        .order("sort_order"),
      supabaseAdmin
        .from("event_rsvps")
        .select("event_id, status, party_size")
        .eq("person_id", personId),
    ]);

    const byEvent = new Map(
      (answersRes.data ?? []).map((a) => [
        a.event_id as string,
        { status: a.status as string, party: Number(a.party_size ?? 1) },
      ]),
    );

    return {
      ...base,
      personId,
      firstName: (personRes.data?.first_name as string | undefined) ?? null,
      status: ((rsvpRes.data?.status as RsvpStatus | undefined) ?? null),
      events: (eventsRes.data ?? []).map((e) => {
        const row = byEvent.get(e.id as string);
        return {
          id: e.id as string,
          title: e.title as string,
          starts_at: (e.starts_at as string | null) ?? null,
          location: (e.location as string | null) ?? null,
          is_placeholder: Boolean(e.is_placeholder),
          answer: row?.status === "yes" ? "yes" : row?.status === "no" ? "no" : null,
          party_size: Math.min(10, Math.max(1, row?.party ?? 1)),
        } satisfies DockEvent;
      }),
    };
  });
