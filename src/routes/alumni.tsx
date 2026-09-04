import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { SITE_ORIGIN } from "@/lib/site-url";
import { PageShell } from "@/components/layout/PageShell";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimDialog } from "@/components/claim/ClaimDialog";
import { PhotoSlot, StatementCard } from "@/components/media/PhotoSlot";
import { primaryButton } from "@/components/claim/ui";
import { useSessionPerson } from "@/lib/useSessionPerson";

export const Route = createFileRoute("/alumni")({
  head: () => ({
    meta: [
      { title: "Alumni — Pitt Club Ultimate" },
      {
        name: "description",
        content:
          "You do not stop being Pitt Ultimate when you graduate. The roster just gets longer. One weekend a year, everybody in the same city on purpose.",
      },
      { property: "og:title", content: "Alumni — Pitt Club Ultimate" },
      {
        property: "og:description",
        content:
          "Same club, same people, longer roster. One weekend a year, everybody in the same city on purpose.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:url", content: `${SITE_ORIGIN}/alumni` },
    ],
    links: [{ rel: "canonical", href: `${SITE_ORIGIN}/alumni` }],
  }),
  component: AlumniPage,
});

const body = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

/** The 560px measure applies to prose only. Anchors, the stat strip and the mosaic break out of it. */
function Measure({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-[560px] text-left ${className}`}>{children}</div>;
}

/* Only milestones the project can actually evidence. The board carries
   Fastbacks players from 1978, so that year is stated as what it is, the
   earliest roster anyone has documented, not as a founding date. No founding
   year is claimed anywhere on this page, because nothing here settles it. */
const RECORD = [
  { figure: "1978", label: "Earliest documented roster" },
  { figure: "2005", label: "First Pitt team to reach Nationals" },
  { figure: "2012 & 2013", label: "National titles" },
  { figure: "2026", label: "Back at Nationals" },
];

/** Full width, outside the prose measure. Two up on a phone, four up above sm. */
function RecordStrip() {
  return (
    <div className="mt-6 grid w-full grid-cols-2 gap-x-4 gap-y-6 sm:grid-cols-4">
      {RECORD.map((item) => (
        <div key={item.label} className="min-w-0">
          <div
            style={{
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              fontSize: "clamp(20px, 4.4vw, 34px)",
              letterSpacing: "-0.03em",
              lineHeight: 1.1,
              color: "var(--sabah-black)",
            }}
          >
            {item.figure}
          </div>
          <div
            className="mt-2"
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 11,
              fontWeight: 500,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "var(--sterling)",
            }}
          >
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}

function AlumniPage() {
  const { signedIn } = useSessionPerson();
  const navigate = useNavigate();
  const [claimOpen, setClaimOpen] = useState(false);
  return (
    <PageShell bare>
      <main id="main" className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <header className="pt-10 md:pt-14">
          <Measure>
            <SlashEyebrow>Always</SlashEyebrow>
          </Measure>
          {/* Decorative structure, not a heading. */}
          <div
            aria-hidden="true"
            className="display-xl mt-4"
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontWeight: 800,
              letterSpacing: "-0.04em",
              color: "var(--sabah-black)",
              maxWidth: "100%",
            }}
          >
            ALWAYS PITT ULTIMATE
          </div>
          <Measure className="mt-4">
            <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
              You do not stop being Pitt Ultimate.
            </h1>
            <p className="mt-4" style={body}>
              Four years on the field, then the rest of it. Same club, same people, longer roster.
            </p>
            <p className="mt-4" style={body}>
              Alumni Weekend is the one weekend a year everybody is in the same city on purpose.
            </p>
          </Measure>
        </header>

        {/* Full 1080px mosaic: deliberately unequal cards, different corners cut. */}
        <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
          <PhotoSlot
            className="md:col-span-4"
            label="EN SABAH NUR · SECTIONALS, 1998"
            slotKey="why_founding_1998"
            index="01"
            ratio="3 / 4"
          />
          <PhotoSlot
            className="md:col-span-8"
            label="Titles, 2012 and 2013"
            slotKey="why_back_to_back_2013"
            index="02"
            ratio="16 / 9"
          />
          <StatementCard
            className="md:col-span-7"
            index="03"
            ratio="21 / 9"
            slotKey="why_statement_card"
            caption="Every graduating class adds to it. Nobody comes off."
          >
            THE ROSTER JUST GETS LONGER
          </StatementCard>
        </div>

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The roster</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              Get plugged in.
            </h2>
            <p className="mt-4" style={body}>
              The people you played with are still around. So are the ones who came before you and
              the ones who came after, and most of them you have never met.
            </p>
            <p className="mt-4" style={body}>
              Come find them. That is most of what this weekend actually is.
            </p>
            <p className="mt-4" style={body}>
              If you are still playing: these are the people you will know for the next thirty
              years. Show up.
            </p>
          </Measure>
        </section>

        {/* The weekend itinerary lives on Schedule, which is the one place
            logistics are ever edited. This page stays evergreen. */}
        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The record</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              What the program has done.
            </h2>
          </Measure>
          <RecordStrip />
          <Measure className="mt-6">
            <p style={body}>
              Kept here so it is written down somewhere that is not a group chat. If a year is wrong
              or missing, tell an organizer and it gets fixed.
            </p>
            {/* No founding year is claimed. 1978 is stated only as the earliest
                roster the board can evidence, which is a fact the data supports. */}
          </Measure>

        </section>

        <section className="mt-14">
          <Measure>
            <SlashEyebrow>Where to go next</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              Two places from here.
            </h2>
            <p className="mt-4" style={body}>
              The board has everyone who ever played, by the year they finished. Schedule has the
              dates, times and places for this year, and it is the page that gets corrected first.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-5">
              {signedIn ? (
                <Link to="/me" style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
                  YOUR RECORD
                </Link>
              ) : (
                <button type="button" style={primaryButton} onClick={() => setClaimOpen(true)}>
                  FIND YOUR NAME
                </button>
              )}
              <Link
                to="/schedule"
                className="label-caps"
                style={{ color: "var(--pitt-royal)", textDecoration: "none" }}
              >
                This year&rsquo;s schedule
              </Link>
            </div>
          </Measure>
        </section>
      </main>
      <ClaimDialog
        open={claimOpen}
        target={null}
        onClose={() => setClaimOpen(false)}
        onClaimed={(personId) => {
          setClaimOpen(false);
          void navigate({ to: "/", hash: personId ? `person-${personId}` : undefined });
        }}
      />
    </PageShell>
  );
}

