import { Link } from "@tanstack/react-router";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ChamferPhoto } from "@/components/v2/ChamferPhoto";
import { ACTION, ALUMNI_WEEKEND } from "@/components/v2/curated-photos";
import nationalsCelebration from "@/assets/hero-nationals-celebration.jpg.asset.json";
import firstNationals2005 from "@/assets/pitt-first-nationals-team-2005.jpg.asset.json";

const BONE = "#F6F3ED";


const lede = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: "clamp(20px, 2.4vw, 26px)",
  lineHeight: 1.4,
  color: "var(--sabah-black)",
} as const;

const body = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 17,
  lineHeight: 1.65,
  color: "var(--steel-ink)",
} as const;

const linkButton = {
  display: "inline-flex",
  alignItems: "center",
  minHeight: 44,
  padding: "12px 20px",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase" as const,
  borderRadius: 7,
  textDecoration: "none",
};

/** The three weekend photographs: one shared ratio, one shared radius, so the
 *  row scans as a set instead of three separate cuts. */
const DAY_RATIO = "4 / 3";
const DAY_RADIUS = 12;

const DAYS = [
  {
    day: "Friday",
    photo: ALUMNI_WEEKEND.friday,
    summary:
      "Social night. City Kitchen, Pitt at Virginia Tech on the screen, then wherever the night takes us.",
  },
  {
    day: "Saturday",
    photo: ALUMNI_WEEKEND.saturday,
    summary:
      "The big one. Family BBQ at Schenley Overlook, then Pitt women's soccer that evening.",
  },
  {
    day: "Sunday",
    photo: ALUMNI_WEEKEND.sunday,
    summary: "Currents vs alumni at the Bubble. Play if you want to, watch if you don't.",
  },
];

/** Everything on /v2 between the hero and the claim board. The board itself is
 *  untouched: this block only sets up the story and the way into it. */
