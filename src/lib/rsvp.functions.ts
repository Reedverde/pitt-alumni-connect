import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

import type { PersonMatch, RsvpResult, RsvpStatus, RsvpSource } from "./rsvp-types";

export const searchPeople = createServerFn({ method: "POST" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<PersonMatch[]> => {
    const { searchPeopleServer } = await import("./rsvp.server");
    return searchPeopleServer(data.q);
  });

export const submitRsvp = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      personId?: string | null;
      firstName?: string | null;
      lastName?: string | null;
      status: RsvpStatus;
      partySize?: number | null;
      email: string;
      src?: RsvpSource | null;
      origin?: string | null;
    }) => input,
  )
  .handler(async ({ data }): Promise<RsvpResult> => {
    const { submitRsvpServer } = await import("./rsvp.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    return submitRsvpServer(data, ip);
  });
