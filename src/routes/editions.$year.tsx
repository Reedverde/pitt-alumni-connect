import { createFileRoute } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";
import type { CSSProperties } from "react";

import { getSchedule, type ScheduleEvent } from "@/lib/schedule.functions";
import { SiteNav } from "@/components/SiteNav";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_LG, NOTCH_SM } from "@/components/media/notch";
import { dayLabel, dayName, editionDateRange, editionDay, editionEyebrow } from "@/lib/edition-format";

const editionQuery = (eventYear: number) =>
  queryOptions({
    queryKey: ["schedule", eventYear],
    queryFn: () => getSchedule({ data: { eventYear } }),
  });

export const Route = createFileRoute("/editions/$year")({
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(editionQuery(Number(params.year))),
  head: ({ params }) => ({
    meta: [
      { title: `Alumni Weekend ${params.year} — Pitt Club Ultimate` },
      {
        name: "description",
        content: `The schedule from Pitt Club Ultimate Alumni Weekend ${params.year}, kept as a record.`,
      },
      { property: "og:title", content: `Alumni Weekend ${params.year} — Pitt Club Ultimate` },
      {
        property: "og:description",
        content: `What happened over Alumni Weekend ${params.year} in Pittsburgh.`,
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30">That weekend isn't here</h1>
      <p className="mt-3" style={{ fontSize: 16, color: "var(--sterling)" }}>
        Try the current schedule instead.
      </p>
    </main>
  ),
  component: EditionArchivePage,
});

const tileStyle: CSSProperties = { background: "var(--pure-white)", padding: 20 };

function timeLabel(event: ScheduleEvent) {
  if (event.time_tbd || !event.starts_at) return "TBD";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(new Date(event.starts_at));
}

function EditionArchivePage() {
  const { year } = Route.useParams();
  const { data } = useSuspenseQuery(editionQuery(Number(year)));
  const { edition, events } = data;

  const days = [...new Set(events.map((e) => e.day_number ?? 1))].sort((a, b) => a - b);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />
      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <header className="pt-10 pb-6 md:pt-14">
          <SlashEyebrow>{editionEyebrow(edition)}</SlashEyebrow>
          <h1 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
            {edition.title.toUpperCase()}
          </h1>
          <p className="mt-4 max-w-[560px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            {editionDateRange(edition)}. Kept as a record, read only.
          </p>
        </header>


        {days.map((dayNumber) => {
          const date = editionDay(edition, dayNumber);
          return (
            <section key={dayNumber} className="mt-10">
              <NotchedBox
                notch={NOTCH_LG}
                stroke="var(--chalk)"
                fill="var(--pure-white)"
                style={tileStyle}
              >
                <div className="flex items-start gap-4">
                  <Seal size={64}>{String(dayNumber).padStart(2, "0")}</Seal>
                  <div>
                    <p className="label-caps" style={{ color: "var(--sterling)" }}>
                      <span style={{ fontFamily: '"Space Mono", monospace' }}>{dayLabel(date)}</span>
                    </p>
                    <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
                      {dayName(date)}
                    </h2>
                  </div>
                </div>
              </NotchedBox>

              <div className="mt-4 flex flex-col gap-4">
                {events
                  .filter((e) => (e.day_number ?? 1) === dayNumber)
                  .map((event) => (
                    <NotchedBox
                      key={event.id}
                      corners={["tl"]}
                      notch={NOTCH_SM}
                      stroke="var(--chalk)"
                      fill="var(--pure-white)"
                      style={tileStyle}
                    >
                      <p style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, fontWeight: 700, color: "var(--steel-ink)" }}>
                        {timeLabel(event)}
                      </p>
                      <h3 className="mt-2" style={{ fontFamily: '"Archivo", sans-serif', fontWeight: 800, fontSize: 22, color: "var(--sabah-black)" }}>
                        {event.title}
                      </h3>
                      {event.location && (
                        <p className="mt-2" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
                          {event.location}
                        </p>
                      )}
                    </NotchedBox>
                  ))}
              </div>
            </section>
          );
        })}

        {events.length === 0 && (
          <p className="mt-10" style={{ fontSize: 16, color: "var(--sterling)" }}>
            No schedule was recorded for this weekend.
          </p>
        )}
      </main>
    </div>
  );
}
