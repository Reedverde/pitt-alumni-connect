import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { BoardExperience, boardQuery, type HeroRenderArgs } from "@/components/board/BoardExperience";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import heroPeak from "@/assets/hero-peak.png.asset.json";
import firstTwoWeeksSeal from "@/assets/first-two-weeks-seal.png.asset.json";
import { ghostButton, primaryButton } from "@/components/schedule/ScheduleSummary";
import { WeekendColumns } from "@/components/home/WeekendColumns";
import { SITE_ORIGIN } from "@/lib/site-url";
import { editionShortDates, nextOctoberYear } from "@/lib/edition-format";

const storyBody = { fontSize: 16, color: "var(--steel-ink)", lineHeight: 1.6 } as const;

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
          "Every Pitt Club Ultimate alum on one wall, by year. See who has claimed their name and who is coming to Alumni Weekend.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/` },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  errorComponent: BoardError,
  component: HomePage,
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

function HomePage() {
  return <BoardExperience renderHero={(args) => <Hero {...args} />} story={<HomeStory />} />;
}

function HomeStory() {
  return (
      <div className="mx-auto w-full max-w-[1080px] px-5">
        <section className="pt-12">
          <SlashEyebrow>The climb</SlashEyebrow>
          <h2 className="display-48 mt-4" style={{ color: "var(--sabah-black)" }}>
            We came back.
          </h2>
          <div className="mt-4 max-w-[560px]">
            <p style={storyBody}>
              2025 was the first year since 2004 we missed Nationals. Everyone felt it. Then this
              year, we made it back.
            </p>
            <p className="mt-4" style={storyBody}>
              That's not a coincidence. It's not one class of seniors. It's every alum who ever
              showed up to a Sunday scrimmage, made an introduction, sent a "you good?" text to a
              sophomore having a rough season. The program doesn't run on nostalgia. It runs on
              people staying in it.
            </p>
          </div>
        </section>

        <section className="pt-14">
          <SlashEyebrow>Why this weekend</SlashEyebrow>
          <h2 className="display-30 mt-4" style={{ color: "var(--sabah-black)" }}>
            You don't stop being Pitt Ultimate. The roster just gets longer.
          </h2>
          <div className="mt-4 max-w-[560px]">
            <p style={storyBody}>
              Four years on the field, then the rest of it. Alumni Weekend is the one weekend a
              year everybody's in the same city on purpose, currents and alumni, three teams, every
              era.
            </p>
            <p className="mt-4" style={storyBody}>
              Come watch the climb. Come meet the sophomore who's about to be someone. Come find
              out who's hiring.
            </p>
          </div>
        </section>

        <WeekendColumns />
      </div>
  );
}

/** Display hero: the date is the picture. No gold: nobody is coming in a hero. */
function Hero({ season, clock, countdownLive, onClaim }: HeroRenderArgs) {
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

        {/* The starburst seal rides the top right corner, clear of the headline. */}
        <img
          src={firstTwoWeeksSeal.url}
          alt="First two weeks of October, every year"
          className="pointer-events-none absolute right-4 top-4 z-10 select-none md:right-8 md:top-8"
          style={{ width: "clamp(90px, 13vw, 180px)", height: "auto" }}
        />

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
            <Link to="/schedule" style={{ ...ghostButton, color: "var(--pure-white)", border: "1px solid var(--steel-ink)" }}>
              See the schedule
            </Link>
          </div>

        </div>
      </div>
    </section>
  );
}
