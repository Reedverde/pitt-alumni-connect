import { Link } from "@tanstack/react-router";
import { useState } from "react";

import { useSessionPerson } from "@/lib/useSessionPerson";
import { NavStatusMenu } from "@/components/nav/NavStatusMenu";
import pittUltimateShield from "@/assets/pitt-ultimate-shield.png.asset.json";

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
    whiteSpace: "nowrap" as const,
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
        {(firstName ?? "You").toUpperCase()}
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
      className="site-nav sticky top-0 z-40 flex items-center gap-2 px-3 sm:gap-3 sm:px-5"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <Link to="/" className="flex items-center gap-[6px] sm:gap-[10px]" aria-label="Pitt Club Ultimate">
        <img
          src={pittUltimateShield.url}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
        />
        <span
          className="max-w-[86px] whitespace-normal sm:max-w-none sm:whitespace-nowrap"
          style={{
            fontFamily: '"Archivo", sans-serif',
            fontWeight: 800,
            fontSize: "clamp(13px, 3.2vw, 20px)",
            lineHeight: 0.95,
            letterSpacing: "-0.02em",
            textTransform: "uppercase",
            color: "var(--pitt-royal)",
          }}
        >
          Pitt Club Ultimate
        </span>
      </Link>

      <span className="ml-1 flex items-center gap-2.5 sm:ml-4 sm:gap-4">
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

      <span className="ml-auto flex items-center gap-3 pl-1">
        <IdentitySlot />
        <NavStatusMenu />
      </span>
    </nav>
  );
}
