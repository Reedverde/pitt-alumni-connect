import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

import { primaryButton } from "./ui";
import { useSessionPerson } from "@/lib/useSessionPerson";
import { STATUS_LABELS, type RsvpStatus } from "@/lib/rsvp-types";

const heading = {
  fontFamily: '"Archivo", sans-serif',
  fontWeight: 800,
  fontSize: 30,
  letterSpacing: "-0.025em",
  color: "var(--sabah-black)",
} as const;

const quietLink = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  color: "var(--sterling)",
} as const;

function Shell({ title, body, children }: { title: string; body: string; children: ReactNode }) {
  return (
    <section className="mt-16 border-t pt-10" style={{ borderColor: "var(--chalk)" }}>
      <h2 style={heading}>{title}</h2>
      <p className="mt-3 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
        {body}
      </p>
      <div className="mt-6">{children}</div>
    </section>
  );
}

/** Bottom-of-page ask. Never gold: gold means attending. */
export function ClosingCta({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action:
    | { kind: "rsvp"; label: string; onOpen: () => void }
    | { kind: "link"; label: string; to: string };
}) {
  const { signedIn, rsvpStatus } = useSessionPerson();

  if (signedIn && rsvpStatus) {
    return (
      <Shell
        title="You already answered"
        body={`Your answer for this year: ${STATUS_LABELS[rsvpStatus as RsvpStatus] ?? rsvpStatus}.`}
      >
        <Link to="/me" style={quietLink}>
          Change your answer
        </Link>
      </Shell>
    );
  }

  return (
    <Shell title={title} body={body}>
      {action.kind === "rsvp" ? (
        <button type="button" onClick={action.onOpen} style={primaryButton}>
          {action.label}
        </button>
      ) : (
        <Link to={action.to} style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
          {action.label}
        </Link>
      )}
    </Shell>
  );
}
