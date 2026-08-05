import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";

import { getBoard, type BoardPerson, type BoardPhoto } from "@/lib/board.functions";
import { getWeekendPage } from "@/lib/schedule.functions";
import { buildYearGroups, claimedCount, type YearGroup } from "@/lib/board-grouping";
import { rankMatches, tokenizeQuery, TIER_FUZZY, type MatchTier } from "@/lib/name-match";
import { NameChip } from "@/components/board/NameChip";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimDialog, type ClaimTarget } from "@/components/claim/ClaimDialog";
import { secondaryButton } from "@/components/claim/ui";
import { SiteNav } from "@/components/SiteNav";
import { PersonPanel } from "@/components/board/PersonPanel";
import { useSessionPerson } from "@/lib/useSessionPerson";
import { SiteFooter } from "@/components/SiteFooter";
import { StatusBar } from "@/components/board/StatusBar";
import heroPeak from "@/assets/hero-peak.png.asset.json";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_ALL } from "@/components/media/notch";
import { YearPhoto, cornersForRow } from "@/components/board/YearPhoto";
import { ScheduleSummary, ghostButton, primaryButton } from "@/components/schedule/ScheduleSummary";
import { SidelineLoop } from "@/components/board/SidelineLoop";
import { SITE_ORIGIN } from "@/lib/site-url";
import {
  countdown,
  editionShortDates,
  nextOctoberYear,
  resolveSeason,
} from "@/lib/edition-format";

/** The server already rendered this data. Refetching it the instant the page
 *  hydrates puts a cold Worker on the critical path of a first ever visit,
 *  and a single transient failure there tears the whole board down. */
const boardQuery = queryOptions({
  queryKey: ["board"],
  queryFn: () => getBoard(),
  staleTime: 60_000,
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
  staleTime: 60_000,
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
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: BoardError,
  component: BoardPage,
});

