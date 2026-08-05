import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { z } from "zod";

import { Lockup } from "@/components/Lockup";
import { Notice, primaryButton, secondaryButton } from "@/components/claim/ui";
import { supabase } from "@/integrations/supabase/client";
import { confirmRsvpLink, readRsvpLink } from "@/lib/rsvp-token.functions";
import { RSVP_STATUSES, STATUS_LABELS, type RsvpStatus } from "@/lib/rsvp-types";

const search = z.object({
  t: z.string().optional(),
  a: z.string().optional(),
});

const QUESTION: Record<RsvpStatus, string> = {
  going: "telling everyone you're going?",
  maybe: "putting yourself down as a maybe?",
  not_this_year: "sitting this year out?",
};

function intended(raw: string | undefined): RsvpStatus {
  return (RSVP_STATUSES as readonly string[]).includes(raw ?? "")
    ? (raw as RsvpStatus)
    : "going";
}

export const Route = createFileRoute("/rsvp")({
  validateSearch: search,
  // The loader reads and logs the open. It writes no RSVP state: a security
  // scanner opening this link records an open and nothing else.
  loader: async ({ location }) => {
    const params = search.parse(location.search);
    const token = params.t ?? "";
    if (!token) throw redirect({ to: "/", search: { link: "expired" } as never });
    const view = await readRsvpLink({ data: { token, intent: params.a ?? null } });
    if (!view.ok) throw redirect({ to: "/", search: { link: "expired" } as never });
    return view;
  },
  head: () => ({
    meta: [
      { title: "Your answer — Pitt Club Ultimate Alumni Weekend" },
      {
        name: "description",
        content: "Confirm your answer for Pitt Club Ultimate Alumni Weekend in one tap.",
      },
      { property: "og:title", content: "Your answer — Pitt Club Ultimate Alumni Weekend" },
      {
        property: "og:description",
        content: "Confirm your answer for Pitt Club Ultimate Alumni Weekend in one tap.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  errorComponent: () => <Stranded />,
  notFoundComponent: () => <Stranded />,
  component: RsvpLinkPage,
});

function Stranded() {
  const navigate = useNavigate();
  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <Lockup />
      <h1 className="display-30 mt-8" style={{ color: "var(--sabah-black)" }}>
        THAT LINK HAS RUN OUT
      </h1>
      <p className="mt-4" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
        Nothing changed on your record. Find your name on the board and answer there instead.
      </p>
      <button type="button" className="mt-6" style={primaryButton} onClick={() => void navigate({ to: "/" })}>
        Go to the board
      </button>
    </main>
  );
}

function RsvpLinkPage() {
  const view = Route.useLoaderData();
  const { t: token = "", a } = Route.useSearch();
  const navigate = useNavigate();
  const commit = useServerFn(confirmRsvpLink);

  const [choice, setChoice] = useState<RsvpStatus>(intended(a));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const others = RSVP_STATUSES.filter((s) => s !== choice);

  const send = async (status: RsvpStatus) => {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    setChoice(status);
    try {
      const result = await commit({
        data: { token, status, origin: window.location.origin },
      });
      if (!result.ok) {
        setFailed(true);
        setBusy(false);
        return;
      }
      // Possession of the link proved the inbox, so the session comes with it.
      // There is no account step, here or anywhere.
      if (result.signInUrl) {
        window.location.href = result.signInUrl;
        return;
      }
      await supabase.auth.getSession();
      await navigate({ to: "/me" });
    } catch {
      setFailed(true);
      setBusy(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-[520px] px-5 py-16">
      <Lockup />
      <p
        className="mt-2"
        style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 13, color: "var(--sterling)" }}
      >
        Alumni Weekend {view.eventYear}
      </p>

      <h1 className="display-30 mt-8" style={{ color: "var(--sabah-black)" }}>
        {(view.firstName ?? "You").toUpperCase()}, {QUESTION[choice].toUpperCase()}
      </h1>

      <p className="mt-4" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
        Nothing is recorded until you tap. One tap and you are done: your answer is saved and you
        are signed in on your own record.
      </p>

      <div className="mt-7 flex flex-col gap-2">
        <button type="button" style={primaryButton} disabled={busy} onClick={() => void send(choice)}>
          {busy ? "Saving…" : `Yes — ${STATUS_LABELS[choice]}`}
        </button>
        {others.map((status) => (
          <button
            key={status}
            type="button"
            style={secondaryButton}
            disabled={busy}
            onClick={() => void send(status)}
          >
            Actually, {STATUS_LABELS[status].toLowerCase()}
          </button>
        ))}
      </div>

      {view.currentStatus && (
        <Notice>
          We currently have you down as {STATUS_LABELS[view.currentStatus].toLowerCase()}. Confirming
          replaces that.
        </Notice>
      )}

      {failed && (
        <Notice>
          We couldn&apos;t save that. Nothing changed. Try the board instead.
        </Notice>
      )}

      <p className="mt-8" style={{ fontSize: 13, color: "var(--sterling)" }}>
        <button
          type="button"
          onClick={() => void navigate({ to: "/" })}
          style={{ textDecoration: "underline", fontSize: 13, color: "var(--sterling)" }}
        >
          This isn&apos;t me
        </button>
      </p>
    </main>
  );
}
