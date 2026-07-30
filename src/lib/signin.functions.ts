import { createServerFn } from "@tanstack/react-start";

/** Sign-in link request from /auth. Routed through our own sender so it is
 *  not subject to the built-in mailer's few-per-hour cap. Always reports the
 *  same result: whether an address is on the list is never disclosed. */
export const requestSignInLink = createServerFn({ method: "POST" })
  .inputValidator((input: { email: string; origin?: string | null }) => input)
  .handler(async ({ data }): Promise<{ ok: true }> => {
    const email = String(data?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) return { ok: true };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: identity } = await supabaseAdmin
      .from("identities")
      .select("person_id")
      .eq("email", email)
      .maybeSingle();
    if (!identity) return { ok: true };

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

    const { sendMagicLinkEmail } = await import("./mail.server");
    await sendMagicLinkEmail({
      to: email,
      personId,
      firstName: (person?.first_name as string | null) ?? null,
      status: (rsvp?.status as string | null) ?? "",
      origin: data?.origin ?? null,
    });
    return { ok: true };
  });