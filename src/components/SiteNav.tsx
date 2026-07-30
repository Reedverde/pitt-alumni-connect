import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { primaryButton } from "@/components/claim/ui";
import { useSessionPerson } from "@/lib/useSessionPerson";
import pittClubUltimateLogo from "@/assets/pitt-club-ultimate-logo.png.asset.json";

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

export function SiteNav({ onClaim }: { onClaim?: () => void }) {
  return (
    <nav
      className="sticky top-0 z-30 flex h-14 items-center gap-3 px-5"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <Link to="/" className="flex items-center gap-3">
        <img
          src={pittClubUltimateLogo.url}
          alt="Pitt Club Ultimate"
          width={34}
          height={34}
          className="h-[34px] w-[34px] object-contain"
        />
        <span
          className="hidden sm:inline"
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontWeight: 800,
            fontSize: 16,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--pitt-royal)",
          }}
        >
          Pitt Club Ultimate
        </span>
      </Link>

      <span className="ml-4 flex items-center gap-4">
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
        {onClaim ? (
          <button type="button" style={{ ...primaryButton, padding: "8px 14px" }} onClick={onClaim}>
            Claim your name
          </button>
        ) : (
          <Link to="/" style={{ ...primaryButton, padding: "8px 14px" }}>
            Claim your name
          </Link>
        )}
      </span>
    </nav>
  );
}
