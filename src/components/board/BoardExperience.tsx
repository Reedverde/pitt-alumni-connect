import { useSuspenseQuery, queryOptions, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";

import { getBoard, type BoardPerson, type BoardPhoto } from "@/lib/board.functions";
import { buildYearGroups, claimedCount, type YearGroup } from "@/lib/board-grouping";
import { rankMatches, tokenizeQuery, TIER_FUZZY, type MatchTier } from "@/lib/name-match";
import { NameChip, ChipSessionContext } from "@/components/board/NameChip";
import { Seal } from "@/components/board/Seal";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimDialog, type ClaimTarget } from "@/components/claim/ClaimDialog";
import { ContactTipDialog, type ContactTipTarget } from "@/components/claim/ContactTipDialog";
import { secondaryButton } from "@/components/claim/ui";
import { SiteNav } from "@/components/SiteNav";
import { PersonPanel } from "@/components/board/PersonPanel";
import { useSessionPerson } from "@/lib/useSessionPerson";
import { SiteFooter } from "@/components/SiteFooter";
import { DiscordCta } from "@/components/DiscordCta";
import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_ALL } from "@/components/media/notch";
import { YearPhoto, cornersForRow } from "@/components/board/YearPhoto";
import { ghostButton } from "@/components/schedule/ScheduleSummary";
import { SidelineLoop } from "@/components/board/SidelineLoop";
import { countdown, resolveSeason } from "@/lib/edition-format";
import { BoardControls } from "@/components/board/BoardControls";
import { attendanceOf, buildEras, profileStatusOf, programLabel } from "@/lib/board-status";


/** The server already rendered this data. Refetching it the instant the page
 *  hydrates puts a cold Worker on the critical path of a first ever visit,
 *  and a single transient failure there tears the whole board down. */
export const boardQuery = queryOptions({
  queryKey: ["board"],
  queryFn: () => getBoard(),
  staleTime: 60_000,
});

export type HeroRenderArgs = {
  season: ReturnType<typeof resolveSeason>;
  clock: { value: string; label: string };
  countdownLive: boolean;
  onClaim: () => void;
};

/** The whole claim board: search, filters, chips, dialogs, person panel and
 *  counter bar. Two routes render it, and neither may alter it: a page only
 *  supplies its own hero and its own storytelling block above the counter bar. */
type BoardExperienceProps = {
  renderHero: (args: HeroRenderArgs) => ReactNode;
  story?: ReactNode;
  /** A route may substitute its own navigation. Defaults to the site nav. */
  renderNav?: (args: { onClaim: () => void }) => ReactNode;
};


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

/** Every status the Status dropdown can be set to. Attendance ("this year")
 *  and profile status live in separate groups and never blend. */
const STATUS_FILTERS = [
  { code: "going", label: "Coming" },
  { code: "maybe", label: "Maybe" },
  { code: "claimed", label: "Claimed their name" },
  { code: "unclaimed", label: "Not claimed yet" },
  { code: "no_contact", label: "No way to reach them" },
  { code: "memorial", label: "In memoriam" },
] as const;

/** The one sentence that sits under the controls while a filter is on. */
const STATUS_BLURBS: Record<string, string> = {
  going: "Said they are attending 2026 Alumni Weekend.",
  maybe: "You should encourage your teammates to come. Reach out to them today.",
  claimed: "Verified their contact information.",
  unclaimed: "Haven't checked in or verified their contact info.",
  no_contact: "Have contact info for them? Please let us know by clicking their name.",
  memorial: "Teammates we have lost. Remembered here, never counted as an answer.",
};

/** Copy for a row where nothing matches the toggles that are on. It reads as
 *  early, not broken, and always ends on an invitation. */
function emptyCopy(label: string, statuses: string[]) {
  const only = statuses.length === 1 ? statuses[0] : null;
  if (only === "going") return `Nobody has said yes from ${label} yet. Be the first.`;
  if (only === "maybe") return `Nobody from ${label} is on the fence yet. Be the first.`;
  if (only === "memorial") return `Nobody from ${label} is remembered here.`;
  if (statuses.length === 2 && statuses.includes("going") && statuses.includes("maybe"))
    return `Nobody from ${label} has answered yet. Be the first.`;
  if (statuses.length === 0) return `Turn a filter back on to see ${label}.`;
  return `Nobody from ${label} has claimed yet. Be the first.`;
}

const STATUS_WORDS: Record<string, string> = {
  going: "coming",
  maybe: "maybe",
  claimed: "claimed",
  unclaimed: "not claimed yet",
  no_contact: "with no way to reach them",
  memorial: "remembered here",
};


