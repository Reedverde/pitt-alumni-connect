import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteNav } from "@/components/SiteNav";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ActionRail } from "@/components/board/ActionRail";
import { PhotoSlot, StatementCard } from "@/components/media/PhotoSlot";
import { primaryButton } from "@/components/claim/ui";
import { useEditionContext } from "@/lib/useEdition";
import { editionLongRange, resolveSeason } from "@/lib/edition-format";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why Now — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Twenty years at Nationals, then one gap. Alumni turned up after the miss, not after the titles. It was never a trophy case. It was a climb.",
      },
      { property: "og:title", content: "Why Now — Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content: "Twenty years, then one gap. It was never a trophy case. It was a climb.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhyPage,
});

const body = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

/** The 560px measure applies to prose only. Anchors and the mosaic break out of it. */
function Measure({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`max-w-[560px] text-left ${className}`}>{children}</div>;
}

/** The dates read from the current edition, so this sentence never expires. */
function WeekendDates() {
  const { data } = useEditionContext();
  const season = data ? resolveSeason(data.current, data.next) : null;
  return (
    <p className="mt-4" style={body}>
      {season?.edition
        ? `${editionLongRange(season.edition)}. Then the first weekend of October, every year after that.`
        : "The first weekend of October, every year."}
    </p>
  );
}

function WhyPage() {
  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <header className="pt-10 md:pt-14">
          <Measure>
            <SlashEyebrow>Why now</SlashEyebrow>
          </Measure>
          {/* Decorative structure, not a heading: the year the streak broke. */}
          <div
            aria-hidden="true"
            className="display-xl mt-4"
            style={{
              fontFamily: '"Space Mono", monospace',
              fontWeight: 700,
              letterSpacing: "-0.045em",
              color: "var(--sabah-black)",
              maxWidth: "100%",
            }}
          >
            2025
          </div>
          <Measure className="mt-4">
            <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
              Twenty years, then one gap.
            </h1>
          </Measure>
        </header>

        <section className="mt-6">
          <Measure>
            <p style={body}>
              Pitt went to Nationals every year from 2005 through 2024. In 2025 it did not. First
              time since 2004. In 2026 it went back.
            </p>
            <p className="mt-4" style={body}>
              Here is the part worth paying attention to. Alumni turned up in numbers after the
              miss, not after the titles. Almost nobody wrote in when the program won back to back
              in 2012 and 2013. People wrote in when the streak broke.
            </p>
            <p className="mt-4" style={body}>
              That tells you what this is actually for. It was never a trophy case. It was a climb,
              and people want to be near a climb.
            </p>
          </Measure>

          {/* Full 1080px mosaic: three deliberately unequal cards, different corners cut. */}
          <div className="mt-10 grid grid-cols-1 gap-4 md:grid-cols-12">
            <PhotoSlot
              className="md:col-span-4"
              label="Founding, 1998"
              slotKey="why_founding_1998"
              index="01"
              ratio="3 / 4"
              corners={["tl"]}
            />
            <PhotoSlot
              className="md:col-span-8"
              label="Back to back, 2013"
              slotKey="why_back_to_back_2013"
              index="02"
              ratio="16 / 9"
              corners={["br"]}
            />
            <StatementCard
              className="md:col-span-7"
              index="03"
              ratio="21 / 9"
              corners={["tl", "bl"]}
              slotKey="why_statement_card"
            >
              It is grey until you say you are coming.
            </StatementCard>
          </div>
        </section>

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The ask</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              There isn't one.
            </h2>
            <p className="mt-4" style={body}>
              No money this year. No dues, no plate to buy, no envelope.
            </p>
            <p className="mt-4" style={body}>
              Two things compound, and neither one is nostalgia. Alumni get current players hired.
              Alumni tell a twenty year old something a coach cannot. Both of those need people in
              the same place once, and after that they run on their own.
            </p>
          </Measure>
        </section>

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The weekend</SlashEyebrow>
            <p className="mt-4" style={body}>
              Friday night, the away game on a screen.
            </p>
            <p className="mt-4" style={body}>
              All four programs share the Saturday cookout. Everything else, each team does its own
              way.
            </p>
            <p className="mt-4" style={body}>
              Saturday, a cookout with a playground next to it, because most of you have kids now
              and that turned out to be the reason people said no.
            </p>
            <p className="mt-4" style={body}>
              Sunday, a game nobody has to play in.
            </p>
            <WeekendDates />
          </Measure>
          <PhotoSlot
            className="mt-8 md:max-w-[720px]"
            label="The return"
            slotKey="why_return_2026"
            index="04"
            ratio="4 / 3"
            corners={["bl"]}
          />
        </section>

        <section className="mt-12">
          <Measure>
            <SlashEyebrow>The board</SlashEyebrow>
          </Measure>
          <h2 className="display-xl mt-4" style={{ maxWidth: "100%" }}>
            FIND IT
          </h2>
          <Measure className="mt-6">
            <p style={body}>
              The program started in spring 1998. Twenty eight years later there are four teams.
            </p>
            <p className="mt-4" style={body}>
              If you played on any of them, your name is already on the board. It is grey until you
              say you are coming.
            </p>
            <div className="mt-8">
              <Link to="/" style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
                FIND YOUR NAME
              </Link>
            </div>
          </Measure>
        </section>
      </main>
      <ActionRail />
    </div>
  );
}
