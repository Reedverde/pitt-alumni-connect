import { Link } from "@tanstack/react-router";

import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_SM, type NotchCorner } from "@/components/media/notch";
import { ghostButton } from "@/components/schedule/ScheduleSummary";

const body = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

const dayHeading = {
  fontFamily: '"Archivo", sans-serif',
  fontWeight: 800,
  fontSize: 30,
  letterSpacing: "-0.025em",
  color: "var(--sabah-black)",
} as const;

const DAYS: Array<{ day: string; corners: NotchCorner[]; summary: string }> = [
  {
    day: "FRIDAY",
    corners: ["tl"],
    summary:
      "Social night. City Kitchen, Pitt at Virginia Tech on the screen, then wherever the night takes us.",
  },
  {
    day: "SATURDAY",
    corners: ["br"],
    summary:
      "The big one. Family BBQ at Schenley Overlook, then Pitt women's soccer that evening.",
  },
  {
    day: "SUNDAY",
    corners: ["tl"],
    summary: "Currents vs alumni at the Bubble. Play if you want to, watch if you don't.",
  },
];

function dayLinkLabel(day: string) {
  return `${day.charAt(0)}${day.slice(1).toLowerCase()} details`;
}

/** Homepage teaser for the three days. Overview only: /schedule stays the
 *  single source of truth for times, locations, and per event RSVP, so every
 *  column just points there. No gold: none of this means attending. */
export function WeekendColumns() {
  return (
    <section className="pt-14">
      <SlashEyebrow>The weekend</SlashEyebrow>
      <h2 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
        THREE DAYS
      </h2>
      <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-3">
        {DAYS.map((d) => (
          <NotchedBox
            key={d.day}
            corners={d.corners}
            notch={NOTCH_SM}
            stroke="var(--chalk)"
            fill="var(--pure-white)"
            style={{ background: "var(--pure-white)", padding: 24 }}
          >
            <h3 style={dayHeading}>{d.day}</h3>
            <p className="mt-3" style={body}>
              {d.summary}
            </p>
            <div className="mt-6">
              <Link to="/schedule" style={{ ...ghostButton, textDecoration: "none" }}>
                {dayLinkLabel(d.day)}
              </Link>
            </div>
          </NotchedBox>
        ))}
      </div>
    </section>
  );
}
