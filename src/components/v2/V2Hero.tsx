import { Link } from "@tanstack/react-router";
import { type HeroRenderArgs } from "@/components/board/BoardExperience";
import { editionShortDates } from "@/lib/edition-format";
import firstTwoWeeksSeal from "@/assets/first-two-weeks-seal.png.asset.json";
import huddle from "@/assets/hero-team-huddle.jpg.asset.json";
import { RoundedChamferPhoto } from "@/components/v2/RoundedChamferPhoto";
import { RoundedChamferField } from "@/components/media/RoundedChamferBox";

const ctaBase = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  minHeight: 48,
  padding: "14px 28px",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 14,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  borderRadius: 7,
  textDecoration: "none",
  cursor: "pointer",
};

/**
 * Aggressive asymmetric chamfer: deep cut top-left, shallower cut bottom-right.
 * Expressed as fractions of the box so the shared rounded-polygon mask can
 * soften every vertex instead of leaving razor-sharp points.
 */
const HUDDLE_POINTS: Array<[number, number]> = [
  [0, 0.14],
  [0.22, 0],
  [1, 0],
  [1, 0.82],
  [0.88, 1],
  [0, 1],
];

/** The two supporting planes echo the hero cuts, on the same token scale. */
const ROYAL_PLANE_POINTS: Array<[number, number]> = [
  [0.26, 0],
  [1, 0],
  [1, 1],
  [0.08, 1],
];

const NAVY_PLANE_POINTS: Array<[number, number]> = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0.14, 1],
];

/**
 * The /v2 hero. One dominant photograph: the team huddle, oversized and pushed
 * to the page edge, cut with aggressive asymmetric chamfers, with royal and
 * navy planes continuing the crop's diagonals behind and beneath it. The
 * headline sits beside the image rather than on top of it. Photography renders
 * in original colour: no tint, no duotone, no grade. Gold stays reserved for
 * attending, so the only gold here is the eyebrow slash.
 */
export function V2Hero({ season, clock, countdownLive }: HeroRenderArgs) {
  const dates = season.edition ? editionShortDates(season.edition) : null;

  return (
    <section style={{ background: "var(--sabah-black)" }} className="relative overflow-hidden">
      {/* Royal plane echoing the photograph's top-left diagonal. */}
      <RoundedChamferField
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 hidden md:block"
        fill="var(--royal-dark)"
        opacity={0.55}
        tier="hero"
        points={ROYAL_PLANE_POINTS}
        style={{ width: "58%" }}
      />


      <div className="relative mx-auto grid w-full max-w-[1480px] grid-cols-1 items-center gap-10 px-5 pt-12 pb-16 md:grid-cols-12 md:gap-6 md:pt-20 md:pb-24 md:pl-10 md:pr-0">

        <div className="md:col-span-5">
          <p className="flex items-center" style={{ color: "var(--pure-white)" }}>
            <span
              aria-hidden="true"
              style={{ color: "var(--pitt-gold)", fontSize: 13, fontWeight: 700, marginRight: 12 }}
            >
              //
            </span>
            <span className="label-caps">Pitt Club Ultimate Alumni</span>
          </p>

          <h1
            className="mt-6"
            style={{
              fontFamily: '"Archivo", sans-serif',
              fontWeight: 800,
              fontSize: "clamp(52px, 8.4vw, 132px)",
              lineHeight: 0.84,
              letterSpacing: "-0.045em",
              paddingBottom: "0.08em",
              color: "var(--pure-white)",
              textTransform: "uppercase",
            }}
          >
            Still in
            <br />
            the game.
          </h1>

          <p
            className="mt-6 max-w-[520px]"
            style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 19, color: "var(--concrete)" }}
          >
            Every person who ever played, on one wall.
            {dates ? ` Alumni Weekend is ${dates.range}, ${dates.year}.` : " Alumni Weekend is the first weekend of October."}
          </p>
          {countdownLive && (
            <p className="label-caps mt-3" style={{ color: "var(--sterling)" }}>
              {clock.value} {clock.label.toLowerCase()}
            </p>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a
              href="#board"
              style={{
                ...ctaBase,
                background: "var(--pitt-royal)",
                color: "var(--pure-white)",
                border: "1px solid transparent",
              }}
            >
              Find your name
            </a>
            <Link
              to="/schedule"
              style={{
                ...ctaBase,
                background: "transparent",
                color: "var(--pure-white)",
                border: "1px solid var(--steel-ink)",
              }}
            >
              Alumni Weekend
            </Link>
          </div>
        </div>

        {/* The dominant image, oversized and run to the page edge. */}
        <div className="relative mt-8 md:col-span-7 md:mt-0">
          {/* Navy plane continuing the bottom-right cut. */}
          <RoundedChamferField
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-8 left-[-6%] hidden md:block"
            fill="var(--pitt-royal)"
            tier="lg"
            points={NAVY_PLANE_POINTS}
            style={{ width: "46%", height: "34%" }}
          />
          <RoundedChamferPhoto
            className="relative md:mr-[-4vw]"
            src={huddle.url}
            alt="Pitt players packed into a huddle with fists raised before a point"
            ratio="3 / 2"
            points={HUDDLE_POINTS}
            tier="hero"
            position="50% 45%"
            eager
          />

          {/* The seal straddles the photograph's top-right corner: about half on
              the frame, half on the black field above it, clear of the huddle
              faces and of the headline column. */}
          <img
            src={firstTwoWeeksSeal.url}
            alt="First two weeks of October, every year"
            className="pointer-events-none absolute right-[4%] top-0 -translate-y-[42%] select-none md:right-[0.5vw] md:-translate-y-1/2"
            style={{
              width: "clamp(104px, 13vw, 196px)",
              height: "auto",
              filter: "drop-shadow(0 14px 28px rgba(0, 0, 0, 0.55))",
            }}
            loading="eager"
          />

        </div>
      </div>
    </section>
  );
}
