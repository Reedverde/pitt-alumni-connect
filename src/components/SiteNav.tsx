import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useSessionPerson } from "@/lib/useSessionPerson";

const linkStyle = { color: "var(--sterling)" } as const;
const activeStyle = { color: "var(--pitt-royal)" } as const;

/**
 * Plain text, never a button, never gold. Gold means attending and nothing
 * else, so the sign-in affordance carries no visual weight at all.
 */
function IdentitySlot() {
  const { signedIn, firstName } = useSessionPerson();
  const [hover, setHover] = useState(false);
  const style = {
    fontFamily: '"Space Grotesk", system-ui, sans-serif',
    fontSize: 13,
    fontWeight: 500,
    textTransform: "uppercase" as const,
    letterSpacing: "0.08em",
    color: hover ? "var(--steel-ink)" : "var(--sterling)",
    background: "transparent",
    border: "none",
    padding: 0,
  };
  const handlers = {
    onMouseEnter: () => setHover(true),
    onMouseLeave: () => setHover(false),
    onFocus: () => setHover(true),
    onBlur: () => setHover(false),
  };

  if (signedIn) {
    return (
      <Link to="/me" style={style} {...handlers}>
        {firstName ?? "My record"}
      </Link>
    );
  }
  return (
    <Link to="/auth" style={style} {...handlers}>
      Sign in
    </Link>
  );
}

export function SiteNav(_props: { onClaim?: () => void }) {
  return (
    <nav
      className="sticky top-0 z-30 flex h-[72px] items-center gap-3 px-5"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <Link to="/" className="flex items-center gap-[10px]" aria-label="Pitt Club Ultimate">
        {/* Seal ring with monogram. The shield PNG belongs to the footer. */}
        <span
          aria-hidden="true"
          className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full sm:h-10 sm:w-10"
          style={{
            border: "1.5px solid var(--sabah-black)",
            fontFamily: '"Archivo", sans-serif',
            fontWeight: 800,
            fontSize: 11,
            letterSpacing: "-0.02em",
            lineHeight: 1,
            color: "var(--sabah-black)",
          }}
        >
          PCU
        </span>
        <span
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontWeight: 800,
            fontSize: "clamp(13px, 3.6vw, 20px)",
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--pitt-royal)",
            whiteSpace: "nowrap",
          }}
        >
          Pitt Club Ultimate
        </span>
      </Link>

      <span className="ml-3 flex items-center gap-4 sm:ml-4">
        <Link to="/" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }} activeOptions={{ exact: true }}>
          Board
        </Link>
        <Link to="/weekend" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          Weekend
        </Link>
        <Link to="/alumni" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          Alumni
        </Link>
      </span>

      <span className="ml-auto flex items-center gap-3">
        <IdentitySlot />
      </span>
    </nav>
  );
}
