import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";

import { getBoard, type BoardPerson, type BoardPhoto } from "@/lib/board.functions";
import { getWeekendPage } from "@/lib/schedule.functions";
import { buildYearGroups, claimedCount, type YearGroup } from "@/lib/board-grouping";
import { NameChip } from "@/components/board/NameChip";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimDialog, type ClaimTarget } from "@/components/claim/ClaimDialog";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { PhotoSlot } from "@/components/media/PhotoSlot";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_ALL } from "@/components/media/notch";
import { YearPhoto, cornersForRow } from "@/components/board/YearPhoto";
import { ScheduleSummary, ghostButton, primaryButton } from "@/components/schedule/ScheduleSummary";
import { SidelineLoop } from "@/components/board/SidelineLoop";
import {
  countdown,
  editionShortDates,
  nextOctoberYear,
  resolveSeason,
} from "@/lib/edition-format";

const boardQuery = queryOptions({
  queryKey: ["board"],
  queryFn: () => getBoard(),
});

/** A year ending in 00 shows all four digits: "00" reads as a placeholder. */
function sealLabel(year: number) {
  return year % 100 === 0 ? String(year) : String(year).slice(-2);
}

/** A merged row uses a photograph from any year it covers, latest first. */
function pickPhoto(photos: Record<string, BoardPhoto>, years: number[]) {
  for (const year of [...years].sort((a, b) => b - a)) {
    const photo = photos[String(year)];
    if (photo) return { photo, year };
  }
  return null;
}

const weekendQuery = queryOptions({
  queryKey: ["weekend-page"],
  queryFn: () => getWeekendPage(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(boardQuery),
      context.queryClient.ensureQueryData(weekendQuery),
    ]),
  head: () => ({
    meta: [
      { title: "Pitt Club Ultimate Alumni — Find your year" },
      {
        name: "description",
        content:
          "Every Pitt Club Ultimate alum on one wall, by year. See who has claimed their name and who is coming to Alumni Weekend.",
      },
      { property: "og:title", content: "Pitt Club Ultimate Alumni — Find your year" },
      {
        property: "og:description",
        content:
          "Every Pitt Club Ultimate alum on one wall, by year. See who has claimed their name and who is coming to Alumni Weekend.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: () => (
    <main className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30">The board didn't load</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--sterling)" }}>
        Refresh the page and it should come back.
      </p>
    </main>
  ),
  component: BoardPage,
});

const DIVISION_CHIP_LABELS: Record<string, string> = {
  MENS_A: "Sabah",
  MENS_B: "BITT / Pressure",
  WOMENS_A: "Danger",
  WOMENS_B: "Danger B",
};

