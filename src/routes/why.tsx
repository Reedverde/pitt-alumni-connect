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
          "Twenty years at Nationals, then one gap. Alumni turned up after the miss, not after the titles. Alumni Weekend is October 2 to 4, 2026.",
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

function WhyPage() {
  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />

      <main className="mx-auto w-full max-w-[1080px] px-5 pb-24">
        <div className="max-w-[560px] text-left">
          <header className="pt-10 md:pt-14">
            <SlashEyebrow>Why now</SlashEyebrow>
            <h2 className="display-xl mt-4">TWENTY YEARS</h2>
            <h1 className="display-30 mt-4" style={{ color: "var(--sabah-black)" }}>
              Twenty years, then one gap.
            </h1>
          </header>

          <section className="mt-6">
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

            <div className="mt-8">
              <LabelRow label="Founding" right="1998" />
              <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
                <PhotoSlot
                  className="sm:col-span-1 sm:row-span-2"
                  label="Founding, 1998"
                  index="01"
                  ratio="3 / 4"
                  corners={["tl"]}
                />
                <PhotoSlot
                  className="sm:col-span-2"
                  label="Back to back, 2013"
                  index="02"
                  ratio="16 / 9"
                  corners={["br"]}
                />
                <StatementCard className="sm:col-span-2" index="03" ratio="21 / 9" corners={["tl", "br"]}>
                  It is grey until you say you are coming.
                </StatementCard>
              </div>
            </div>
          </section>

          <section className="mt-12">
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
            <div className="mt-6">
              <IndexPills count={2} active={1} />
            </div>
          </section>

          <section className="mt-12">
            <SlashEyebrow>The weekend</SlashEyebrow>
            <p className="mt-4" style={body}>
              Friday night, the away game on a screen.
            </p>
            <p className="mt-4" style={body}>
              Saturday, a cookout with a playground next to it, because most of you have kids now
              and that turned out to be the reason people said no.
            </p>
            <p className="mt-4" style={body}>
              Sunday, a game nobody has to play in.
            </p>
            <p className="mt-4" style={body}>
              October 2 to 4, 2026. Then the first weekend of October, every year after that.
            </p>
            <div className="mt-8">
              <LabelRow label="The return" right="2026" />
              <PhotoSlot
                className="mt-3"
                label="The return, 2026"
                index="04"
                ratio="4 / 3"
                corners={["bl"]}
              />
            </div>
          </section>

          <section className="mt-12">
            <SlashEyebrow>The board</SlashEyebrow>
            <h2 className="display-xl mt-4">FIND IT</h2>
            <p className="mt-6" style={body}>
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
          </section>
        </div>
      </main>
      <ActionRail />
    </div>
  );
}
