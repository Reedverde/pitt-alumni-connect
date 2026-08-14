import { DISCORD_INVITE_URL } from "@/lib/site-url";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_ALL, NOTCH_SM } from "@/components/media/notch";

/**
 * One of the main weekend actions, not a footnote. Royal on white, never gold,
 * because gold means attending and nothing else. Full width button on phones.
 */
export function DiscordCta({ compact = false }: { compact?: boolean }) {
  return (
    <NotchedBox
      corners={NOTCH_ALL}
      notch={NOTCH_SM}
      stroke="var(--pitt-royal)"
      fill="var(--pure-white)"
      style={{ position: "relative", padding: compact ? "20px 18px" : "28px 22px" }}
    >
      <p className="label-caps" style={{ color: "var(--pitt-royal)" }}>
        Talk about the weekend
      </p>
      <h2
        className="mt-2"
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 800,
          fontSize: compact ? 24 : 30,
          lineHeight: 1.02,
          letterSpacing: "-0.025em",
          textTransform: "uppercase",
          color: "var(--sabah-black)",
        }}
      >
        Join the Alumni Weekend Discord
      </h2>
      <p className="mt-3 max-w-[620px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
        The Pitt Alumni Discord is where the weekend actually gets sorted. Rides, rooms, plans,
        gatherings, photos afterward, and staying in touch with your own crew the rest of the year.
      </p>
      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex w-full items-center justify-center sm:w-auto"
          style={{
            fontFamily: '"Space Grotesk", system-ui, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "14px 26px",
            minHeight: 48,
            borderRadius: 2,
            background: "var(--pitt-royal)",
            color: "var(--pure-white)",
            textDecoration: "none",
          }}
        >
          Join the Discord
        </a>
        <span style={{ fontSize: 14, color: "var(--sterling)" }}>
          Free, no app required, open to anyone who ever played.
        </span>
      </div>
    </NotchedBox>
  );
}
