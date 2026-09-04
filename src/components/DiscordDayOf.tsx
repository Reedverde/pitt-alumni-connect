import type { CSSProperties } from "react";

import { DISCORD_INVITE_URL } from "@/lib/site-url";
import { todayInNewYork } from "@/lib/edition-format";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_ALL, NOTCH_SM } from "@/components/media/notch";

/** True while today falls inside the edition, in Pittsburgh time. */
export function isDuringEdition(
  startsOn: string | null | undefined,
  endsOn: string | null | undefined,
  today: string = todayInNewYork(),
): boolean {
  if (!startsOn || !endsOn) return false;
  return today >= startsOn && today <= endsOn;
}

const button: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  background: "var(--pitt-royal)",
  color: "var(--pure-white)",
  fontFamily: '"Space Grotesk", system-ui, sans-serif',
  fontSize: 15,
  fontWeight: 700,
  letterSpacing: "0.02em",
  borderRadius: 7,
  padding: "13px 20px",
  textDecoration: "none",
};

/**
 * A compact Discord action. During the weekend it speaks in the present tense
 * and sits near the current day. Outside the weekend it is a plain invite with
 * no manufactured urgency. Royal only, never gold: gold means attending.
 */
export function DiscordDayOf({
  startsOn,
  endsOn,
  className,
}: {
  startsOn?: string | null;
  endsOn?: string | null;
  className?: string;
}) {
  const live = isDuringEdition(startsOn, endsOn);
  return (
    <NotchedBox
      corners={NOTCH_ALL}
      notch={NOTCH_SM}
      stroke="var(--pitt-royal)"
      fill="var(--pure-white)"
      className={className}
      style={{ padding: "18px 18px" }}
    >
      <p className="label-caps" style={{ color: "var(--pitt-royal)" }}>
        {live ? "Happening now" : "Talk about the weekend"}
      </p>
      <p
        className="mt-2 max-w-[560px]"
        style={{ fontSize: 16, fontWeight: 600, color: "var(--sabah-black)" }}
      >
        {live
          ? "Already out in Pittsburgh? Drop into Discord and say where you are."
          : "Join the alumni Discord."}
      </p>
      <p className="mt-1 max-w-[560px]" style={{ fontSize: 15, color: "var(--sterling)" }}>
        {live
          ? "\u201cI\u2019m here, anyone want to join?\u201d belongs in Discord, not on this page. Rides, tables, fields, and last minute plans all get sorted there."
          : "Rides, rooms, and plans get sorted there. During the weekend it is where everyone finds each other."}
      </p>
      <div className="mt-4">
        <a
          href={DISCORD_INVITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto"
          style={button}
        >
          {live ? "Open Discord" : "Join the alumni Discord"}
        </a>
      </div>
    </NotchedBox>
  );
}
