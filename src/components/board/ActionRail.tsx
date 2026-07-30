import { Link } from "@tanstack/react-router";

const circle = {
  width: 52,
  height: 52,
  borderRadius: 999,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 11,
  fontWeight: 700,
  textTransform: "uppercase" as const,
  letterSpacing: "0.08em",
  textDecoration: "none",
  border: "1px solid var(--chalk)",
  /* The only drop shadow permitted in the system. */
  boxShadow: "0 6px 18px rgba(11, 11, 12, 0.12)",
};

/** Fixed bottom-left stack of circular actions. */
export function ActionRail() {
  return (
    <div
      className="fixed left-4 bottom-4 z-40 flex flex-col gap-3"
      style={{ pointerEvents: "auto" }}
    >
      <Link
        to="/"
        style={{ ...circle, background: "var(--pitt-royal)", color: "var(--pure-white)", border: "1px solid transparent" }}
      >
        RSVP
      </Link>
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        style={{ ...circle, background: "var(--pure-white)", color: "var(--steel-ink)", fontSize: 16 }}
      >
        ↑
      </button>
    </div>
  );
}