import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

import { getSchedule, type ScheduleEvent } from "@/lib/schedule.functions";
import { SiteNav } from "@/components/SiteNav";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";

const scheduleQuery = queryOptions({
  queryKey: ["schedule", 2026],
  queryFn: () => getSchedule(),
});

export const Route = createFileRoute("/weekend")({
  loader: ({ context }) => context.queryClient.ensureQueryData(scheduleQuery),
  head: () => ({
    meta: [
      { title: "Alumni Weekend Schedule — Pitt Club Ultimate" },
      {
        name: "description",
        content:
          "Three days in Pittsburgh, October 2–4, 2026: watch party, family BBQ, women's soccer and the alumni games. Add any of it to your calendar.",
      },
      { property: "og:title", content: "Alumni Weekend Schedule — Pitt Club Ultimate" },
      {
        property: "og:description",
        content: "October 2–4, 2026 in Pittsburgh. The full schedule, plus calendar files for every event.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30">The schedule didn't load</h1>
      <p className="mt-3" style={{ fontSize: 16, color: "var(--sterling)" }}>
        Refresh the page and it should come back.
      </p>
    </main>
  ),
  notFoundComponent: () => (
    <main className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30">Page not found</h1>
    </main>
  ),
  component: WeekendPage,
});

const DAYS = [
  { number: 1, seal: "01", date: "FRI OCT 2, 2026", title: "Friday", body: "Get into town, find the room, watch the game." },
  { number: 2, seal: "02", date: "SAT OCT 3, 2026", title: "Saturday", body: "The long day. Families welcome at all of it." },
  { number: 3, seal: "03", date: "SUN OCT 4, 2026", title: "Sunday", body: "Games in the morning, goodbyes by the afternoon." },
];

const DIVISION_LABELS: Record<string, string> = {
  MENS_A: "En Sabah Nur",
  MENS_B: "Pressure",
  WOMENS_A: "Danger",
  WOMENS_B: "Danger B",
};

const ghostButton: CSSProperties = {
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
};

const tileStyle: CSSProperties = {
  background: "var(--pure-white)",
  border: "1px solid var(--chalk)",
  borderRadius: 18,
  padding: 20,
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

function WeekendPage() {
  const { data: events } = useSuspenseQuery(scheduleQuery);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <header className="pt-10 pb-6 md:pt-14">
          <SlashEyebrow>Alumni Weekend · Oct 2–4, 2026</SlashEyebrow>
          <h1 className="display-64 mt-3" style={{ color: "var(--sabah-black)" }}>
            THE WEEKEND
          </h1>
          <p className="mt-4 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Three days in Pittsburgh. Four programs, one roof.
          </p>
          <div className="mt-6">
            <a href="/api/public/calendar.ics?year=2026" style={ghostButton}>
              Add the whole weekend
            </a>
          </div>
        </header>

        <section
          className="my-8 rounded-[18px] px-6 py-7"
          style={{ background: "var(--pitt-royal)", color: "var(--pure-white)" }}
        >
          <p className="max-w-[640px]" style={{ fontSize: 16 }}>
            Times marked TBD are still being set. RSVP now and we'll email you when they lock.
          </p>
          <p className="mt-3 max-w-[640px]" style={{ fontSize: 16, opacity: 0.86 }}>
            Spectators welcome. Nobody plays who doesn't want to.
          </p>
        </section>

        {DAYS.map((day) => {
          const dayEvents = events.filter((e) => (e.day_number ?? 1) === day.number);
          const wholeProgram = dayEvents.filter((e) => !e.division);
          const lanes = Object.keys(DIVISION_LABELS)
            .map((code) => ({ code, events: dayEvents.filter((e) => e.division === code) }))
            .filter((lane) => lane.events.length > 0);

          return (
            <section key={day.number} className="mt-10">
              <div style={tileStyle}>
                <div className="flex items-start gap-4">
                  <Seal size={64}>{day.seal}</Seal>
                  <div>
                    <p className="label-caps" style={{ color: "var(--sterling)" }}>
                      <span style={{ fontFamily: '"Space Mono", monospace' }}>{day.date}</span>
                    </p>
                    <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
                      {day.title}
                    </h2>
                    <p className="mt-2 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
                      {day.body}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-col gap-4">
                {wholeProgram.map((event) => (
                  <EventTile key={event.id} event={event} wholeProgram />
                ))}
              </div>

              {lanes.length > 0 && (
                <div
                  className="mt-4 grid gap-4"
                  style={{ gridTemplateColumns: `repeat(${lanes.length}, minmax(0, 1fr))` }}
                >
                  {lanes.map((lane) => (
                    <div key={lane.code} className="flex flex-col gap-4">
                      <p className="label-caps" style={{ color: "var(--sterling)" }}>
                        {DIVISION_LABELS[lane.code]}
                      </p>
                      {lane.events.map((event) => (
                        <EventTile key={event.id} event={event} wholeProgram={false} />
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
            </section>
          );
        })}
      </main>
    </div>
  );
}

function EventTile({ event, wholeProgram }: { event: ScheduleEvent; wholeProgram: boolean }) {
  return (
    <article
      style={{
        ...tileStyle,
        ...(wholeProgram
          ? { borderLeft: "4px solid var(--pitt-gold)" }
          : {}),
      }}
    >
      <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, fontWeight: 700, color: "var(--steel-ink)" }}>
        {timeLabel(event)}
      </p>
      <h3 className="mt-2" style={{ fontFamily: '"Archivo", sans-serif', fontWeight: 800, fontSize: 22, letterSpacing: "-0.025em", color: "var(--sabah-black)" }}>
        {event.title}
      </h3>
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
      <div className="mt-4">
        <a href={`/api/public/calendar.ics?year=2026&event=${event.id}`} style={ghostButton}>
          Add to calendar
        </a>
      </div>
    </article>
  );
}
