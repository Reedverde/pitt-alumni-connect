import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useSessionPerson } from "@/lib/useSessionPerson";
import pittClubUltimateLogo from "@/assets/pitt-club-ultimate-logo.png.asset.json";

/**
 * The /v2 navigation. Editorial sports masthead rather than an app header:
 * the club logo is centred as the anchor, the destinations split evenly to
 * either side in compact uppercase with wide tracking, and the only chrome is
 * a single hairline rule. No wordmark text beside the logo, no buttons, no
 * gold. Used by /v2 only; every other route keeps SiteNav.
 */
const item = {
  fontFamily: '"Space Grotesk", system-ui, sans-serif',
  fontSize: 12,
  fontWeight: 600,
  letterSpacing: "0.18em",
  textTransform: "uppercase" as const,
  color: "var(--sterling)",
  textDecoration: "none",
  whiteSpace: "nowrap" as const,
  padding: "14px 0",
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
} as const;

const active = { color: "var(--sabah-black)", borderBottom: "1px solid var(--sabah-black)" } as const;

const LEFT = [
  { to: "/", label: "Home", exact: true },
  { to: "/schedule", label: "Schedule", exact: false },
] as const;

const RIGHT = [
  { to: "/alumni", label: "Alumni", exact: false },
  { to: "/news", label: "News", exact: false },
  { to: "/donate", label: "Give", exact: false },
] as const;

function NavLink({ to, label, exact }: { to: string; label: string; exact: boolean }) {
  return (
    <Link
      to={to}
      style={item}
      activeProps={{ style: { ...item, ...active } }}
      activeOptions={{ exact }}
    >
      {label}
    </Link>
  );
}

function Identity() {
  const { signedIn, firstName } = useSessionPerson();
  return signedIn ? (
    <Link to="/me" style={item}>
      {(firstName ?? "You").toUpperCase()}
    </Link>
  ) : (
    <Link to="/auth" style={item}>
      Sign in
    </Link>
  );
}

function MobileMenu() {
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={wrap} className="relative md:hidden">
      <button
        type="button"
        aria-label="Menu"
        aria-expanded={open}
        aria-haspopup="menu"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 w-11 items-center justify-center"
        style={{ background: "transparent", border: "none" }}
      >
        <svg width="20" height="20" viewBox="0 0 18 18" aria-hidden="true">
          <path
            d="M2 4.5h14M2 9h14M2 13.5h14"
            fill="none"
            stroke="var(--steel-ink)"
            strokeWidth="1.6"
            strokeLinecap="square"
          />
        </svg>
      </button>
      {open && (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[200px] flex-col px-3"
          style={{ background: "var(--pure-white)", border: "1px solid var(--chalk)" }}
          onClick={() => setOpen(false)}
        >
          {[...LEFT, ...RIGHT].map((l) => (
            <NavLink key={l.to} to={l.to} label={l.label} exact={l.exact} />
          ))}
          <span style={{ borderTop: "1px solid var(--chalk)" }} />
          <Identity />
        </div>
      )}
    </div>
  );
}

export function V2Nav() {
  return (
    <nav
      className="sticky top-0 z-40 w-full"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
      aria-label="Primary"
    >
      <div className="mx-auto grid w-full max-w-[1480px] grid-cols-[auto_1fr_auto] items-center px-4 md:grid-cols-3 md:px-10">
        <div className="flex items-center gap-8 md:gap-10">
          <MobileMenu />
          <span className="hidden items-center gap-8 md:flex md:gap-10">
            {LEFT.map((l) => (
              <NavLink key={l.to} to={l.to} label={l.label} exact={l.exact} />
            ))}
          </span>
        </div>

        <div className="flex justify-center">
          <Link to="/v2" aria-label="Pitt Club Ultimate, home" className="flex items-center py-2">
            <img
              src={pittClubUltimateLogo.url}
              alt="Pitt Club Ultimate"
              className="h-10 w-auto object-contain md:h-12"
            />
          </Link>
        </div>

        <div className="flex items-center justify-end gap-8 md:gap-10">
          <span className="hidden items-center gap-8 md:flex md:gap-10">
            {RIGHT.map((l) => (
              <NavLink key={l.to} to={l.to} label={l.label} exact={l.exact} />
            ))}
          </span>
          <span className="hidden md:inline">
            <Identity />
          </span>
        </div>
      </div>
    </nav>
  );
}