function BoardPage() {
  const { data } = useSuspenseQuery(boardQuery);
  const { data: weekend } = useSuspenseQuery(weekendQuery);
  const queryClient = useQueryClient();
  const filters = useMemo(
    () =>
      data.divisions.map((d) => ({
        code: d.code,
        label: DIVISION_CHIP_LABELS[d.code] ?? d.label,
      })),
    [data.divisions],
  );
  const [active, setActive] = useState<string[]>(() => data.divisions.map((d) => d.code));
  const [newestFirst, setNewestFirst] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);

  const openClaim = (person?: BoardPerson) => {
    setClaimTarget(
      person
        ? {
            id: person.id,
            first_name: person.first_name,
            last_name: person.last_name,
            played_as: person.played_as,
            board_year: person.board_year,
            team_label: person.team_label,
          }
        : null,
    );
    setClaimOpen(true);
  };

  // Season and countdown both come from the editions rows, never a literal date.
  const season = resolveSeason(data.edition, data.nextEdition);
  // A countdown exists whenever an edition is coming. Gold is stricter: it only
  // means "coming to the edition the RSVP counts are keyed to", which is the current one.
  const countdownLive = season.edition !== null;
  const goldLive = season.edition?.event_year === data.edition.event_year;

  // Gold means a person is coming to the edition that is live now. Off season
  // there is no such edition, so a past "going" renders as claimed.
  const people = useMemo(
    () =>
      goldLive
        ? data.people
        : data.people.map((p) =>
            p.state === "going" || p.state === "maybe" ? { ...p, state: "claimed" as const } : p,
          ),
    [data.people, goldLive],
  );

  const anchorPeople = useMemo(
    () => people.filter((p) => p.board_year <= 1997),
    [people],
  );
  const groups = useMemo(
    () => buildYearGroups(people.filter((p) => p.board_year > 1997)),
    [people],
  );
  // The anchor block is just another row with a sort key below every real year,
  // so it obeys the toggle: first when oldest first, last when newest first.
  const orderedRows = useMemo(() => {
    const rows: Array<{ kind: "anchor" | "year"; key: string; group?: YearGroup }> = [
      ...(anchorPeople.length > 0 ? [{ kind: "anchor" as const, key: "anchor" }] : []),
      ...groups.map((group) => ({ kind: "year" as const, key: group.key, group })),
    ];
    return newestFirst ? rows.reverse() : rows;
  }, [groups, anchorPeople, newestFirst]);

  const clock = countdown(data.edition, data.nextEdition);

  const toggle = (code: string) =>
    setActive((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const isDimmed = (person: BoardPerson) =>
    person.board_division !== null && !active.includes(person.board_division);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav onClaim={() => openClaim()} />
      <Hero season={season} clock={clock} countdownLive={countdownLive} onClaim={() => openClaim()} />
      <CounterBar
        claimed={data.totals.claimed}
        going={data.totals.going}
        total={data.totals.total}
        clock={clock}
        goldLive={goldLive}
        countdownLive={countdownLive}
      />

      <main className="mx-auto w-full max-w-[1320px] px-5 pb-24">
        {season.edition && (
          <ScheduleSummary
            edition={season.edition}
            events={weekend.events}
            divisions={data.divisions}
          />
        )}

        <header className="pt-6 pb-8">
          <SlashEyebrow>The board</SlashEyebrow>
          <h2 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
            FIND YOUR YEAR
          </h2>
          <p className="mt-3 max-w-[560px] text-left" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Every person who ever played. Grey until they say they are coming.
          </p>
        </header>

        <DivisionFilter filters={filters} active={active} onToggle={toggle} />
        <DecadeRail groups={groups} />

        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={() => setNewestFirst((v) => !v)}
            className="label-caps rounded-[7px] px-3 py-2"
            style={{ border: "1px solid var(--chalk)", color: "var(--sterling)", background: "var(--pure-white)" }}
          >
            {newestFirst ? "Newest first" : "Oldest first"}
          </button>
        </div>

        <div>
          {orderedRows.map((row, i) =>
            row.kind === "anchor" ? (
              <AnchorRow
                key={row.key}
                people={anchorPeople}
                onClaim={openClaim}
                photos={data.photosByYear}
                rowIndex={i}
              />
            ) : (
              <YearRow
                key={row.key}
                group={row.group!}
                isDimmed={isDimmed}
                onClaim={openClaim}
                photos={data.photosByYear}
                rowIndex={i}
              />
            ),
          )}
        </div>

        <WhyTeaser />
      </main>
      <SiteFooter />

      <ClaimDialog
        open={claimOpen}
        target={claimTarget}
        onClose={() => setClaimOpen(false)}
        onClaimed={() => queryClient.invalidateQueries({ queryKey: ["board"] })}
      />
    </div>
  );
}

