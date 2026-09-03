import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { finalizeLogin } from "@/lib/account.functions";
import { clearAuthReturnTo, readAuthReturnTo } from "@/lib/event-intent";

import { inspectSignInToken } from "@/lib/signin-token.functions";
import { getNavIdentity } from "@/lib/account.functions";
import { Lockup } from "@/components/Lockup";
import { Notice, primaryButton, secondaryButton } from "@/components/claim/ui";

const search = z.object({
  token_hash: z.string().optional(),
  type: z.string().optional(),
});

export const Route = createFileRoute("/auth_/callback")({
  // The token lives in the query string and the session lives in the browser,
  // so there is nothing the server can usefully decide here.
  ssr: false,
  validateSearch: search,
  head: () => ({
    meta: [
      { title: "Signing you in — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content: "Opening your one-time sign-in link for Pitt Club Ultimate Alumni.",
      },
      { property: "og:title", content: "Signing you in — Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content: "Opening your one-time sign-in link for Pitt Club Ultimate Alumni.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CallbackPage,
});

type Phase = "working" | "choose" | "expired" | "failed";

function otpType(raw: string | undefined) {
  return raw === "signup" ? ("signup" as const) : ("magiclink" as const);
}

function CallbackPage() {
  const navigate = useNavigate();
  const { token_hash: tokenHash, type } = Route.useSearch();
  const inspect = useServerFn(inspectSignInToken);
  const runFinalize = useServerFn(finalizeLogin);
  const loadIdentity = useServerFn(getNavIdentity);

  const [phase, setPhase] = useState<Phase>("working");
  const [currentName, setCurrentName] = useState<string | null>(null);
  const started = useRef(false);

  /** Spends the token and lands the person on their own record. */
  const consume = useCallback(async () => {
    if (!tokenHash) return;
    setPhase("working");
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type: otpType(type),
    });
    if (error) {
      setPhase(/expired|invalid|not found/i.test(error.message) ? "expired" : "failed");
      return;
    }
    try {
      await runFinalize();
    } catch {
      /* linking is best effort; /me resolves the session either way */
    }
    // Back to the page they started on, when there was one, so a tap made
    // before signing in can be applied without a second tap.
    const back = readAuthReturnTo();
    clearAuthReturnTo();
    if (back) {
      window.location.assign(back);
      return;
    }
    await navigate({ to: "/me" });
  }, [navigate, runFinalize, tokenHash, type]);


  useEffect(() => {
    if (started.current) return;
    started.current = true;

    void (async () => {
      if (!tokenHash) {
        setPhase("expired");
        return;
      }

      const { data } = await supabase.auth.getSession();

      // Nobody signed in: nothing to weigh up, spend the token.
      if (!data.session) {
        await consume();
        return;
      }

      // A session already exists. Find out whose link this is BEFORE touching
      // the token, so that choosing "continue as" leaves it usable.
      let state: string;
      try {
        state = (await inspect({ data: { tokenHash } })).state;
      } catch {
        state = "other";
      }

      if (state === "same") {
        // Same person: no question worth asking, just refresh the session.
        await consume();
        return;
      }
      if (state === "expired" || state === "invalid") {
        setPhase("expired");
        return;
      }

      // A different account. Say so without saying who.
      try {
        const me = await loadIdentity({});
        setCurrentName(me?.firstName ?? null);
      } catch {
        setCurrentName(null);
      }
      setPhase("choose");
    })();
  }, [consume, inspect, loadIdentity, tokenHash]);

  /** Leaves the token untouched and keeps the session that is already here. */
  const continueAsCurrent = async () => {
    await navigate({ to: "/me" });
  };

  /** Clears the current session completely, then spends the token. */
  const switchAccount = async () => {
    setPhase("working");
    try {
      await supabase.auth.signOut({ scope: "global" });
    } catch {
      /* a revoked or already-dead session must not block the new sign-in */
    }
    await supabase.auth.signOut({ scope: "local" }).catch(() => {});
    await consume();
  };

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <div className="flex flex-col items-center">
        <Lockup />
        <p
          className="mt-2"
          style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 13, color: "var(--sterling)" }}
        >
          Alumni Weekend
        </p>
      </div>

      {phase === "working" && (
        <p className="mt-10" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          Signing you in…
        </p>
      )}

      {phase === "choose" && (
        <div className="mt-10">
          <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
            ALREADY SIGNED IN
          </h1>
          <p className="mt-4" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
            You are signed in as {currentName ?? "yourself"}.
          </p>
          <p className="mt-1" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
            This link is for a different account.
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button type="button" style={primaryButton} onClick={() => void continueAsCurrent()}>
              Continue as {currentName ?? "you are"}
            </button>
            <button type="button" style={secondaryButton} onClick={() => void switchAccount()}>
              Sign in with this link instead
            </button>
          </div>
          <Notice>
            Continuing keeps you where you are and leaves the link unused, so it will still work later.
          </Notice>
        </div>
      )}

      {(phase === "expired" || phase === "failed") && (
        <div className="mt-10">
          <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
            {phase === "expired" ? "LINK NO LONGER WORKS" : "SOMETHING WENT WRONG"}
          </h1>
          <p className="mt-4" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
            {phase === "expired"
              ? "That sign-in link has expired or has already been used. They are good for one hour and one visit."
              : "We couldn't finish signing you in. Nothing has changed on your record."}
          </p>
          <div className="mt-6">
            <button type="button" style={primaryButton} onClick={() => void navigate({ to: "/auth" })}>
              Send me a new link
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
