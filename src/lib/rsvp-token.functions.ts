import { createServerFn } from "@tanstack/react-start";

import type { RsvpStatus } from "./rsvp-types";

export type RsvpLinkView = {
  ok: boolean;
  firstName: string | null;
  eventYear: number | null;
  currentStatus: RsvpStatus | null;
};

/** Read-only. Called from the /rsvp loader so that an open is recorded even
 *  when the visitor never runs JavaScript, which is exactly what a scanner
 *  does. It writes no RSVP state of any kind. */
export const readRsvpLink = createServerFn({ method: "GET" })
  .inputValidator((input: { token: string; intent?: string | null }) => input)
  .handler(async ({ data }): Promise<RsvpLinkView> => {
    const { loadRsvpTokenTarget } = await import("./rsvp-token.server");
    const target = await loadRsvpTokenTarget(String(data?.token ?? ""), data?.intent ?? null);
    if (!target) return { ok: false, firstName: null, eventYear: null, currentStatus: null };
    return {
      ok: true,
      firstName: target.firstName,
      eventYear: target.eventYear,
      currentStatus: target.currentStatus,
    };
  });

export type RsvpLinkCommitResult = {
  ok: boolean;
  status: RsvpStatus | null;
  firstName: string | null;
  signInUrl: string | null;
};

/** The tap. This is the only path that writes. */
export const confirmRsvpLink = createServerFn({ method: "POST" })
  .inputValidator((input: { token: string; status: string; origin?: string | null }) => input)
  .handler(async ({ data }): Promise<RsvpLinkCommitResult> => {
    const { commitRsvpToken } = await import("./rsvp-token.server");
    const result = await commitRsvpToken(
      String(data?.token ?? ""),
      String(data?.status ?? ""),
      data?.origin ?? null,
    );
    if (!result.ok) return { ok: false, status: null, firstName: null, signInUrl: null };
    return {
      ok: true,
      status: result.status,
      firstName: result.firstName,
      signInUrl: result.signInUrl,
    };
  });
