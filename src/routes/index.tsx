import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";

import { getBoard, type BoardPerson } from "@/lib/board.functions";
import { buildYearGroups, claimedCount, type YearGroup } from "@/lib/board-grouping";
import { NameChip } from "@/components/board/NameChip";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimDialog, type ClaimTarget } from "@/components/claim/ClaimDialog";
import { SiteNav } from "@/components/SiteNav";
import { SidelineLoop } from "@/components/board/SidelineLoop";
import { countdown, editionEyebrow, resolveSeason } from "@/lib/edition-format";

const boardQuery = queryOptions({
  queryKey: ["board"],
  queryFn: () => getBoard(),
});

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
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
          "Every Pitt Club Ultimate alum on one wall, by year. See who is coming to Alumni Weekend.",
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

  const anchorPeople = useMemo(
    () => data.people.filter((p) => p.board_year <= 1997),
    [data.people],
  );
  const groups = useMemo(
    () => buildYearGroups(data.people.filter((p) => p.board_year > 1997)),
    [data.people],
  );
  const orderedGroups = useMemo(
    () => (newestFirst ? [...groups].reverse() : groups),
    [groups, newestFirst],
  );

  // Season and countdown both come from the editions rows, never a literal date.
  const season = resolveSeason(data.edition, data.nextEdition);
  const inSeason = season.edition !== null;
  const clock = countdown(data.edition, data.nextEdition);

  const toggle = (code: string) =>
    setActive((prev) => (prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]));

  const isDimmed = (person: BoardPerson) =>
    person.board_division !== null && !active.includes(person.board_division);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav onClaim={() => openClaim()} />
      <CounterBar
        claimed={data.totals.claimed}
        going={data.totals.going}
        total={data.totals.total}
        clock={clock}
        inSeason={inSeason}
      />

      <main className="mx-auto w-full max-w-[1320px] px-5 pb-24">
        <header className="pt-10 pb-8 md:pt-14">
          <SlashEyebrow>{editionEyebrow(data.edition)}</SlashEyebrow>
          <h1 className="display-64 mt-3" style={{ color: "var(--sabah-black)" }}>
            FIND YOUR YEAR
          </h1>
          <p className="mt-4 max-w-[560px] text-left" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Every Pitt Club Ultimate alum we know of, on one wall, by year. Gold means they are coming.
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

        {anchorPeople.length > 0 && <AnchorRow people={anchorPeople} onClaim={openClaim} />}

        <div>
          {orderedGroups.map((group) => (
            <YearRow key={group.key} group={group} isDimmed={isDimmed} onClaim={openClaim} />
          ))}
        </div>
      </main>

      <ClaimDialog
        open={claimOpen}
        target={claimTarget}
        onClose={() => setClaimOpen(false)}
        onClaimed={() => queryClient.invalidateQueries({ queryKey: ["board"] })}
      />
    </div>
  );
}

function CounterBar({
  claimed,
  going,
  total,
  clock,
  inSeason,
}: {
  claimed: number;
  going: number;
  total: number;
  clock: { value: string; label: string };
  inSeason: boolean;
}) {
  // Off season there is nothing to be going to, so the bar drops going and the
  // countdown entirely and shows a figure that is useful all year instead.
  const figures = inSeason
    ? [
        { value: String(claimed), label: "Claimed", color: "var(--pitt-royal)", dot: false },
        { value: String(going), label: "Going", color: "var(--sabah-black)", dot: true },
        { value: clock.value, label: clock.label, color: "var(--steel-ink)", dot: false },
      ]
    : [
        { value: String(claimed), label: "Claimed", color: "var(--pitt-royal)", dot: false },
        { value: String(total), label: "On the board", color: "var(--steel-ink)", dot: false },
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
        {inSeason ? (
          <>
            <span className="inline-flex items-center gap-1.5" style={{ fontFamily: '"Space Mono", monospace', color: "var(--sabah-black)" }}>
              <GoldDot />
              {going} going
            </span>
            <span className="mx-2" style={{ color: "var(--chalk)" }}>·</span>
            <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--steel-ink)" }}>
              {clock.value} {clock.label.toLowerCase()}
            </span>
          </>
        ) : (
          <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--steel-ink)" }}>
            {total} on the board
          </span>
        )}
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
}: {
  people: BoardPerson[];
  onClaim: (person: BoardPerson) => void;
}) {
  const sorted = [...people].sort((a, b) =>
    `${a.last_name ?? a.first_name}`.localeCompare(`${b.last_name ?? b.first_name}`),
  );
  const claimed = claimedCount(sorted);
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
      </div>
      <div className="flex flex-1 flex-wrap content-start items-start gap-2">
        {sorted.map((person) => (
          <NameChip key={person.id} person={person} dimmed={false} onClick={onClaim} />
        ))}
      </div>
    </section>
  );
}

function YearRow({
  group,
  isDimmed,
  onClaim,
}: {
  group: YearGroup;
  isDimmed: (p: BoardPerson) => boolean;
  onClaim: (person: BoardPerson) => void;
}) {
  const claimed = claimedCount(group.people);
  return (
    <section
      id={group.key}
      className="flex scroll-mt-[180px] flex-col gap-4 py-7 md:flex-row md:gap-8"
      style={{ borderBottom: "1px solid var(--chalk)" }}
    >
      <div className="flex items-center gap-4 md:w-[240px] md:shrink-0 md:flex-col md:items-start md:gap-3">
        <Seal size={44}>{String(group.latestYear).slice(-2)}</Seal>
        <div>
          <div className="year-numeral" style={{ color: "var(--sabah-black)" }}>
            {group.label}
          </div>
          <div style={{ fontFamily: '"Space Mono", monospace', fontSize: 13, color: "var(--sterling)" }}>
            {claimed} of {group.people.length} claimed
          </div>
        </div>
      </div>
      <div className="flex flex-1 flex-wrap content-start items-start gap-2">
        {group.people.map((person) => (
          <NameChip key={person.id} person={person} dimmed={isDimmed(person)} onClick={onClaim} />
        ))}
        {claimed === 0 && (
          <p
            className="flex items-center rounded-[18px] px-4 py-3"
            style={{
              border: "1px dashed var(--chalk)",
              color: "var(--sterling)",
              fontSize: 13,
              maxWidth: 560,
            }}
          >
            Nobody from {group.label} has claimed yet. Be the first.
          </p>
        )}
      </div>
    </section>
  );
}
