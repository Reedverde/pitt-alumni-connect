import { Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { useSessionPerson } from "@/lib/useSessionPerson";
import pittClubUltimateLogo from "@/assets/pitt-club-ultimate-logo.png.asset.json";

/**
 * The one navigation for the whole site. Editorial sports masthead rather
 * than an app header: general destinations sit together on the left in
 * compact uppercase with wide tracking, the club shield is centred in the
 * viewport (not in the space left over between link groups), and the right
 * side holds only the personal slot: the signed-in person's name, plus an
 * Admin link when and only when is_admin() says so. Signed-out visitors get
 * Sign in instead. The only chrome is a single hairline rule.
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

const GENERAL = [
  { to: "/", label: "Home", exact: true },
  { to: "/schedule", label: "Schedule", exact: false },
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

function NameLink({ firstName }: { firstName: string | null }) {
  return (
    <Link
      to="/me"
      style={{ ...item, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}
      activeProps={{ style: { ...item, ...active, maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" } }}
      activeOptions={{ exact: false }}
      title={firstName ?? "Your page"}
    >
      {(firstName ?? "You").toUpperCase()}
    </Link>
  );
}

function AdminLink() {
  return (
    <Link
      to="/admin"
      search={{ tab: undefined, view: undefined }}
      style={item}
      activeProps={{ style: { ...item, ...active } }}
      activeOptions={{ exact: false }}
    >
      Admin
    </Link>
  );
}

/** The personal slot: name (+ Admin when authorised), or Sign in. */
function Identity() {
  const { signedIn, firstName, isAdmin } = useSessionPerson();
  if (!signedIn) {
    return (
      <Link to="/auth" style={item}>
        Sign in
      </Link>
    );
  }
  return (
    <>
      <NameLink firstName={firstName} />
      {isAdmin ? <AdminLink /> : null}
    </>
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
          className="absolute left-0 top-full z-50 mt-1 flex min-w-[200px] max-w-[calc(100vw-2rem)] flex-col px-3"
          style={{ background: "var(--pure-white)", border: "1px solid var(--chalk)" }}
          onClick={() => setOpen(false)}
        >
          {GENERAL.map((l) => (
            <NavLink key={l.to} to={l.to} label={l.label} exact={l.exact} />
          ))}
          <span style={{ borderTop: "1px solid var(--chalk)" }} aria-hidden="true" />
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
      <div className="relative mx-auto flex w-full max-w-[1480px] items-center justify-between px-4 md:px-10">
        {/* Left: every general destination, in order. */}
        <div className="flex min-w-0 items-center gap-6 md:gap-8">
          <MobileMenu />
          <span className="hidden items-center gap-6 md:flex md:gap-8">
            {GENERAL.map((l) => (
              <NavLink key={l.to} to={l.to} label={l.label} exact={l.exact} />
            ))}
          </span>
        </div>

        {/* Centre: the shield, centred in the viewport regardless of the
            widths of the link groups on either side. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
          <Link
            to="/"
            aria-label="Pitt Club Ultimate, home"
            className="pointer-events-auto flex items-center py-2"
          >
            <img
              src={pittClubUltimateLogo.url}
              alt="Pitt Club Ultimate"
              className="h-10 w-auto object-contain md:h-12"
            />
          </Link>
        </div>

        {/* Right: the personal slot only. */}
        <div className="flex min-w-0 items-center justify-end gap-6 md:gap-8">
          <span className="hidden min-w-0 items-center gap-6 md:flex md:gap-8">
            <Identity />
          </span>
        </div>
      </div>
    </nav>
  );
}
