import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteNav } from "@/components/SiteNav";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { LabelRow } from "@/components/board/LabelRow";
import { IndexPills } from "@/components/board/IndexPills";
import { ActionRail } from "@/components/board/ActionRail";
import { PhotoSlot, StatementCard } from "@/components/media/PhotoSlot";
import { primaryButton } from "@/components/claim/ui";

export const Route = createFileRoute("/why")({
  head: () => ({
    meta: [
      { title: "Why Now — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Pitt Club Ultimate missed Nationals in 2025 for the first time since 2004, and came back in 2026. The case for being part of the climb: jobs and mentorship.",
      },
      { property: "og:title", content: "Why Now — Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content: "Four programs, one roof. The case for being part of the climb rather than the trophy case.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WhyPage,
});

const mono = { fontFamily: '"Space Mono", monospace' } as const;
const body = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

function WhyPage() {
  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <div className="max-w-[560px] text-left">
          <header className="pt-10 md:pt-14">
            <SlashEyebrow>Why now</SlashEyebrow>
            <h1 className="display-48 mt-3" style={{ color: "var(--sabah-black)" }}>
              THE CLIMB, NOT THE TROPHY
            </h1>
          </header>

          <section className="mt-8">
            <p style={body}>
              En Sabah Nur was founded in spring <span style={mono}>1998</span> by Brody Brotman and
              Erik Frank. The first Nationals appearance came in <span style={mono}>2005</span>. The
              back-to-back national titles came in <span style={mono}>2012</span> and{" "}
              <span style={mono}>2013</span>.
            </p>
            <p className="mt-4" style={body}>
              Pitt went to Nationals every year from <span style={mono}>2005</span> through{" "}
              <span style={mono}>2024</span>, missed in <span style={mono}>2025</span> for the first
              time since <span style={mono}>2004</span>, and returned in <span style={mono}>2026</span>.
            </p>
            <h2 className="display-xl mt-8">1998</h2>
            <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <PhotoSlot
                className="sm:col-span-1 sm:row-span-2"
                label="Team photo, 1998"
                index="01"
                ratio="3 / 4"
                corners={["tl"]}
              />
              <PhotoSlot
                className="sm:col-span-2"
                label="Founding roster, spring"
                index="02"
                ratio="16 / 9"
                corners={["br"]}
              />
              <StatementCard className="sm:col-span-1" index="03" ratio="1 / 1" corners={["tl", "br"]}>
                Founded spring 1998. First Nationals 2005.
              </StatementCard>
              <PhotoSlot
                className="sm:col-span-1"
                label="Practice field"
                index="04"
                ratio="1 / 1"
                corners={["tr"]}
              />
            </div>
          </section>

          <section className="mt-10">
            <SlashEyebrow>What happened after the miss</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              THE PHONE RANG
            </h2>
            <p className="mt-4" style={body}>
              Alumni turned up after the program missed Nationals, not after it won. A trophy case
              asks nothing of you. A team on the way back up does, and that is a better reason to be
              here.
            </p>
            <div className="mt-6">
              <LabelRow label="Sideline, 2012–2013" right="Back to back" />
              <PhotoSlot
                className="mt-3"
                label="Sideline, 2013 Nationals"
                index="05"
                ratio="21 / 9"
                corners={["tl", "br"]}
              />
            </div>
          </section>

          <section className="mt-10">
            <SlashEyebrow>What we are actually asking</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              TWO THINGS THAT COMPOUND
            </h2>
            <div className="mt-4">
              <IndexPills count={2} active={1} />
            </div>
            <p className="mt-4" style={body}>
              First: hire current players, or get them in front of someone who will. A roster full of
              people who graduate into work they want is a program that keeps recruiting itself.
            </p>
            <p className="mt-4" style={body}>
              Second: mentor them. An hour on a call about a first job, a grad program, or a city
              they are moving to does more for the next five years than any amount of remembering
              does.
            </p>
          </section>

          <section className="mt-10">
            <SlashEyebrow>Four programs, one roof</SlashEyebrow>
            <h2 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
              PITT CLUB ULTIMATE
            </h2>
            <p className="mt-4" style={body}>
              En Sabah Nur is the men's A program. The men's B program began in{" "}
              <span style={mono}>2005</span> as Sabah B, became BITT, and has been Pressure since the{" "}
              <span style={mono}>2025</span> season. Pansy was the women's A program; Danger has been
              the women's A program from <span style={mono}>2006</span> on. Danger B is the women's B
              program.
            </p>
            <p className="mt-4" style={body}>
              All four sit under one umbrella here, at the same width, on the same wall.
            </p>
            <div className="mt-6">
              <LabelRow label="Return to Nationals" right="2026" />
              <PhotoSlot
                className="mt-3"
                label="Return to Nationals, 2026"
                index="09"
                ratio="4 / 3"
                corners={["bl"]}
              />
            </div>
          </section>

          <section className="mt-12">
            <Link to="/" style={{ ...primaryButton, display: "inline-block", textDecoration: "none" }}>
              Find your year on the board
            </Link>
          </section>
        </div>
      </main>
      <ActionRail />
    </div>
  );
}
