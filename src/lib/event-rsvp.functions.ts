import { createServerFn } from "@tanstack/react-start";

export type PromptEventDto = {
  id: string;
  key: "bbq" | "alumni_game";
  label: string;
  title: string;
  starts_at: string | null;
  location: string | null;
};

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
