import { Link } from "@tanstack/react-router";

import { primaryButton } from "@/components/claim/ui";

const linkStyle = { color: "var(--sterling)" } as const;
const activeStyle = { color: "var(--pitt-royal)" } as const;

export function SiteNav({ onClaim }: { onClaim?: () => void }) {
  return (
    <nav
      className="sticky top-0 z-30 flex h-14 items-center gap-3 px-5"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <Link to="/" className="flex items-center gap-3">
        <span
          aria-hidden="true"
          className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-full"
          style={{
            border: "1.5px solid var(--sabah-black)",
            fontFamily: '"Space Mono", monospace',
            fontSize: 11,
            fontWeight: 700,
            color: "var(--sabah-black)",
          }}
        >
          PU
        </span>
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
        <Link to="/why" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          Why
        </Link>
      </span>

      <span className="ml-auto flex items-center gap-3">
        <Link to="/auth" className="label-caps hidden sm:inline" style={linkStyle}>
          Sign in
        </Link>
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