/** Display hero: the date is the picture. No gold: nobody is coming in a hero. */
function Hero({
  season,
  clock,
  countdownLive,
  onClaim,
}: {
  season: ReturnType<typeof resolveSeason>;
  clock: { value: string; label: string };
  countdownLive: boolean;
  onClaim: () => void;
}) {
  const edition = season.edition;
  const dates = edition ? editionShortDates(edition) : null;
  return (
    <section style={{ background: "var(--sabah-black)" }}>
      <div
        className="relative mx-auto w-full max-w-[1320px] px-5 pt-10 pb-[56vw] md:pt-14 md:pb-[30vw]"
        style={{ overflow: "hidden" }}
      >
        <p className="flex items-center" style={{ color: "var(--pure-white)" }}>
          <span aria-hidden="true" style={{ color: "var(--pitt-gold)", fontSize: 13, fontWeight: 700, marginRight: 12 }}>
            //
          </span>
          <span className="label-caps">Alumni Weekend</span>
        </p>

        {dates ? (
          <h1
            className="mt-5"
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontWeight: 800,
              fontSize: "clamp(64px, 15vw, 200px)",
              lineHeight: 0.86,
              paddingBottom: "0.14em",
              letterSpacing: "-0.045em",
              color: "var(--pure-white)",
              textTransform: "uppercase",
            }}
          >
            {dates.range}
            <br />
            {dates.year}
          </h1>
        ) : (
          <h1
            className="mt-5"
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontWeight: 800,
              fontSize: "clamp(48px, 9vw, 120px)",
              lineHeight: 0.9,
              letterSpacing: "-0.04em",
              color: "var(--pure-white)",
              textTransform: "uppercase",
            }}
          >
            The first weekend of October, {nextOctoberYear()}
          </h1>
        )}

        {/* The photograph rises out of the bottom edge on a hard diagonal,
            centred in the hero and cropped by it. */}
        <div
          aria-hidden={false}
          className="pointer-events-none absolute left-1/2 z-10 w-[170vw] max-w-none bottom-[-64vw] -translate-x-[30%] rotate-[38deg] origin-bottom md:w-[min(140vw,1400px)] md:bottom-[-50vw] md:-translate-x-[57%]"
        >
          <PhotoSlot
            ratio="4 / 3"
            index="01"
            label="Group shot, past alumni weekend"
            slotKey="weekend_hero"
            fullColor
            bare
            radius="28px 28px 0 0"
            outline="var(--pure-white)"
            outlineWidth={7}
            eager
          />
        </div>
      </div>

      {/* The copy sits below the picture so the hero can stay a picture. */}
      <div className="mx-auto w-full max-w-[1320px] px-5 pb-12 md:pb-16">
        <div className="md:max-w-[540px]">
          <p style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 20, color: "var(--concrete)" }}>
            Pittsburgh and Oakland. Three days. Everybody who ever played.
          </p>
          {countdownLive && (
            <p className="label-caps mt-3" style={{ color: "var(--sterling)" }}>
              {clock.value} {clock.label.toLowerCase()}
            </p>
          )}
          <div className="mt-6 flex flex-wrap gap-3">
            <button type="button" style={primaryButton} onClick={onClaim}>
              Say you're coming
            </button>
            <Link to="/weekend" style={{ ...ghostButton, color: "var(--pure-white)", border: "1px solid var(--steel-ink)" }}>
              See the schedule
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function WhyTeaser() {
  return (
    <section className="pt-14">
      <SlashEyebrow>Always</SlashEyebrow>
      <p className="mt-4 max-w-[560px]" style={{ fontSize: 20, color: "var(--sabah-black)" }}>
        You do not stop being Pitt Ultimate when you graduate. The roster just gets longer.
      </p>
      <p className="mt-3 max-w-[560px]" style={{ fontSize: 20, color: "var(--sabah-black)" }}>
        Three days to find your year, and to meet the ones who were freshmen when you were seniors.
      </p>
      <div className="mt-6">
        <Link to="/alumni" style={ghostButton}>
          More on this
        </Link>
      </div>
    </section>
  );
}

