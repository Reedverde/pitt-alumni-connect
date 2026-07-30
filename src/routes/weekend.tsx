import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

import { getWeekendPage, type ScheduleEvent } from "@/lib/schedule.functions";
import {
  dayLabel,
  dayName,
  editionDateRange,
  editionDay,
  editionEyebrow,
  nextOctoberYear,
  resolveSeason,
  todayInNewYork,
  type EditionSummary,
} from "@/lib/edition-format";
import { SiteNav } from "@/components/SiteNav";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { LabelRow } from "@/components/board/LabelRow";
import { ActionRail } from "@/components/board/ActionRail";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_LG, NOTCH_SM, type NotchCorner } from "@/components/media/notch";

const weekendQuery = queryOptions({
  queryKey: ["weekend-page"],
  queryFn: () => getWeekendPage(),
});

export const Route = createFileRoute("/weekend")({
  loader: ({ context }) => context.queryClient.ensureQueryData(weekendQuery),
  head: () => ({
    meta: [
      { title: "Alumni Weekend Schedule — Pitt Club Ultimate" },
      {
        name: "description",
        content:
          "Three days in Pittsburgh: watch party, family BBQ, women's soccer and the alumni games. Add any of it to your calendar.",
      },
      { property: "og:title", content: "Alumni Weekend Schedule — Pitt Club Ultimate" },
      {
        property: "og:description",
        content: "Three days in Pittsburgh. The full schedule, plus calendar files for every event.",
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

const DAY_BODIES = [
  "Get into town, find the room, watch the game.",
  "The long day. Families welcome at all of it.",
  "Games in the morning, goodbyes by the afternoon.",
];

/** Day tiles are generated from the edition's own start and end dates. */
function buildDays(edition: EditionSummary) {
  const start = editionDay(edition, 1);
  const end = editionDay({ ...edition, starts_on: edition.ends_on }, 1);
  const span = Math.max(1, Math.round((end.getTime() - start.getTime()) / 86400000) + 1);
  return Array.from({ length: span }, (_, i) => {
    const date = editionDay(edition, i + 1);
    return {
      number: i + 1,
      seal: String(i + 1).padStart(2, "0"),
      date: dayLabel(date),
      title: dayName(date),
      body: DAY_BODIES[i] ?? "More to come.",
    };
  });
}

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
  const { data: schedule } = useSuspenseQuery(scheduleQuery);
  const { data: pastEditions } = useSuspenseQuery(pastEditionsQuery);
  const edition = schedule.edition;
  const events = schedule.events;
  const DAYS = buildDays(edition);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <header className="pt-10 pb-6 md:pt-14">
          <SlashEyebrow>{editionEyebrow(edition)}</SlashEyebrow>
          <h1 className="display-64 mt-3" style={{ color: "var(--sabah-black)" }}>
            THE WEEKEND
          </h1>
          <p className="mt-4 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Three days in Pittsburgh. Four programs, one roof.
          </p>
          <div className="mt-6">
            <a href={`/api/public/calendar.ics?year=${edition.event_year}`} style={ghostButton}>
              Add the whole weekend
            </a>
          </div>
          <div className="mt-6">
            <LabelRow label="Group shot, past alumni weekend" right={editionDateRange(edition)} />
            <PhotoSlot
              className="mt-3"
              ratio="3 / 1"
              index="01"
              corners={["tl", "br"]}
              label="Group shot, past alumni weekend"
              slotKey="weekend_hero"
              eager
            />
          </div>
        </header>

        <NotchedBox
          className="my-8"
          corners={["tl", "br"]}
          notch={NOTCH_LG}
          fill="var(--pitt-royal)"
          style={{ color: "var(--pure-white)" }}
        >
          <div className="px-6 py-7">
          <p className="max-w-[640px]" style={{ fontSize: 16 }}>
            Times marked TBD are still being set. RSVP now and we'll email you when they lock.
          </p>
          <p className="mt-3 max-w-[640px]" style={{ fontSize: 16, opacity: 0.86 }}>
            Spectators welcome. Nobody plays who doesn't want to.
          </p>
          </div>
        </NotchedBox>

        {DAYS.map((day) => {
          const dayEvents = events.filter((e) => (e.day_number ?? 1) === day.number);
          const wholeProgram = dayEvents.filter((e) => !e.division);
          const lanes = Object.keys(DIVISION_LABELS)
            .map((code) => ({ code, events: dayEvents.filter((e) => e.division === code) }))
            .filter((lane) => lane.events.length > 0);

          return (
            <section key={day.number} className="mt-10">
              <NotchedBox
                corners={day.number === 2 ? ["br"] : day.number === 3 ? ["tl", "br"] : ["tl"]}
                notch={NOTCH_LG}
                stroke="var(--chalk)"
                fill="var(--pure-white)"
                style={tileStyle}
              >
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
              </NotchedBox>

              <div className="mt-4 flex flex-col gap-4">
                {wholeProgram.map((event) => (
                  <EventTile key={event.id} event={event} wholeProgram corners={["tl"]} eventYear={edition.event_year} />
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
                      {lane.events.map((event, i) => (
                        <EventTile
                          key={event.id}
                          event={event}
                          wholeProgram={false}
                          eventYear={edition.event_year}
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
            </section>
          );
        })}

        <PastEditions editions={pastEditions} />
      </main>
      <ActionRail />
    </div>
  );
}

function PastEditions({ editions }: { editions: { event_year: number; title: string; starts_on: string; ends_on: string; going: number }[] }) {
  if (editions.length === 0) return null;
  return (
    <section className="mt-16">
      <LabelRow label="Past weekends" right="Straight out of the RSVPs" />
      <div className="mt-4 flex flex-col gap-3">
        {editions.map((e) => (
          <a key={e.event_year} href={`/editions/${e.event_year}`} style={{ textDecoration: "none" }}>
            <NotchedBox corners={["tl"]} notch={NOTCH_SM} stroke="var(--chalk)" fill="var(--pure-white)" style={tileStyle}>
              <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: "var(--steel-ink)" }}>
                {e.event_year} · {editionDateRange(e)}
              </p>
              <h3 className="mt-1" style={{ fontFamily: '"Archivo", sans-serif', fontWeight: 800, fontSize: 20, color: "var(--sabah-black)" }}>
                {e.title}
              </h3>
              <p className="mt-1" style={{ fontSize: 16, color: "var(--sterling)" }}>
                {e.going} said they were coming. See that schedule.
              </p>
            </NotchedBox>
          </a>
        ))}
      </div>
      <PhotoSlot className="mt-4" ratio="3 / 1" index="02" corners={["br"]} label="Past weekends" />
    </section>
  );
}

function EventTile({
  event,
  wholeProgram,
  corners,
  eventYear,
}: {
  event: ScheduleEvent;
  wholeProgram: boolean;
  corners: NotchCorner[];
  eventYear: number;
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
        <a href={`/api/public/calendar.ics?year=${eventYear}&event=${event.id}`} style={ghostButton}>
          Add to calendar
        </a>
      </div>
    </NotchedBox>
  );
}
