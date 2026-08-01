import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { finalizeLogin } from "@/lib/account.functions";
import { requestSignInLink } from "@/lib/signin.functions";
import { useEditionEyebrow } from "@/lib/useEdition";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import pittUltimateShield from "@/assets/pitt-ultimate-shield.png.asset.json";
import { FieldLabel, Notice, fieldStyle, primaryButton, secondaryButton } from "@/components/claim/ui";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Sign in with a one-time link to update your record, your emails and your Alumni Weekend answer.",
      },
      { property: "og:title", content: "Sign in — Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content: "One-time sign-in link for Pitt Club Ultimate alumni. No password, ever.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const runFinalize = useServerFn(finalizeLogin);
  const sendSignInLink = useServerFn(requestSignInLink);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // A returning magic link lands here with a session: link the identity, then go.
  useEffect(() => {
    let done = false;
    const finish = async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session || done) return;
      done = true;
      try {
        await runFinalize();
      } catch {
        /* linking is best effort; the profile page handles the rest */
      }
      navigate({ to: "/me" });
    };
    void finish();
    const { data: sub } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void finish();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate, runFinalize]);

  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await sendSignInLink({
        data: { email: email.trim().toLowerCase(), origin: window.location.origin },
      });
      // Non-disclosure applies to whether the address is on the list, not to
      // whether the request worked. Only a confirmed server response shows
      // the success notice: a broken submit must never look like a sent link.
      if (result && (result as { ok?: boolean }).ok === true) {
        setSent(true);
      } else {
        setError("Something went wrong on our end. Nothing was sent. Try again.");
      }
    } catch (err) {
      console.error("[auth] sign-in link request failed", err);
      setError("Couldn't reach the server, so nothing was sent. Check your connection and try again.");
    }
    setBusy(false);
  };

  const eyebrow = useEditionEyebrow();

  const google = async () => {
    setError(null);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: `${window.location.origin}/auth`,
    });
    if (result.error) setError("Google sign-in didn't work. Try the email link.");
  };

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <div className="flex flex-col items-center">
        <Lockup />
        <p
          className="mt-2"
          style={{
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 13,
            color: "var(--sterling)",
          }}
        >
          Alumni Weekend
        </p>
      </div>
      <div className="mt-10">
        <SlashEyebrow>{eyebrow}</SlashEyebrow>
      </div>
      <h1 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
        SIGN IN
      </h1>

      {sent ? (
        <Notice>
          If that address is on our list, a sign-in link is on its way. Open it on this device and you'll
          land on your record.
        </Notice>
      ) : (
        <form className="mt-6" onSubmit={sendLink}>
          <FieldLabel htmlFor="auth-email">Email</FieldLabel>
          <input
            id="auth-email"
            type="email"
            required
            autoComplete="email"
            inputMode="email"
            style={fieldStyle}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Notice>We'll email you a one-time link. No password, ever.</Notice>
          {error && (
            <p className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
              {error}
            </p>
          )}
          <div className="mt-6 flex flex-col gap-2">
            <button type="submit" style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Sending…" : "Email me a link"}
            </button>
            <button type="button" style={secondaryButton} onClick={() => void google()}>
              Continue with Google
            </button>
          </div>
        </form>
      )}
    </main>
  );
}