import { createServerFn } from "@tanstack/react-start";
import { getRequestIP } from "@tanstack/react-start/server";

import type { PersonMatch, RsvpResult, RsvpStatus, RsvpSource } from "./rsvp-types";
import type {
  ClaimResult,
  DivisionOption,
  MissingPersonInput,
  MissingPersonResult,
  RosterCorrectionInput,
} from "./claim-types";

export const searchPeople = createServerFn({ method: "POST" })
  .inputValidator((input: { q: string }) => ({ q: String(input?.q ?? "").slice(0, 120) }))
  .handler(async ({ data }): Promise<PersonMatch[]> => {
    const { searchPeopleServer } = await import("./rsvp.server");
    return searchPeopleServer(data.q);
  });

export const listDivisions = createServerFn({ method: "GET" }).handler(
  async (): Promise<DivisionOption[]> => {
    const { listDivisionsServer } = await import("./rsvp.server");
    return listDivisionsServer();
  },
);

/** Claiming a profile. Never writes an RSVP row: someone who stops here stays
 *  genuinely unanswered for the year. */
export const claimProfile = createServerFn({ method: "POST" })
  .inputValidator(
    (input: {
      personId: string;
      email: string;
      src?: RsvpSource | null;
      origin?: string | null;
    }) => input,
  )
  .handler(async ({ data }): Promise<ClaimResult> => {
    const { submitClaimServer } = await import("./rsvp.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    return submitClaimServer(data, ip);
  });

export const submitMissingPerson = createServerFn({ method: "POST" })
  .inputValidator((input: MissingPersonInput) => input)
  .handler(async ({ data }): Promise<MissingPersonResult> => {
    const { submitMissingPersonServer } = await import("./rsvp.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    return submitMissingPersonServer(data, ip);
  });

export const submitRosterCorrection = createServerFn({ method: "POST" })
  .inputValidator((input: RosterCorrectionInput) => input)
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { submitRosterCorrectionServer } = await import("./rsvp.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    return submitRosterCorrectionServer(data, ip);
  });

/** "Looks right" in the claim flow. Records an explicit profile review. */
export const confirmRosterFacts = createServerFn({ method: "POST" })
  .inputValidator((input: { personId: string; email: string }) => ({
    personId: String(input?.personId ?? ""),
    email: String(input?.email ?? ""),
  }))
  .handler(async ({ data }): Promise<{ ok: boolean }> => {
    const { confirmRosterFactsServer } = await import("./rsvp.server");
    return confirmRosterFactsServer(data);
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
      skipConfirmationEmail?: boolean | null;
    }) => input,
  )
  .handler(async ({ data }): Promise<RsvpResult> => {
    const { submitRsvpServer } = await import("./rsvp.server");
    const ip = getRequestIP({ xForwardedFor: true }) ?? "unknown";
    return submitRsvpServer(data, ip);
  });
