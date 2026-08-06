import { Link } from "@tanstack/react-router";
import { useSessionPerson } from "@/lib/useSessionPerson";
import { DISCORD_INVITE_URL } from "@/lib/site-url";

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

/** Secondary rail treatment: smaller, Concrete fill, Steel Ink glyph. Never
 *  gold; gold means attending and nothing else. */
const secondaryCircle = {
  ...circle,
  width: 44,
  height: 44,
  background: "var(--concrete)",
  color: "var(--steel-ink)",
};

function DiscordGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
      <path d="M19.54 5.34A16.2 16.2 0 0 0 15.5 4.1l-.2.37a12.7 12.7 0 0 1 3.4 1.65 15.6 15.6 0 0 0-13.4 0 12.7 12.7 0 0 1 3.4-1.65L8.5 4.1a16.2 16.2 0 0 0-4.04 1.24C1.9 9.14 1.2 12.85 1.55 16.5a16.3 16.3 0 0 0 4.94 2.5l1.08-1.5a10.6 10.6 0 0 1-1.68-.8l.41-.31a11.6 11.6 0 0 0 9.9 0l.41.31c-.53.32-1.09.59-1.68.8l1.08 1.5a16.3 16.3 0 0 0 4.94-2.5c.42-4.23-.7-7.9-2.41-11.16ZM8.6 14.4c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.79 2-1.77 2Zm6.5 0c-.97 0-1.77-.9-1.77-2s.78-2 1.77-2 1.79.9 1.77 2c0 1.1-.78 2-1.77 2Z" />
    </svg>
  );
}

/** Fixed bottom-left stack of circular actions. When a page can open the claim
 *  dialog itself, the RSVP circle opens it instead of navigating. */
export function ActionRail({ onRsvp }: { onRsvp?: () => void } = {}) {
  const { signedIn } = useSessionPerson();
  return (
    <div
      className="fixed left-4 bottom-4 z-40 flex flex-col gap-3"
      style={{ pointerEvents: "auto" }}
    >
      {!signedIn && (onRsvp ? (
        <button
          type="button"
          onClick={onRsvp}
          style={{ ...circle, background: "var(--pitt-royal)", color: "var(--pure-white)", border: "1px solid transparent" }}
        >
          RSVP
        </button>
      ) : (
        <Link
          to="/"
          style={{ ...circle, background: "var(--pitt-royal)", color: "var(--pure-white)", border: "1px solid transparent" }}
        >
          RSVP
        </Link>
      ))}
      <button
        type="button"
        onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
        aria-label="Back to top"
        style={{ ...circle, background: "var(--pure-white)", color: "var(--steel-ink)", fontSize: 16 }}
      >
        ↑
      </button>
      <a
        href={DISCORD_INVITE_URL}
        target="_blank"
        rel="noopener noreferrer"
        title="Join the Pitt Club Ultimate Discord"
        aria-label="Join the Pitt Club Ultimate Discord"
        style={secondaryCircle}
      >
        <DiscordGlyph />
      </a>
    </div>
  );
}