function CounterBar({
  claimed,
  going,
  total,
  clock,
  goldLive,
  countdownLive,
}: {
  claimed: number;
  going: number;
  total: number;
  clock: { value: string; label: string };
  goldLive: boolean;
  countdownLive: boolean;
}) {
  // Off season there is nothing to be going to, so the bar drops going and the
  // countdown entirely and shows a figure that is useful all year instead.
  const figures = [
    { value: String(claimed), label: "Claimed", color: "var(--pitt-royal)", dot: false },
    ...(goldLive
      ? [{ value: String(going), label: "Going", color: "var(--sabah-black)", dot: true }]
      : []),
    ...(countdownLive
      ? [{ value: clock.value, label: clock.label, color: "var(--steel-ink)", dot: false }]
      : [{ value: String(total), label: "On the board", color: "var(--steel-ink)", dot: false }]),
  ];
  return (
    <div
      className="sticky top-14 z-20 relative isolate overflow-hidden"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <SidelineLoop />
      <div className="relative mx-auto hidden h-14 max-w-[1320px] items-center gap-10 px-5 md:flex">
        {figures.map((f) => (
          <div key={f.label} className="flex flex-col justify-center">
            <span className="flex items-center gap-2">
              {f.dot && <GoldDot />}
              <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 24, lineHeight: 1, color: f.color }}>
                {f.value}
              </span>
            </span>
            <span className="label-caps mt-1" style={{ color: "var(--sterling)" }}>
              {f.label}
            </span>
          </div>
        ))}
      </div>
      <div className="relative mx-auto flex h-14 max-w-[1320px] items-center px-5 md:hidden" style={{ fontSize: 13 }}>
        <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--pitt-royal)" }}>{claimed} claimed</span>
        <span className="mx-2" style={{ color: "var(--chalk)" }}>·</span>
        {goldLive && (
          <>
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: '"Space Mono", monospace', color: "var(--sabah-black)" }}>
              <GoldDot />
              {going} going
            </span>
            <span className="mx-2" style={{ color: "var(--chalk)" }}>·</span>
          </>
        )}
        <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--steel-ink)" }}>
          {countdownLive ? `${clock.value} ${clock.label.toLowerCase()}` : `${total} on the board`}
        </span>
      </div>
    </div>
  );
}

function GoldDot() {
  return (
    <span
      aria-hidden="true"
      className="inline-block shrink-0 rounded-full"
      style={{ width: 10, height: 10, background: "var(--pitt-gold)" }}
    />
  );
}

function DivisionFilter({
  filters,
  active,
  onToggle,
}: {
  filters: { code: string; label: string }[];
  active: string[];
  onToggle: (code: string) => void;
}) {
  return (
    <fieldset className="mt-2 flex flex-wrap gap-2">
      <legend className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
        Programs
      </legend>
      {filters.map((d) => {
        const on = active.includes(d.code);
        return (
          <label
            key={d.code}
            className="cursor-pointer rounded-full px-3 py-2"
            style={{
              background: on ? "var(--concrete)" : "transparent",
              border: on ? "1px solid transparent" : "1px solid var(--chalk)",
              color: on ? "var(--steel-ink)" : "var(--sterling)",
              fontSize: 12,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
            }}
          >
            <input
              type="checkbox"
              className="sr-only"
              checked={on}
              onChange={() => onToggle(d.code)}
            />
            {d.label}
          </label>
        );
      })}
    </fieldset>
  );
}

/** Derived from the data on the wall, so the last band never freezes on a year. */
function buildDecades(groups: YearGroup[]) {
  const years = groups.flatMap((g) => g.years);
  if (years.length === 0) return [] as { label: string; from: number; to: number }[];
  const max = Math.max(...years);
  const bands = [{ label: "1998–2009", from: 1998, to: 2009 }];
  for (let from = 2010; from <= max; from += 10) {
    const to = Math.min(from + 9, max);
    bands.push({ label: from === to ? String(from) : `${from}–${to}`, from, to });
  }
  return bands;
}

function DecadeRail({ groups }: { groups: YearGroup[] }) {
  const DECADES = buildDecades(groups);
  return (
    <nav
      aria-label="Jump to a decade"
      className="sticky top-[112px] z-10 mt-6 flex flex-wrap items-center gap-3 py-3"
      style={{ background: "var(--field-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      {DECADES.map((decade, i) => {
        const target = groups.find((g) => g.latestYear >= decade.from && g.years[0] <= decade.to);
        return (
          <span key={decade.label} className="flex items-center gap-3">
            {i > 0 && <span style={{ color: "var(--chalk)" }}>·</span>}
            <a
              href={target ? `#${target.key}` : "#top"}
              className="label-caps"
              style={{ color: "var(--pitt-royal)" }}
            >
              {decade.label}
            </a>
          </span>
        );
      })}
    </nav>
  );
}

