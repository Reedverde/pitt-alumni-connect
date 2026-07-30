import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteNav } from "@/components/SiteNav";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ActionRail } from "@/components/board/ActionRail";
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
    ],
  }),
  component: AlumniPage,
});

const body = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

/** The 560px measure applies to prose only. Anchors, the stat strip and the mosaic break out of it. */
function Measure({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-[560px] text-left ${className}`}>{children}</div>;
}

const RECORD = [
  { figure: "1998", label: "Founded" },
  { figure: "2005", label: "First Nationals" },
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
  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
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
            label="Founding, 1998"
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

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>Friday</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              Friday is always a social night.
            </h2>
            <p className="mt-4" style={body}>
              This year it is a crawl through Oakland and the Pitt away game on a screen.
            </p>
            <p className="mt-4" style={body}>
              Saturday is the cookout, with the field and the playground right there. Sunday is a
              game nobody has to play in.
            </p>
          </Measure>
          <PhotoSlot
            className="mt-8 md:max-w-[720px]"
            label="Back at Nationals, 2026"
            slotKey="why_return_2026"
            index="04"
            ratio="4 / 3"
          />
        </section>

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The record</SlashEyebrow>
          </Measure>
          <RecordStrip />
        </section>

        <section className="mt-14">
          <Measure>
            <SlashEyebrow>The board</SlashEyebrow>
          </Measure>
          <h2 className="display-xl mt-4" style={{ maxWidth: "100%" }}>
            FIND IT
          </h2>
          <Measure className="mt-6">
            <p style={body}>
              Everyone who ever played is on the board, by the year they finished.
            </p>
            <p className="mt-4" style={body}>
              Yours is grey until you say you are coming.
            </p>
            <div className="mt-8">
              {signedIn ? (
                <Link to="/me" style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
                  YOUR RECORD
                </Link>
              ) : (
                <Link to="/" style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
                  FIND YOUR NAME
                </Link>
              )}
            </div>
          </Measure>
        </section>
      </main>
      <ActionRail />
    </div>
  );
}