/** "coming", "claimed or coming", and so on, in a fixed reading order. */
function statusPhrase(statuses: string[]) {
  const ordered = ["claimed", "maybe", "going", "unclaimed", "no_contact", "memorial"].filter((s) =>
    statuses.includes(s),
  );
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
  if (only === "unclaimed") return "Everyone has checked in already.";
  if (only === "no_contact") return "We can reach everyone on the board.";
  if (only === "memorial") return "Nobody is remembered here yet.";
  if (statuses.length === 0) return "Turn a filter back on to see the board.";
  return "Nobody has answered yet. Be the first.";
}

export function BoardExperience({ renderHero, story, renderNav }: BoardExperienceProps) {
  const { data } = useSuspenseQuery(boardQuery);
  const queryClient = useQueryClient();
  const filters = useMemo(
    () =>
      data.divisions
        .map((d) => ({ code: d.code, label: programLabel(d.code, d.label) }))
        .concat([{ code: "__coaches", label: "Coaches and managers" }]),
    [data.divisions],
  );

  // Single-select: null means every program.
  const [divisionFilter, setDivisionFilter] = useState<string | null>(null);
  // Single-select: null means "everyone", the normal year-row board.
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  // Single-select era band: null means every year.
  const [eraFilter, setEraFilter] = useState<string | null>(null);
  // Search is its own constraint: it composes with the filters above.
  const [searchInput, setSearchInput] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [newestFirst, setNewestFirst] = useState(true);

  const [claimOpen, setClaimOpen] = useState(false);
  const [claimTarget, setClaimTarget] = useState<ClaimTarget | null>(null);
  const [claimPrefill, setClaimPrefill] = useState("");
  const [panelPerson, setPanelPerson] = useState<BoardPerson | null>(null);
  const [tipTarget, setTipTarget] = useState<ContactTipTarget | null>(null);
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
    // Nobody has a way to reach them: signed-in members are asked for a tip
    // instead of being sent down the claim flow.
    if (person.state === "unclaimed" && person.has_contact === false && session.signedIn) {
      setTipTarget({ id: person.id, first_name: person.first_name, last_name: person.last_name });
      return;
    }
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
  const eras = useMemo(() => buildEras(people.map((p) => p.board_year)), [people]);
  const eraBand = eras.find((e) => e.key === eraFilter) ?? null;
  const inEra = (year: number) =>
    eraBand === null || (year >= eraBand.from && year <= eraBand.to);

  // The anchor block is just another row with a sort key below every real year,
  // so it obeys the toggle: first when oldest first, last when newest first.
  const orderedRows = useMemo(() => {
    const rows: Array<{ kind: "anchor" | "year"; key: string; group?: YearGroup }> = [
      ...(anchorPeople.length > 0 && (eraBand === null || eraBand.from <= 1997)
        ? [{ kind: "anchor" as const, key: "anchor" }]
        : []),
      ...groups
        .filter((group) => group.years.some((y) => inEra(y)))
        .map((group) => ({ kind: "year" as const, key: group.key, group })),
    ];
    return newestFirst ? rows.reverse() : rows;
  }, [groups, anchorPeople, newestFirst, eraBand]);


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

  // Light debounce so a fast typist does not re-filter 454 rows per keystroke.
  useEffect(() => {
    const id = setTimeout(() => setSearchQuery(searchInput), 160);
    return () => clearTimeout(id);
  }, [searchInput]);

  const filtered = statusFilter !== null;
  const searchTokens = tokenizeQuery(searchQuery);
  const searching = searchTokens.length > 0;
  // Either constraint flattens the wall into a list.
  const flatMode = filtered || searching;
  // CLAIMED means "has claimed their name", whatever they answered, so it is a
  // superset of GOING and MAYBE. It matches the counter bar's claimed figure.
  // NO_CONTACT is a slice of unclaimed: unclaimed with zero identities rows.
  const expandStatus = (code: string) =>
    code === "claimed"
      ? ["claimed", "going", "maybe"]
      : code === "no_contact"
        ? ["unclaimed"]
        : [code];
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

  // Program, era and status compose. Attendance ("this year") and profile
  // status are read through the two separated helpers, never off the blended
  // state word, so the two ideas can never drift apart in the UI.
  const isHidden = (person: BoardPerson) => {
    if (!matchesDivision(person)) return true;
    if (typeof person.board_year === "number" && !inEra(person.board_year)) return true;
    if (!filtered) return false;
    if (statusFilter === "going" || statusFilter === "maybe")
      return attendanceOf(person) !== statusFilter;
    return profileStatusOf(person) !== statusFilter;
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
    (newestFirst ? b.board_year - a.board_year : a.board_year - b.board_year) ||
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

  // One live line under the controls, so the board never leaves a reader
  // wondering what the dropdowns just did.
  const visibleCount = flatMode
    ? flatPeople.length
    : people.filter((p) => !isHidden(p)).length;
  // Program, Status and Era narrow a name search, so the summary has to say so:
  // "0 matching Jim" alone would read as "there are no Jims anywhere".
  const structuredFilters = divisionFilter !== null || statusFilter !== null || eraFilter !== null;
  const scopeWords = [
    divisionFilter ? filters.find((f) => f.code === divisionFilter)?.label ?? null : null,
    statusFilter ? STATUS_FILTERS.find((s) => s.code === statusFilter)?.label ?? null : null,
    eraFilter ? eras.find((e) => e.key === eraFilter)?.label ?? null : null,
  ].filter(Boolean) as string[];
  const scopeSuffix = scopeWords.length > 0 ? ` within ${scopeWords.join(" · ")}` : "";
  const resultLabel = searching
    ? `${flatPeople.length} matching "${searchQuery.trim()}"${scopeSuffix}`
    : filtered
      ? `${visibleCount} ${statusPhrase(phraseStatuses)}`
      : `${visibleCount} names on the board`;

  // Clearing the structured filters while keeping what they typed: the whole
  // point is to widen the same search, not to start it again.
  const searchWholeBoard = () => {
    setDivisionFilter(null);
    setStatusFilter(null);
    setEraFilter(null);
  };


  // Unclaimed and no-contact lists are long, so they render in five-year
  // chunks instead of one flat run. Search results stay flat and ranked.
  const chunkByFiveYears =
    flatMode &&
    !searching &&
    (statusFilter === "unclaimed" || statusFilter === "no_contact");
  const yearChunks: { start: number; people: BoardPerson[] }[] = !chunkByFiveYears
    ? []
    : (() => {
        const buckets = new Map<number, BoardPerson[]>();
        for (const person of flatPeople) {
          const start = Math.floor(person.board_year / 5) * 5;
          const bucket = buckets.get(start) ?? [];
          bucket.push(person);
          buckets.set(start, bucket);
        }
        return [...buckets.entries()]
          .map(([start, list]) => ({ start, people: list }))
          .sort((a, b) => (newestFirst ? b.start - a.start : a.start - b.start));
      })();


  return (
    <ChipSessionContext.Provider value={session.signedIn}>
    <div style={{ background: "var(--field-white)" }} className="board-chrome min-h-screen">
      {renderNav
        ? renderNav({ onClaim: () => openClaim() })
        : <SiteNav onClaim={() => openClaim()} />}

      {renderHero({ season, clock, countdownLive, onClaim: () => openClaim() })}

      {story}

      <CounterBar
        claimed={data.totals.claimed}
        going={data.totals.going}
        total={data.totals.total}
        clock={clock}
        goldLive={goldLive}
        countdownLive={countdownLive}
        onIsolateGoing={() => {
          setStatusFilter("going");
          if (typeof document !== "undefined") {
            requestAnimationFrame(() =>
              document.getElementById("board")?.scrollIntoView({ behavior: "smooth", block: "start" }),
            );
          }
        }}
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

      <main id="main" className="mx-auto w-full max-w-[1320px] px-5 pb-24">

        <header id="board" className="chrome-anchor pt-6 pb-8">
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
            Every person who ever played. Search your name and claim it. October is a separate question.
          </p>
          <p className="mt-2 max-w-[560px] text-left" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            Everyone sits under their last recorded playing season. Where we have no playing
            history on file, we place them by graduation year instead.
          </p>
          <BoardKey />
        </header>

        <BoardControls
          search={searchInput}
          onSearch={setSearchInput}
          onClearSearch={() => {
            setSearchInput("");
            setSearchQuery("");
          }}
          programs={filters}
          program={divisionFilter}
          onProgram={setDivisionFilter}
          status={statusFilter}
          onStatus={setStatusFilter}
          eras={eras}
          era={eraFilter}
          onEra={setEraFilter}
          newestFirst={newestFirst}
          onSort={setNewestFirst}
          resultLabel={resultLabel}
          anyFilter={divisionFilter !== null || statusFilter !== null || eraFilter !== null || searching}
          onReset={() => {
            setDivisionFilter(null);
            setStatusFilter(null);
            setEraFilter(null);
            setSearchInput("");
            setSearchQuery("");
          }}
        />
        {statusFilter !== null && STATUS_BLURBS[statusFilter] && (
          <p className="mt-3 max-w-[560px]" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            {STATUS_BLURBS[statusFilter]}
          </p>
        )}


        {flatMode ? (
          <div className="pt-6">
            {onlyFuzzy && (
              <p
                className="label-caps"
                style={{ fontFamily: '"Space Mono", monospace', color: "var(--sterling)" }}
              >
                {`NO EXACT MATCH FOR "${searchQuery.trim().toUpperCase()}". CLOSEST:`}
              </p>
            )}

            {flatPeople.length > 0 ? (
              chunkByFiveYears ? (
                <div className="mt-4">
                  {yearChunks.map((chunk) => (
                    <div key={chunk.start} className="mt-6 first:mt-0">
                      <p
                        className="label-caps"
                        style={{
                          fontFamily: '"Space Mono", monospace',
                          color: "var(--sabah-black)",
                        }}
                      >
                        {chunk.start}–{chunk.start + 4}
                        <span style={{ color: "var(--sterling)" }}>
                          {" "}
                          · {chunk.people.length}
                        </span>
                      </p>
                      <div className="mt-3 flex flex-wrap content-start items-start gap-2">
                        {chunk.people.map((person) => (
                          <NameChip
                            key={person.id}
                            person={person}
                            dimmed={isDimmed(person)}
                            onClick={openChip}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
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
              )
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
          {eraFilter === null && data.coaches.length > 0 && (
            <CoachesRow people={data.coaches} onClaim={openChip} />
          )}

        </div>
        )}

        <div className="mt-14">
          <DiscordCta compact />
        </div>

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

      <ContactTipDialog
        open={tipTarget !== null}
        target={tipTarget}
        onClose={() => setTipTarget(null)}
      />
    </div>
    </ChipSessionContext.Provider>
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
      className="counter-bar sticky z-30 isolate overflow-hidden"
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
        {goldLive && (
          <button
            type="button"
            onClick={onIsolateGoing}
            className="label-caps rounded-[7px] px-3 py-2"
            style={{
              border: "1px solid var(--pitt-royal)",
              color: "var(--pitt-royal)",
              background: "var(--pure-white)",
            }}
          >
            See who&apos;s coming
          </button>
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
        {goldLive && (
          <button
            type="button"
            onClick={onIsolateGoing}
            className="label-caps ml-2 shrink-0 rounded-[7px] px-2 py-1.5"
            style={{
              border: "1px solid var(--pitt-royal)",
              color: "var(--pitt-royal)",
              background: "var(--pure-white)",
            }}
          >
            Who&apos;s coming
          </button>
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

/** The legend, folded away behind one line. It is reference material, not the
 *  first thing to read, and it keeps this year's answer separate from the
 *  permanent state of a record. Every swatch is paired with a word. */
function BoardKey() {
  const thisYear = [
    { label: "Coming", dot: "var(--sabah-black)", border: "1px solid transparent", bg: "var(--pitt-gold)", text: "var(--sabah-black)" },
    { label: "Maybe", dot: "var(--pitt-gold)", border: "1px solid var(--pitt-gold)", bg: "transparent", text: "var(--steel-ink)" },
  ];
  const profile = [
    { label: "Claimed their name", dot: "var(--pitt-royal)", border: "1px solid var(--pitt-royal)", bg: "transparent", text: "var(--pitt-royal)" },
    { label: "Not claimed yet", dot: "var(--chalk)", border: "1px solid var(--chalk)", bg: "transparent", text: "var(--steel-ink)" },
    { label: "In memoriam", dot: "var(--pure-white)", border: "1px solid transparent", bg: "var(--sabah-black)", text: "var(--pure-white)" },
  ];
  const row = (items: typeof thisYear) => (
    <div className="mt-2 flex flex-wrap gap-2">
      {items.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5"
          style={{ background: item.bg, border: item.border, color: item.text, fontSize: 12, fontWeight: 500 }}
        >
          <span
            aria-hidden="true"
            className="inline-block rounded-full"
            style={{ width: 6, height: 6, background: item.dot }}
          />
          <span className="label-caps" style={{ fontSize: 10 }}>{item.label}</span>
        </span>
      ))}
    </div>
  );
  return (
    <details className="mt-5 max-w-[560px]">
      <summary
        className="label-caps cursor-pointer"
        style={{ color: "var(--pitt-royal)", minHeight: 36, display: "flex", alignItems: "center" }}
      >
        What the colours mean
      </summary>
      <div className="mt-2 pb-1">
        <p className="label-caps" style={{ color: "var(--sterling)" }}>
          This year
        </p>
        {row(thisYear)}
        <p className="label-caps mt-4" style={{ color: "var(--sterling)" }}>
          Profile
        </p>
        {row(profile)}
        <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
          In memoriam is a permanent, respectful category. It is never an answer about the weekend.
        </p>
      </div>
    </details>
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
      className="chrome-anchor flex flex-col gap-4 py-7 md:flex-row md:gap-8"
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
      className="chrome-anchor flex flex-col gap-4 py-7 md:flex-row md:gap-8"
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
