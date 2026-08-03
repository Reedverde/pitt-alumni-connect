import { createServerFn } from "@tanstack/react-start";

/** Sign-in link request from /auth. Routed through our own sender so it is
 *  not subject to the built-in mailer's few-per-hour cap.
 *
 *  Two separate concerns, deliberately split:
 *  - Whether an address is on the list is never disclosed: every branch that
 *    completes returns the same { ok: true } and the page shows one neutral
 *    sentence. What actually happened is written to auth_attempts, which only
 *    an admin can read.
 *  - A transport or code failure is NOT hidden. It throws, the client catches
 *    it, and the page shows an error instead of the success notice. */
export const requestSignInLink = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; origin?: string | null }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    const { logAuthAttempt } = await import("./auth-attempts.server");

    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      await logAuthAttempt({
        email,
        personId: null,
        outcome: "invalid_format",
        detail: "address did not parse",
      });
      return { ok: true };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: identity } = await supabaseAdmin
      .from("identities")
      .select("person_id")
      .eq("email", email)
      .maybeSingle();

    if (!identity) {
      // Inbox possession on an address the organizers preapproved is proof of
      // membership. They have no person record yet, so the link still goes out
      // and /me asks them which name on the board is theirs.
      const { data: preapproved } = await supabaseAdmin
        .from("preapproved_emails")
        .select("email")
        .eq("email", email)
        .maybeSingle();

      if (preapproved) {
        const { sendMagicLinkEmail } = await import("./mail.server");
        await sendMagicLinkEmail({
          to: email,
          personId: null,
          firstName: null,
          status: "",
          origin: data?.origin ?? null,
          kind: "magic_link",
        });
        return { ok: true };
      }

      await logAuthAttempt({
        email,
        personId: null,
        outcome: "no_identity_match",
        detail: "no identity row for that address",
      });
      return { ok: true };
    }

    const personId = identity.person_id as string;
    const { data: person } = await supabaseAdmin
      .from("people")
      .select("first_name")
      .eq("id", personId)
      .maybeSingle();

    const { currentEditionYear } = await import("./editions.server");
    const eventYear = await currentEditionYear();
    const { data: rsvp } = await supabaseAdmin
      .from("rsvps")
      .select("status")
      .eq("person_id", personId)
      .eq("event_year", eventYear)
      .maybeSingle();

    // sendMagicLinkEmail never throws and writes its own auth_attempts row on
    // every branch, so exactly one row exists per request either way.
    const { sendMagicLinkEmail } = await import("./mail.server");
    await sendMagicLinkEmail({
      to: email,
      personId,
      firstName: (person?.first_name as string | null) ?? null,
      status: (rsvp?.status as string | null) ?? "",
      origin: data?.origin ?? null,
      kind: "magic_link",
    });
    return { ok: true };
  });