function AnchorRow({
  people,
  onClaim,
  photos,
  rowIndex,
}: {
  people: BoardPerson[];
  onClaim: (person: BoardPerson) => void;
  photos: Record<string, BoardPhoto>;
  rowIndex: number;
}) {
  const sorted = [...people].sort((a, b) =>
    `${a.last_name ?? a.first_name}`.localeCompare(`${b.last_name ?? b.first_name}`),
  );
  const claimed = claimedCount(sorted);
  const shot = pickPhoto(photos, [...new Set(sorted.map((p) => p.board_year))]);
  return (
    <section
      className="flex flex-col gap-4 py-7 md:flex-row md:gap-8"
      style={{ borderBottom: "1px solid var(--chalk)" }}
    >
      <div className="flex items-center gap-4 md:w-[240px] md:shrink-0 md:flex-col md:items-start md:gap-3">
        <Seal size={44}>78</Seal>
        <div>
          <div className="year-numeral" style={{ color: "var(--sabah-black)" }}>
            {sorted[0]?.board_year ?? 1978}
          </div>
          <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: "var(--sterling)" }}>
            {claimed} of {sorted.length} claimed
          </div>
        </div>
        {shot && (
          <YearPhoto photo={shot.photo} year={shot.year} corners={cornersForRow(rowIndex)} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap content-start items-start gap-2">
          {sorted.map((person) => (
            <NameChip key={person.id} person={person} dimmed={false} onClick={onClaim} />
          ))}
        </div>
        {claimed === 0 && <EmptyPrompt label={String(sorted[0]?.board_year ?? 1978)} />}
      </div>
    </section>
  );
}

/** A prompt, not a chip: it sits under the chip wall on its own line. */
function EmptyPrompt({ label }: { label: string }) {
  return (
    <NotchedBox
      corners={NOTCH_ALL}
      stroke="var(--chalk)"
      dashed
      className="mt-4 w-full max-w-[560px]"
    >
      <p className="px-4 py-3" style={{ color: "var(--sterling)", fontSize: 13 }}>
        Nobody from {label} has claimed yet. Be the first.
      </p>
    </NotchedBox>
  );
}

function YearRow({
  group,
  isDimmed,
  onClaim,
  photos,
  rowIndex,
}: {
  group: YearGroup;
  isDimmed: (p: BoardPerson) => boolean;
  onClaim: (person: BoardPerson) => void;
  photos: Record<string, BoardPhoto>;
  rowIndex: number;
}) {
  const claimed = claimedCount(group.people);
  const shot = pickPhoto(photos, group.years);
  return (
    <section
      id={group.key}
      className="flex scroll-mt-[180px] flex-col gap-4 py-7 md:flex-row md:gap-8"
      style={{ borderBottom: "1px solid var(--chalk)" }}
    >
      <div className="flex items-center gap-4 md:w-[240px] md:shrink-0 md:flex-col md:items-start md:gap-3">
        <Seal size={44}>{sealLabel(group.latestYear)}</Seal>
        <div>
          <div className="year-numeral" style={{ color: "var(--sabah-black)" }}>
            {group.label}
          </div>
          <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: "var(--sterling)" }}>
            {claimed} of {group.people.length} claimed
          </div>
        </div>
        {shot && (
          <YearPhoto photo={shot.photo} year={shot.year} corners={cornersForRow(rowIndex)} />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap content-start items-start gap-2">
          {group.people.map((person) => (
            <NameChip key={person.id} person={person} dimmed={isDimmed(person)} onClick={onClaim} />
          ))}
        </div>
        {claimed === 0 && <EmptyPrompt label={group.label} />}
      </div>
    </section>
  );
}