/** Only reached after the automatic retries have all failed. */
function BoardError({ reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  return (
    <main className="mx-auto max-w-[560px] px-5 py-24">
      <h1 className="display-30">The board didn't load</h1>
      <p className="mt-3 text-sm" style={{ color: "var(--sterling)" }}>
        Something went wrong on our end. Try again and it should come back.
      </p>
      <button
        type="button"
        className="mt-6 text-sm underline"
        onClick={() => {
          void router.invalidate();
          reset();
        }}
      >
        Try again
      </button>
    </main>
  );
}

const DIVISION_CHIP_LABELS: Record<string, string> = {
  MENS_A: "Sabah",
  MENS_B: "BITT / Pressure",
  WOMENS_A: "Danger",
  WOMENS_B: "Danger B",
};

/** Three states only. "Not this year" is never publicly listable, and
 *  unclaimed is the board's background rather than a status. */
const STATUS_FILTERS = [
  { code: "going", label: "Going" },
  { code: "maybe", label: "Maybe" },
  { code: "claimed", label: "Claimed" },
] as const;

/** Copy for a row where nothing matches the toggles that are on. It reads as
 *  early, not broken, and always ends on an invitation. */
function emptyCopy(label: string, statuses: string[]) {
  const only = statuses.length === 1 ? statuses[0] : null;
  if (only === "going") return `Nobody has said yes from ${label} yet. Be the first.`;
  if (only === "maybe") return `Nobody from ${label} is on the fence yet. Be the first.`;
  if (statuses.length === 2 && statuses.includes("going") && statuses.includes("maybe"))
    return `Nobody from ${label} has answered yet. Be the first.`;
  if (statuses.length === 0) return `Turn a filter back on to see ${label}.`;
  return `Nobody from ${label} has claimed yet. Be the first.`;
}

const STATUS_WORDS: Record<string, string> = {
  going: "going",
  maybe: "maybe",
  claimed: "claimed",
};

/** "going", "claimed or going", and so on, in a fixed reading order. */
function statusPhrase(statuses: string[]) {
  const ordered = ["claimed", "maybe", "going"].filter((s) => statuses.includes(s));
  const words = ordered.map((s) => STATUS_WORDS[s]);
  if (words.length === 0) return "nobody";
  if (words.length === 1) return words[0];
  return `${words.slice(0, -1).join(", ")} or ${words[words.length - 1]}`;
}

/** The one dashed card the flat list shows when nothing matches at all. */
function flatEmptyCopy(statuses: string[]) {
  const only = statuses.length === 1 ? statuses[0] : null;
  if (only === "going") return "Nobody has said yes yet. Be the first.";
  if (only === "maybe") return "Nobody is on the fence yet. Be the first.";
  if (only === "claimed") return "Nobody has claimed yet. Be the first.";
  if (statuses.length === 0) return "Turn a filter back on to see the board.";
  return "Nobody has answered yet. Be the first.";
}

function BoardPage() {
  const { data } = useSuspenseQuery(boardQuery);
  const { data: weekend } = useSuspenseQuery(weekendQuery);
  const queryClient = useQueryClient();
  const filters = useMemo(
    () =>
      data.divisions
        .map((d) => ({
        code: d.code,
        label: DIVISION_CHIP_LABELS[d.code] ?? d.label,
        }))
        .concat([{ code: "__coaches", label: "Coaches" }]),
    [data.divisions],
  );
  // Single-select: null means every program.
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null);
  // Single-select: null means "everyone", the normal year-row board.
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // Search is its own constraint: it composes with the two filters above.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);
  const [claimOpen, setClaimOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);
  const [claimPrefill, setClaimPrefill] = useState("");
  const [panelPerson, setPanelPerson] = useState<BoardPerson | null>(null);
  const [focusPersonId, setFocusPersonId] = useState<string | null>(null);
  // Set when an answer link from email had expired or been tampered with. The
  // page never dead-ends: it says so plainly and the claim flow is right there.
  const [staleLink, setStaleLink] = useState(false);
  const navigate = useNavigate();
  const session = useSessionPerson();

  // A chip is the main way back into your own record. Unclaimed keeps the claim
  // flow; anything already claimed offers the sign-in route instead, and your
  // own chip goes straight to /me.
  const openChip = (person: BoardPerson) => {
    if (person.state === "memorial") return;
    if (person.state === "unclaimed") {
      openClaim(person);
      return;
    }
    if (session.signedIn && session.personId === person.id) {
      void navigate({ to: "/me" });
      return;
    }
    setPanelPerson(person);
  };

  const openClaim = (person?: BoardPerson, prefill = "") => {
    setClaimPrefill(person ? "" : prefill);
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

  useEffect(() => {
    setStaleLink(new URLSearchParams(window.location.search).get("link") === "expired");
  }, []);

  // Coming back from a claim, or arriving from another page with #person-<id>:
  // scroll the person's own chip into view once the board has re-rendered.
  useEffect(() => {
    const fromHash = window.location.hash.startsWith("#person-")
      ? window.location.hash.slice("#person-".length)
      : null;
    const id = focusPersonId ?? fromHash;
    if (!id) return;
    const node = document.getElementById(`person-${id}`);
    if (!node) return;
    node.scrollIntoView({ behavior: "smooth", block: "center" });
    node.focus({ preventScroll: true });
  }, [focusPersonId, people]);

  const pickDivision = (code: string) =>
    setDivisionFilter((prev) => (prev === code ? null : code));

  // Light debounce so a fast typist does not re-filter 454 rows per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 160);
    return () => clearTimeout(id);
  }, [searchInput]);

  const pickStatus = (code: string) =>
    setStatusFilter((prev) => (prev === code ? null : code));

  const filtered = statusFilter !== null;
  const searchTokens = tokenizeQuery(searchQuery);
  const searching = searchTokens.length > 0;
  // Either constraint flattens the wall into a list.
  const flatMode = filtered || searching;
  // CLAIMED means "has claimed their name", whatever they answered, so it is a
  // superset of GOING and MAYBE. It matches the counter bar's claimed figure.
  const expandStatus = (code: string) =>
    code === "claimed" ? ["claimed", "going", "maybe"] : [code];
  const effStatuses = filtered
    ? expandStatus(statusFilter as string)
    : STATUS_FILTERS.map((s) => s.code);
  // The word used in copy is the chip that is on, not the states it expands to.
  const phraseStatuses = filtered
    ? [statusFilter as string]
    : STATUS_FILTERS.map((s) => s.code);

  const exitIsolate = () => setStatusFilter(null);

  // Program AND status compose, and both hide rather than dim.
  const isDimmed = (_person: BoardPerson) => false;

  // Any program the person holds history in, not just the one their board year
  // resolves to. Someone with A and B history appears under both.
  const matchesDivision = (person: BoardPerson) => {
    if (divisionFilter === null) return true;
    // The fourth chip filters by role, not program: anyone who ever coached or managed.
    if (divisionFilter === "__coaches") return person.has_coached === true || person.is_coach === true;
    return (person.divisions ?? []).includes(divisionFilter);
  };

  const isHidden = (person: BoardPerson) => {
    if (!matchesDivision(person)) return true;
    if (!filtered) return false;
    // Filtering by status means a list of people, not the wall.
    return !effStatuses.includes(person.state);
  };

  // A row is "empty" when nothing that could carry a status does, under the
  // toggles that are on.
  const matchCount = (list: BoardPerson[]) =>
    list.filter(
      (p) =>
        matchesDivision(p) &&
        p.state !== "unclaimed" &&
        p.state !== "memorial" &&
        effStatuses.includes(p.state),
    ).length;

  const byYearThenName = (a: BoardPerson, b: BoardPerson) =>
    b.board_year - a.board_year ||
    `${a.last_name ?? a.first_name} ${a.first_name}`
      .toLowerCase()
      .localeCompare(`${b.last_name ?? b.first_name} ${b.first_name}`.toLowerCase());

  // Searching ranks by tier: direct, then nickname equivalence, then fuzzy.
  // Tiers never interleave; the usual ordering applies inside each tier.
  const ranked = searching
    ? rankMatches(
        searchQuery,
        [...people, ...data.coaches].filter((p) => !isHidden(p)),
      )
    : [];
  const flatPeople = !flatMode
    ? []
    : searching
      ? ([0, 1, 2] as MatchTier[]).flatMap((tier) =>
          ranked
            .filter((r) => r.tier === tier)
            .map((r) => r.item)
            .sort(byYearThenName),
        )
      : people.filter((p) => !isHidden(p)).sort(byYearThenName);
  // Only-fuzzy results must never be presented as if they were exact.
  const onlyFuzzy = searching && ranked.length > 0 && ranked.every((r) => r.tier === TIER_FUZZY);

  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav onClaim={() => openClaim()} />
      <Hero season={season} clock={clock} countdownLive={countdownLive} onClaim={() => openClaim()} />
      <StatusBar />
      <CounterBar
        claimed={data.totals.claimed}
        going={data.totals.going}
        total={data.totals.total}
        clock={clock}
        goldLive={goldLive}
        countdownLive={countdownLive}
        onIsolateGoing={() => setStatusFilter("going")}
      />
      {statusFilter === "going" && (
        <div
          className="mx-auto w-full max-w-[1320px] px-5 pt-3"
          style={{ fontFamily: '"Space Mono", monospace', fontSize: 12, color: "var(--sterling)" }}
        >
          Showing {data.totals.going} going.{" "}
          <button
            type="button"
            onClick={exitIsolate}
            style={{
              fontFamily: '"Space Mono", monospace',
              fontSize: 12,
              color: "var(--pitt-royal)",
              textDecoration: "underline",
            }}
          >
            Show everyone.
          </button>
        </div>
      )}

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
          {staleLink && (
            <div
              className="mb-6 rounded-[9px] px-4 py-3"
              style={{ border: "1px solid var(--chalk)", background: "var(--field-white)" }}
            >
              <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                That link from your email has run out. No harm done, nothing changed. Find your
                name below and answer here instead.
              </p>
              <button
                type="button"
                className="mt-3"
                style={secondaryButton}
                onClick={() => openClaim(undefined, "")}
              >
                I&apos;m not on here, add me
              </button>
            </div>
          )}
          <h2 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
            FIND YOUR YEAR
          </h2>
          <p className="mt-3 max-w-[560px] text-left" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Every person who ever played. Grey until they say they are coming.
          </p>
        </header>

        <BoardSearch
          value={searchInput}
          onChange={setSearchInput}
          onClear={() => {
            setSearchInput("");
            setSearchQuery("");
          }}
        />
        <StatusRadioChips
          legend="Programs"
          options={filters}
          value={divisionFilter}
          onPick={pickDivision}
        />
        <StatusRadioChips
          legend="Filter by"
          options={STATUS_FILTERS.map((s) => ({ code: s.code, label: s.label }))}
          value={statusFilter}
          onPick={pickStatus}
        />
        {!flatMode && <DecadeRail groups={groups} />}

        {!flatMode && (
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
        )}

        {flatMode ? (
          <div className="pt-6">
            <p
              className="label-caps"
              aria-live="polite"
              style={{ fontFamily: '"Space Mono", monospace', color: "var(--sterling)" }}
            >
              {searching
                ? onlyFuzzy
                  ? `NO EXACT MATCH FOR "${searchQuery.trim().toUpperCase()}". CLOSEST:`
                  : `${flatPeople.length} MATCHING "${searchQuery.trim().toUpperCase()}"`
                : `${flatPeople.length} ${statusPhrase(phraseStatuses)}`}
            </p>
            {flatPeople.length > 0 ? (
              <div className="mt-4 flex flex-wrap content-start items-start gap-2">
                {flatPeople.map((person) => (
                  <NameChip
                    key={person.id}
                    person={person}
                    dimmed={isDimmed(person)}
                    onClick={openChip}
                  />
                ))}
              </div>
            ) : (
              <EmptyPrompt
                copy={
                  searching
                    ? `No names match "${searchQuery.trim()}". Try a last name, or add yourself.`
                    : flatEmptyCopy(phraseStatuses)
                }
                action={
                  searching
                    ? {
                        label: "I'm not on here, add me",
                        onClick: () => openClaim(undefined, searchQuery.trim()),
                      }
                    : undefined
                }
              />
            )}
          </div>
        ) : (
        <div>
          {orderedRows.map((row, i) =>
            row.kind === "anchor" ? (
              <AnchorRow
                key={row.key}
                people={anchorPeople}
                onClaim={openChip}
                photos={data.photosByYear}
                rowIndex={i}
                isDimmed={isDimmed}
                isHidden={isHidden}
                matchCount={matchCount}
                activeStatuses={effStatuses}
              />
            ) : (
              <YearRow
                key={row.key}
                group={row.group!}
                isDimmed={isDimmed}
                isHidden={isHidden}
                onClaim={openChip}
                photos={data.photosByYear}
                rowIndex={i}
                matchCount={matchCount}
                activeStatuses={effStatuses}
              />
            ),
          )}
          {data.coaches.length > 0 && <CoachesRow people={data.coaches} onClaim={openChip} />}
        </div>
        )}

        <WhyTeaser />
      </main>
      <SiteFooter />

      {panelPerson && <PersonPanel person={panelPerson} onClose={() => setPanelPerson(null)} />}

      <ClaimDialog
        open={claimOpen}
        target={claimTarget}
        prefillName={claimPrefill}
        onClose={() => setClaimOpen(false)}
        onClaimed={(personId) => {
          void queryClient.invalidateQueries({ queryKey: ["board"] });
          // The chip is the payoff: bring them back to it, updated.
          if (personId) setFocusPersonId(personId);
        }}
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
        className="relative mx-auto w-full max-w-[1320px] px-5 pt-10 pb-[42vw] md:pt-14 md:pb-[26vw]"
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

        {/* The photograph rises out of the bottom edge, spanning the full width of the hero. */}
        <img
          src={heroPeak.url}
          alt="Pitt Ultimate players piled together on the sideline"
          className="pointer-events-none absolute inset-x-0 bottom-0 z-10 w-full select-none"
        />
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
          <div className="mt-6 flex flex-wrap items-center gap-3">
            <button
              type="button"
              style={{
                ...primaryButton,
                padding: "18px 32px",
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                borderRadius: 7,
              }}
              onClick={onClaim}
            >
              Claim your name
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
  onIsolateGoing,
}: {
  claimed: number;
  going: number;
  total: number;
  clock: { value: string; label: string };
  goldLive: boolean;
  countdownLive: boolean;
  onIsolateGoing: () => void;
}) {
  // Off season there is nothing to be going to, so the bar drops going and the
  // countdown entirely and shows a figure that is useful all year instead.
  const figures = [
    { value: String(claimed), label: "Claimed", color: "var(--pitt-royal)", dot: false, going: false },
    ...(goldLive
      ? [{ value: String(going), label: "Going", color: "var(--sabah-black)", dot: true, going: true }]
      : []),
    ...(countdownLive
      ? [{ value: clock.value, label: clock.label, color: "var(--steel-ink)", dot: false, going: false }]
      : [{ value: String(total), label: "On the board", color: "var(--steel-ink)", dot: false, going: false }]),
  ];
  return (
    <div
      className="sticky top-14 z-20 relative isolate overflow-hidden"
      style={{ background: "var(--pure-white)", borderBottom: "1px solid var(--chalk)" }}
    >
      <SidelineLoop />
      <div className="relative mx-auto hidden h-14 max-w-[1320px] items-center gap-10 px-5 md:flex">
        {figures.map((f) =>
          f.going ? (
            <button
              key={f.label}
              type="button"
              onClick={onIsolateGoing}
              aria-label="Show only people who are coming"
              className="going-counter flex flex-col justify-center text-left"
            >
              <span className="flex items-center gap-2">
                <GoldDot />
                <span style={{ fontFamily: '"Space Mono", monospace', fontWeight: 700, fontSize: 24, lineHeight: 1, color: f.color }}>
                  {f.value}
                </span>
              </span>
              <span className="label-caps mt-1" style={{ color: "var(--sterling)" }}>
                {f.label}
              </span>
            </button>
          ) : (
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
          ),
        )}
      </div>
      <div className="relative mx-auto flex h-14 max-w-[1320px] items-center px-5 md:hidden" style={{ fontSize: 13 }}>
        <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--pitt-royal)" }}>{claimed} claimed</span>
        <span className="mx-2" style={{ color: "var(--chalk)" }}>·</span>
        {goldLive && (
          <>
            <button
              type="button"
              onClick={onIsolateGoing}
              aria-label="Show only people who are coming"
              className="going-counter inline-flex items-center gap-1.5"
              style={{ fontFamily: '"Space Mono", monospace', color: "var(--sabah-black)" }}
            >
              <GoldDot />
              {going} going
            </button>
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

/** One neutral radio row. Used by both the program filter and the status
 *  filter so there is only ever one pattern. No gold: gold means attending. */
function StatusRadioChips({
  legend,
  options,
  value,
  onPick,
}: {
  legend: string;
  options: { code: string; label: string }[];
  value: string | null;
  onPick: (code: string) => void;
}) {
  return (
    <div className="mt-2">
      <p className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
        {legend}
      </p>
      <div role="radiogroup" aria-label={legend} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const on = value === o.code;
          return (
            <button
              key={o.code}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onPick(o.code)}
              className="cursor-pointer rounded-full px-3 py-2"
              style={{
                background: on ? "var(--pitt-royal)" : "transparent",
                border: on ? "1px solid transparent" : "1px solid var(--chalk)",
                color: on ? "var(--pure-white)" : "var(--sterling)",
                fontSize: 12,
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.08em",
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

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

/** Coach-only people have no year to place them on, so they pin above the board. */
function CoachesRow({
  people,
  onClaim,
}: {
  people: BoardPerson[];
  onClaim: (person: BoardPerson) => void;
}) {
  const sorted = [...people].sort((a, b) =>
    `${a.last_name ?? a.first_name}`.localeCompare(`${b.last_name ?? b.first_name}`),
  );
  return (
    <section
      id="coaches"
      className="flex scroll-mt-[180px] flex-col gap-4 py-7 md:flex-row md:gap-8"
      style={{ borderBottom: "1px solid var(--chalk)" }}
    >
      <div className="flex items-center gap-4 md:w-[240px] md:shrink-0 md:flex-col md:items-start md:gap-3">
        <div className="year-numeral" style={{ color: "var(--sabah-black)" }}>
          COACHES AND MANAGERS
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap content-start items-start gap-2">
          {sorted.map((person) => (
            <NameChip key={person.id} person={person} dimmed={false} onClick={onClaim} />
          ))}
        </div>
      </div>
    </section>
  );
}

function AnchorRow({
  people,
  onClaim,
  photos,
  rowIndex,
  isDimmed,
  isHidden,
  matchCount,
  activeStatuses,
}: {
  people: BoardPerson[];
  onClaim: (person: BoardPerson) => void;
  photos: Record<string, BoardPhoto>;
  rowIndex: number;
  isDimmed: (p: BoardPerson) => boolean;
  isHidden: (p: BoardPerson) => boolean;
  matchCount: (list: BoardPerson[]) => number;
  activeStatuses: string[];
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
          {sorted.filter((p) => !isHidden(p)).map((person) => (
            <NameChip key={person.id} person={person} dimmed={isDimmed(person)} onClick={onClaim} />
          ))}
        </div>
        {matchCount(sorted) === 0 && (
          <EmptyPrompt
            copy={emptyCopy(String(sorted[0]?.board_year ?? 1978), activeStatuses)}
          />
        )}
      </div>
    </section>
  );
}

/** A prompt, not a chip: it sits under the chip wall on its own line. */
function EmptyPrompt({
  copy,
  action,
}: {
  copy: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <NotchedBox
      corners={NOTCH_ALL}
      stroke="var(--chalk)"
      dashed
      className="mt-4 w-full max-w-[560px]"
    >
      <div className="px-4 py-3">
        <p style={{ color: "var(--sterling)", fontSize: 13 }}>{copy}</p>
        {action && (
          <button
            type="button"
            onClick={action.onClick}
            className="label-caps mt-3 rounded-[7px] px-3 py-2"
            style={{
              border: "1px solid var(--chalk)",
              background: "var(--pure-white)",
              color: "var(--steel-ink)",
            }}
          >
            {action.label}
          </button>
        )}
      </div>
    </NotchedBox>
  );
}

/** One text field above the filter rows. No gold, no submit. */
function BoardSearch({
  value,
  onChange,
  onClear,
}: {
  value: string;
  onChange: (v: string) => void;
  onClear: () => void;
}) {
  return (
    <div className="pt-6">
      <label htmlFor="board-search" className="sr-only">
        Find a name
      </label>
      <div className="relative w-full sm:max-w-[360px]">
        <input
          id="board-search"
          type="text"
          value={value}
          autoComplete="off"
          placeholder="Find a name"
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClear();
          }}
          className="w-full rounded-[7px] px-3 py-2 pr-9 outline-none"
          style={{
            border: "1px solid var(--chalk)",
            background: "var(--pure-white)",
            color: "var(--sabah-black)",
            fontFamily: '"Space Grotesk", sans-serif',
            fontSize: 15,
          }}
        />
        {value !== "" && (
          <button
            type="button"
            onClick={onClear}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 px-1"
            style={{ color: "var(--sterling)", fontSize: 16, lineHeight: 1 }}
          >
            ×
          </button>
        )}
      </div>
    </div>
  );
}

function YearRow({
  group,
  isDimmed,
  isHidden,
  onClaim,
  photos,
  rowIndex,
  matchCount,
  activeStatuses,
}: {
  group: YearGroup;
  isDimmed: (p: BoardPerson) => boolean;
  isHidden: (p: BoardPerson) => boolean;
  onClaim: (person: BoardPerson) => void;
  photos: Record<string, BoardPhoto>;
  rowIndex: number;
  matchCount: (list: BoardPerson[]) => number;
  activeStatuses: string[];
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
          {group.people.filter((p) => !isHidden(p)).map((person) => (
            <NameChip key={person.id} person={person} dimmed={isDimmed(person)} onClick={onClaim} />
          ))}
        </div>
        {matchCount(group.people) === 0 && (
          <EmptyPrompt copy={emptyCopy(group.label, activeStatuses)} />
        )}
      </div>
    </section>
  );
}
