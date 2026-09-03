import type { CSSProperties } from "react";
import { Link } from "@tanstack/react-router";

import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_LG, NOTCH_SM, type NotchCorner } from "@/components/media/notch";
import { DivisionMark } from "@/components/schedule/DivisionMark";
import { EventCardAnswer } from "@/components/events/EventCardAnswer";

import { dayLabel, dayName, editionDay, type EditionSummary } from "@/lib/edition-format";
import type { ScheduleEvent } from "@/lib/schedule.functions";

const tileStyle: CSSProperties = { background: "var(--pure-white)", padding: 20 };

export const ghostButton: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  background: "transparent",
  color: "var(--steel-ink)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 7,
  padding: "10px 16px",
  border: "1px solid var(--chalk)",
  textDecoration: "none",
  cursor: "pointer",
};

export const primaryButton: CSSProperties = {
  ...ghostButton,
  background: "var(--pitt-royal)",
  color: "var(--pure-white)",
  border: "1px solid transparent",
};

function timeLabel(event: ScheduleEvent) {
  if (event.time_tbd || !event.starts_at) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(event.starts_at));
}

function EventTile({
  event,
  wholeProgram,
  corners,
}: {
  event: ScheduleEvent;
  wholeProgram: boolean;
  corners: NotchCorner[];
}) {
  return (
    <NotchedBox
      corners={corners}
      notch={NOTCH_SM}
      stroke="var(--chalk)"
      fill="var(--pure-white)"
      style={tileStyle}
    >
      {wholeProgram && (
        <span
          aria-hidden="true"
          style={{
            position: "absolute",
            left: -20,
            top: corners.includes("tl") ? NOTCH_SM : 0,
            bottom: corners.includes("bl") ? NOTCH_SM : 0,
            width: 4,
            background: "var(--pitt-gold)",
          }}
        />
      )}
      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 14,
          fontWeight: 700,
          fontVariantNumeric: "tabular-nums",
          color: timeLabel(event) === "TBD" ? "var(--sterling)" : "var(--sabah-black)",
        }}
      >
        {timeLabel(event)}
      </p>
      <h4
        className="mt-2"
        style={{ fontFamily: '"Archivo", sans-serif', fontWeight: 800, fontSize: 20, letterSpacing: "-0.025em", color: "var(--sabah-black)" }}
      >
        {event.title}
      </h4>
      {event.location && (
        <p className="mt-2" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
          {event.location}
        </p>
      )}
      {event.notes && (
        <p className="mt-2 max-w-[560px]" style={{ fontSize: 16, color: "var(--sterling)" }}>
          {event.notes}
        </p>
      )}
      <EventCardAnswer eventId={event.id} eventTitle={event.title} />
    </NotchedBox>
  );
}


/** Condensed schedule for the homepage. Same rules as /weekend: whole-program
 *  events run full width with a gold left border, division events sit in
 *  equal-width lanes beneath the day header. Hidden divisions never appear. */
export function ScheduleSummary({
  edition,
  events,
  divisions,
}: {
  edition: EditionSummary;
  events: ScheduleEvent[];
  divisions: { code: string; label: string }[];
}) {
  const start = editionDay(edition, 1);
  const end = editionDay({ ...edition, starts_on: edition.ends_on }, 1);
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  const days = Array.from({ length: span }, (_, i) => {
    const date = editionDay(edition, i + 1);
    return { number: i + 1, seal: String(i + 1).padStart(2, "0"), date: dayLabel(date), title: dayName(date) };
  });

  return (
    <section className="pt-4 pb-10">
      <SlashEyebrow>The schedule</SlashEyebrow>
      <h2 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
        THREE DAYS
      </h2>
      <p className="mt-3 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
        Times marked TBD are still being set. RSVP now and we'll email you when they lock.
      </p>
      <p className="mt-2 max-w-[560px]" style={{ fontSize: 16, color: "var(--sterling)" }}>
        Currents versus alumni. Play if you want to, watch if you don't. We just want you there.
      </p>
      {(edition.lodging_note?.trim() || edition.travel_note?.trim()) && (
        <p className="mt-2 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
          Coming from out of town?{" "}
          <Link to="/weekend" hash="where-to-stay" style={{ color: "var(--pitt-royal)", fontWeight: 700 }}>
            Where to stay and how to get around
          </Link>
        </p>
      )}

      {days.map((day) => {
        const dayEvents = events.filter((e) => (e.day_number ?? 1) === day.number);
        const wholeProgram = dayEvents.filter((e) => !e.division);
        const lanes = divisions
          .map((d) => ({ ...d, events: dayEvents.filter((e) => e.division === d.code) }))
          .filter((lane) => lane.events.length > 0);

        return (
          <div key={day.number} className="mt-8">
            <NotchedBox
              corners={day.number % 2 === 0 ? ["br"] : ["tl"]}
              notch={NOTCH_LG}
              stroke="var(--chalk)"
              fill="var(--pure-white)"
              style={tileStyle}
            >
              <div className="flex items-center gap-4">
                <Seal size={64}>{day.seal}</Seal>
                <div>
                  <p className="label-caps" style={{ color: "var(--sterling)" }}>
                    <span style={{ fontFamily: '"Space Mono", monospace' }}>{day.date}</span>
                  </p>
                  <h3 className="display-30 mt-1" style={{ color: "var(--sabah-black)" }}>
                    {day.title}
                  </h3>
                </div>
              </div>
            </NotchedBox>

            <div className="mt-4 flex flex-col gap-4">
              {wholeProgram.map((event) => (
                <EventTile key={event.id} event={event} wholeProgram corners={["tl"]} />
              ))}
            </div>

            {lanes.length > 0 && (
              <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-[repeat(auto-fit,minmax(0,1fr))]">
                {lanes.map((lane) => (
                  <div key={lane.code} className="flex min-w-0 flex-col gap-3">
                    <p className="label-caps flex items-center gap-2" style={{ color: "var(--sterling)" }}>
                      <DivisionMark code={lane.code} />
                      {lane.label}
                    </p>
                    {lane.events.map((event, i) => (
                      <EventTile
                        key={event.id}
                        event={event}
                        wholeProgram={false}
                        corners={i % 2 === 0 ? ["tl"] : ["br"]}
                      />
                    ))}
                  </div>
                ))}
              </div>
            )}

            {dayEvents.length === 0 && (
              <p className="mt-4" style={{ fontSize: 16, color: "var(--sterling)" }}>
                Nothing scheduled yet for this day.
              </p>
            )}
          </div>
        );
      })}

      <div className="mt-8">
        <Link to="/weekend" style={ghostButton}>
          See the full schedule
        </Link>
      </div>
    </section>
  );
}
