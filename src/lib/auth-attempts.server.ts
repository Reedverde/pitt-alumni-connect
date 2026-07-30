import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type AuthAttemptOutcome =
  | "sent"
  | "fallback_sent"
  | "no_identity_match"
  | "invalid_format"
  | "send_failed"
  | "suppressed";

/** Exactly one row per sign-in link request, on every branch including the
 *  silent ones. The user is told the same neutral sentence either way; this is
 *  where an organizer can see what actually happened. Never a link, never a
 *  token: the detail column carries an error string or nothing. */
export async function logAuthAttempt(input: {
  email: string;
  personId: string | null;
  outcome: AuthAttemptOutcome;
  detail?: string | null;
}) {
  try {
    await supabaseAdmin.from("auth_attempts").insert({
      email_attempted: input.email.trim().toLowerCase().slice(0, 320),
      person_id: input.personId,
      outcome: input.outcome,
      detail: input.detail ? String(input.detail).slice(0, 500) : null,
    } as never);
  } catch (err) {
    // Logging must never be the reason a sign-in fails.
    console.error(`[auth-attempt] could not record the attempt: ${String(err)}`);
  }
}
