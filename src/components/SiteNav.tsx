import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useSessionPerson } from "@/lib/useSessionPerson";
import { NavStatusMenu } from "@/components/nav/NavStatusMenu";
import pittUltimateShield from "@/assets/pitt-ultimate-shield.png.asset.json";

const linkStyle = { color: "var(--sterling)" } as const;
const activeStyle = { color: "var(--pitt-royal)" } as const;

/**
 * Plain text, never a button, never gold. Gold means attending and nothing
 * else, so the sign-in affordance carries no visual weight at all.
 */
function IdentitySlot({ className }: { className?: string }) {
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
      <Link to="/me" className={className} style={style} {...handlers}>
        {(firstName ?? "You").toUpperCase()}
      </Link>
    );
  }
  return (
    <Link to="/auth" className={className} style={style} {...handlers}>
      Sign in
    </Link>
  );
}

/** Mobile only: the sections and the reader's own name live behind one control
 *  so the nav bar itself carries nothing but the shield and the answer. */
function MobileMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const itemStyle = { color: "var(--steel-ink)" } as const;

  return (
    <div ref={wrap} className="relative sm:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[7px]"
        style={{ border: "1px solid var(--chalk)", background: "var(--pure-white)" }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M2 4.5h14M2 9h14M2 13.5h14"
            fill="none"
            stroke="var(--steel-ink)"
            strokeWidth="1.8"
            strokeLinecap="square"
          />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[180px] flex-col gap-1 rounded-[7px] p-2"
          style={{
            background: "var(--pure-white)",
            border: "1px solid var(--chalk)",
            boxShadow: "0 8px 24px rgba(11,11,12,0.12)",
          }}
          onClick={() => setOpen(false)}
        >
          <Link to="/" className="label-caps px-1 py-2" style={itemStyle} activeProps={{ style: activeStyle }} activeOptions={{ exact: true }}>
            Board
          </Link>
          <Link to="/schedule" className="label-caps px-1 py-2" style={itemStyle} activeProps={{ style: activeStyle }}>
            Weekend
          </Link>
          <Link to="/alumni" className="label-caps px-1 py-2" style={itemStyle} activeProps={{ style: activeStyle }}>
            Alumni
          </Link>
          <Link to="/news" className="label-caps px-1 py-2" style={itemStyle} activeProps={{ style: activeStyle }}>
            News
          </Link>
          <span className="my-1 block" style={{ borderTop: "1px solid var(--chalk)" }} />
          <IdentitySlot className="px-1 py-2" />
        </div>
      )}
    </div>
  );
}

export function SiteNav(_props: { onClaim?: () => void }) {
  return (
    <nav
      className="site-nav sticky top-0 z-40 flex items-center gap-2 px-3 sm:gap-3 sm:px-5"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <MobileMenu />

      <Link to="/" className="flex items-center gap-[6px] sm:gap-[10px]" aria-label="Pitt Club Ultimate">
        <img
          src={pittUltimateShield.url}
          alt=""
          aria-hidden="true"
          className="h-8 w-8 shrink-0 object-contain sm:h-10 sm:w-10"
        />
        <span
          className="hidden sm:inline sm:max-w-none sm:whitespace-nowrap"
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

      <span className="ml-1 hidden items-center gap-2.5 sm:ml-4 sm:flex sm:gap-4">
        <Link to="/" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }} activeOptions={{ exact: true }}>
          Board
        </Link>
        <Link to="/schedule" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          Weekend
        </Link>
        <Link to="/alumni" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          Alumni
        </Link>
        <Link to="/news" className="label-caps" style={linkStyle} activeProps={{ style: activeStyle }}>
          News
        </Link>
      </span>

      <span className="ml-auto flex items-center gap-3 pl-1">
        <IdentitySlot className="hidden sm:inline" />
        <NavStatusMenu />
      </span>
    </nav>
  );
}
