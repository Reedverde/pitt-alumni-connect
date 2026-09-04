import { Link } from "@tanstack/react-router";
import { type HeroRenderArgs } from "@/components/board/BoardExperience";
import { ChamferPhoto } from "@/components/v2/ChamferPhoto";
import { ACTION } from "@/components/v2/curated-photos";
import { editionShortDates } from "@/lib/edition-format";
import firstTwoWeeksSeal from "@/assets/first-two-weeks-seal.png.asset.json";

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
 * The /v2 hero. Oversized condensed headline against an aggressively cut
 * photographic composition of real action frames: a handler throwing around a
 * mark, chamfered top-left and bottom-right, with a player skying for the catch
 * overlapping it on the opposite corners, and a royal field
 * that continues the wide crop's diagonal. Gold stays reserved for attending,
 * so the only gold here is the eyebrow slash the whole site already uses.
 */
export function V2Hero({ season, clock, countdownLive }: HeroRenderArgs) {
  const dates = season.edition ? editionShortDates(season.edition) : null;

  const wide = ACTION.aroundTheMark;
  const portrait = ACTION.sky;

  return (
    <section style={{ background: "var(--sabah-black)" }} className="relative overflow-hidden">
      <div className="relative mx-auto grid w-full max-w-[1320px] grid-cols-1 items-end gap-12 px-5 pt-12 pb-16 md:grid-cols-12 md:gap-8 md:pt-16 md:pb-24">
        <div className="md:col-span-7">
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
              fontSize: "clamp(52px, 10.5vw, 148px)",
              lineHeight: 0.85,
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

        <div className="relative md:col-span-5">
          {/* A royal field on the same 45 degree angle, continuing the crop's edge. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-6 -top-8 hidden md:block"
            style={{
              width: "62%",
              height: "58%",
              background: "var(--royal-dark)",
              clipPath: "polygon(72px 0, 100% 0, 100% 100%, 0 100%, 0 72px)",
            }}
          />
          <ChamferPhoto
              src={wide.src}
              alt={wide.alt}
              ratio="4 / 3"
              corners={["tl", "br"]}
              notch={72}
              eager
              className="relative"
            />
          <ChamferPhoto
              src={portrait.src}
              alt={portrait.alt}
              ratio="3 / 4"
              corners={["tr", "bl"]}
              notch={44}
              outline="var(--sabah-black)"
              outlineWidth={6}
              className="relative mt-4 w-1/2 md:absolute md:-bottom-16 md:-left-20 md:mt-0 md:w-[58%]"
            />
        </div>

        <img
          src={firstTwoWeeksSeal.url}
          alt="First two weeks of October, every year"
          className="pointer-events-none absolute right-4 top-4 select-none md:right-6 md:top-6"
          style={{ width: "clamp(72px, 9vw, 132px)", height: "auto" }}
          loading="eager"
        />
      </div>
    </section>
  );
}
