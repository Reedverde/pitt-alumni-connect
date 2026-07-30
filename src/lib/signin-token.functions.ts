import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Does this sign-in link belong to the person already signed in?
 *
 * Deliberately narrow. It answers with one of four words and nothing else: no
 * email, no name, no person id. Someone holding a forwarded link must not be
 * able to learn whose address it was, and this is the only place the question
 * is asked, so that guarantee lives in one spot.
 *
 * It also does not consume the token. Reading a row is not verifying it, so a
 * person who chooses "Continue as" can still open the same link later.
 *
 * The caller must be signed in: the comparison is always against the session
 * making the request, never against a user id supplied by the browser.
 */
export type SignInTokenState = "same" | "other" | "expired" | "invalid";

export const inspectSignInToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ tokenHash: z.string().min(1).max(512) }).parse(data))
  .handler(async ({ data, context }): Promise<{ state: SignInTokenState }> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: state, error } = await supabaseAdmin.rpc("signin_token_state", {
      _token: data.tokenHash,
      _user_id: context.userId,
    } as never);
    if (error) {
      console.error("[signin-token] state lookup failed", error.message);
      // Fail toward the interstitial. Guessing "same" would hand the wrong
      // record to the wrong person, which is the bug this exists to stop.
      return { state: "other" };
    }
    const value = String(state ?? "invalid");
    return {
      state: (["same", "other", "expired", "invalid"].includes(value)
        ? value
        : "invalid") as SignInTokenState,
    };
  });
