import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { resolveMyPersonId } from "./account-resolve";

export type PromptEventDto = {
  id: string;
  label: string;
  title: string;
  starts_at: string | null;
  location: string | null;
};

export type MyEventAnswerDto = {
  eventId: string;
  status: "yes" | "no";
  partySize: number;
};

/** The signed-in viewer's own answers for the current edition's prompt events.
 *  Owner scoped through the auth identity, never a client-supplied person id. */
export const getMyEventAnswers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyEventAnswerDto[]> => {
    const personId = await resolveMyPersonId(context.supabase, context.userId);
    if (!personId) return [];
    const { loadPromptEvents } = await import("./event-rsvp.server");
    const events = await loadPromptEvents();
    if (events.length === 0) return [];
    const { data } = await context.supabase
      .from("event_rsvps")
      .select("event_id, status, party_size")
      .eq("person_id", personId)
      .in(
        "event_id",
        events.map((e) => e.id),
      );
    return (data ?? []).map((row) => ({
      eventId: row.event_id as string,
      status: (row.status as "yes" | "no") ?? "no",
      partySize: Number(row.party_size ?? 1),
    }));
  });


export const getPromptEvents = createServerFn({ method: "GET" }).handler(
  async (): Promise<PromptEventDto[]> => {
    const { loadPromptEvents } = await import("./event-rsvp.server");
    return loadPromptEvents();
  },
);

export const submitEventRsvps = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      personId: string;
      answers: { eventId: string; status: "yes" | "no"; partySize?: number | null }[];
    }) => ({
      personId: String(input?.personId ?? ""),
      answers: Array.isArray(input?.answers) ? input.answers.slice(0, 10) : [],
    }),
  )
  .handler(async ({ data }): Promise<{ ok: boolean; written: number }> => {
    if (!data.personId) return { ok: false, written: 0 };
    const { submitEventRsvpsServer } = await import("./event-rsvp.server");
    return submitEventRsvpsServer(data);
  });