export function V2Story() {
  const pile = ACTION.contested;
  const transition = ACTION.sky;


  return (
    <>
      {/* THEME: the emotional centre of the page. */}
      <section style={{ background: BONE }} className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-[1320px] px-5 pt-16 pb-20 md:pt-24 md:pb-28">
          <div className="grid grid-cols-1 items-end gap-10 md:grid-cols-12">
            <div className="md:col-span-7">
              <SlashEyebrow>This year</SlashEyebrow>
              <h2
                className="mt-5"
                style={{
                  fontFamily: '"Archivo", sans-serif',
                  fontWeight: 800,
                  fontSize: "clamp(48px, 9vw, 132px)",
                  lineHeight: 0.86,
                  letterSpacing: "-0.045em",
                  paddingBottom: "0.06em",
                  color: "var(--sabah-black)",
                  textTransform: "uppercase",
                }}
              >
                We came back.
              </h2>
            </div>
            <div className="md:col-span-5">
              <ChamferPhoto
                src={nationalsCelebration.url}
                alt="Pitt players erupting in celebration on the field after qualifying for Nationals"
                ratio="5 / 4"
                corners={["tr", "bl"]}
                notch={68}
              />
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-10 md:mt-20 md:grid-cols-12 md:gap-8">
            {/* Portrait crop, deliberately dropped below the text baseline. */}
            <div className="md:col-span-4 md:pt-16">
              <ChamferPhoto
                src={clemsonBye.url}
                alt="Pitt players in team hoodies lying together on the grass between games"
                ratio="3 / 4"
                corners={["tl", "br"]}
                notch={52}
              />
            </div>

            <div className="md:col-span-8">
              <p className="max-w-[620px]" style={lede}>
                2025 was the first year since 2004 we missed Nationals. Everyone felt it. Then this
                year, we made it back.
              </p>

              <div className="mt-10 grid grid-cols-1 gap-8 md:grid-cols-2 md:items-start">
                <p className="max-w-[560px]" style={body}>
                  That's not a coincidence. It's not one class of seniors. It's every alum who ever
                  showed up to a Sunday scrimmage, made an introduction, sent a "you good?" text to
                  a sophomore having a rough season. The program doesn't run on nostalgia. It runs
                  on people staying in it.
                </p>
                <ChamferPhoto
                  src={pile.src}
                  alt={pile.alt}
                  ratio="4 / 3"
                  corners={["tr", "bl"]}
                  notch={48}
                  className="md:-mt-10"
                />
              </div>
            </div>
          </div>

          {/* ARCHIVE: one specific, captioned historical moment. */}
          <div className="mt-16 grid grid-cols-1 items-end gap-8 md:mt-24 md:grid-cols-12">
            <div className="md:col-span-7">
              <figure className="m-0">
                <ChamferPhoto
                  src={firstNationals2005.url}
                  alt="The 2005 Pitt squad, the first Pitt team to reach Nationals, posed together on the field"
                  ratio="3 / 2"
                  corners={["bl", "tr"]}
                  notch={60}
                />
                <figcaption
                  className="mt-4"
                  style={{
                    fontFamily: '"Space Mono", monospace',
                    fontSize: 13,
                    letterSpacing: "0.02em",
                    color: "var(--steel-ink)",
                  }}
                >
                  The first Pitt team to reach Nationals &middot; 2005
                </figcaption>
              </figure>
            </div>
            <div className="md:col-span-5 md:pb-6">
              <SlashEyebrow>Where it started</SlashEyebrow>
              <p className="mt-4 max-w-[460px]" style={body}>
                Every season since has been measured against the one where a Pitt team first showed
                up at Nationals. The names on the board below start well before that photograph and
                keep going after it.
              </p>
            </div>
          </div>

        </div>

        {/* A navy field cut on the same angle, carrying the eye into the weekend. */}
        <div
          aria-hidden="true"
          className="absolute -bottom-24 -left-16 hidden md:block"
          style={{
            width: 420,
            height: 220,
            background: "var(--royal-dark)",
            clipPath: "polygon(96px 0, 100% 0, 100% 100%, 0 100%, 0 96px)",
            opacity: 0.9,
          }}
        />
      </section>

      {/* WEEKEND: summary only. /schedule stays the source of truth. */}
      <section style={{ background: "var(--pitt-royal)" }} className="relative overflow-hidden">
        <div className="mx-auto w-full max-w-[1320px] px-5 pt-16 pb-16 md:pt-20 md:pb-20">
          <div className="grid grid-cols-1 items-end gap-8 md:grid-cols-12">
            <div className="md:col-span-8">
              <p className="flex items-center" style={{ color: "var(--pure-white)" }}>
                <span
                  aria-hidden="true"
                  style={{ color: "var(--pitt-gold)", fontSize: 13, fontWeight: 700, marginRight: 12 }}
                >
                  //
                </span>
                <span className="label-caps">Alumni Weekend</span>
              </p>
              <h2
                className="mt-5"
                style={{
                  fontFamily: '"Archivo", sans-serif',
                  fontWeight: 800,
                  fontSize: "clamp(40px, 6.5vw, 92px)",
                  lineHeight: 0.9,
                  letterSpacing: "-0.04em",
                  color: "var(--pure-white)",
                  textTransform: "uppercase",
                }}
              >
                Three days
              </h2>
            </div>
            <div className="md:col-span-4">
              <p className="max-w-[360px]" style={{ ...body, color: "var(--concrete)" }}>
                Three days in Pittsburgh, built out of the last twenty years of Alumni Weekends.
              </p>
            </div>
          </div>

          <div className="mt-14 grid grid-cols-1 gap-10 md:mt-20 md:grid-cols-3 md:items-start md:gap-8">
            {DAYS.map((d) => (
              <div key={d.day} className={d.offset}>
                <ChamferPhoto
                  src={d.photo.src}
                  alt={d.photo.alt}
                  ratio={d.ratio}
                  corners={[...d.corners]}
                  notch={d.notch}
                />
                <h3
                  className="mt-6"
                  style={{
                    fontFamily: '"Archivo", sans-serif',
                    fontWeight: 800,
                    fontSize: 30,
                    letterSpacing: "-0.025em",
                    textTransform: "uppercase",
                    color: "var(--pure-white)",
                  }}
                >
                  {d.day}
                </h3>
                <p className="mt-3 max-w-[420px]" style={{ ...body, color: "var(--concrete)" }}>
                  {d.summary}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-10 flex flex-wrap gap-3">
            <Link
              to="/schedule"
              style={{
                ...linkButton,
                background: "var(--pure-white)",
                color: "var(--pitt-royal)",
                border: "1px solid transparent",
              }}
            >
              Full schedule
            </Link>
            <Link
              to="/alumni"
              style={{
                ...linkButton,
                background: "transparent",
                color: "var(--pure-white)",
                border: "1px solid var(--pure-white)",
              }}
            >
              About the alumni program
            </Link>
          </div>
        </div>
      </section>

      {/* TRANSITION into the untouched board below. */}
      <section style={{ background: BONE }}>
        <div className="mx-auto w-full max-w-[1320px] px-5 pt-16 pb-14 md:pt-20">
          <div className="grid grid-cols-1 items-center gap-8 md:grid-cols-12">
            <div className="md:col-span-5">
              <SlashEyebrow>Next</SlashEyebrow>
              <p className="mt-4 max-w-[460px]" style={lede}>
                Everybody who ever played is on the wall below. Find your year, claim your name, and
                tell us whether you're in.
              </p>
            </div>
            <div className="md:col-span-7">
              <ChamferPhoto
                src={transition.src}
                alt={transition.alt}
                ratio="21 / 9"
                corners={["tl", "tr", "br", "bl"]}
                notch={40}
              />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
