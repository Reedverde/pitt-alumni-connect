# Homepage story rewrite: story sections before the board

## Goal
`/` opens with the approved story copy (three sections) ahead of the counter bar and the claim board. `/schedule` stays the single source of truth for times, locations, hotel, and per event RSVP.

## Recommended structural change (flag for confirmation)
The homepage currently renders `ScheduleSummary` (live event tiles with per event toggles) after the counter bar. Section 3 takes over that teaser role, so keeping both would duplicate the schedule surface. Recommendation: **remove `ScheduleSummary` from the homepage** and let Section 3 be the only schedule teaser there. Per event toggles and full detail stay on `/schedule` and in the claim dialog. This also lets the homepage drop the `weekendQuery` loader entry (`getWeekendPage` becomes unused on `/`). If you would rather keep `ScheduleSummary` too, say so and the plan adjusts to only inserting the sections.

## Files changed
1. **`src/components/home/WeekendColumns.tsx` (new)** — the featured 3 column component, extracted so `index.tsx` (already 1200+ lines) does not grow. Exported once, used once.
2. **`src/routes/index.tsx`** — insert three story sections between `<Hero />` and `<CounterBar />`; remove `ScheduleSummary` and its `weekendQuery`/loader line per above. Board, counter bar, claim flow, filters, and all logic below stay byte for byte unchanged. `head()` meta unchanged.

## Section layout
All inside a `max-w-[1080px]` container (matches `alumni.tsx`), placed on the `field-white` background before the counter bar:

- **Section 1** — `SlashEyebrow` "The climb", `display-48`-scale Archivo heading "We came back.", two body paragraphs at the 560px prose measure using the `body` style constant pattern from `alumni.tsx` (16px, `var(--steel-ink)`, lineHeight 1.6). Copy verbatim as approved.
- **Section 2** — `SlashEyebrow` "Why this weekend", `display-30` Archivo heading "You don't stop being Pitt Ultimate. The roster just gets longer.", two body paragraphs at the measure. Copy verbatim.
- **Section 3** — `WeekendColumns`: `SlashEyebrow`-led featured grid.

## WeekendColumns component
- Three equal columns in a grid (`grid-cols-1 md:grid-cols-3`), FRIDAY / SATURDAY / SUNDAY.
- Each column is a `NotchedBox` with `stroke="var(--chalk)"`, `fill="var(--pure-white)"`, alternating corner cuts (`["tl"]`, `["br"]`, `["tl"]`) exactly like the schedule lanes in `ScheduleSummary`, `notch={NOTCH_SM}`.
- Inside each: day name as an Archivo 800 `display-30`-style label in `var(--sabah-black)`, then the approved punchy summary in Space Grotesk body style.
- Each column ends with a link to `/schedule` styled with the existing `ghostButton` style (exported from `ScheduleSummary`, import stays valid). Label "Full schedule" with the day name, e.g. "Friday details" — final label wording in code review. One concern: pointing all three at plain `/schedule`, no hash anchors, since the schedule page does not currently expose per day anchor ids.
- **No gold anywhere in these sections.** No attending meaning. No gradients, no shadows.

## Not changed
- Hero, counter bar, board, claim dialog, filters, `PersonPanel`, footer, `/schedule` itself, all server code. No database changes. No new dependencies.

## Verification
- `tsgo --noEmit` clean, build OK.
- Playwright on `http://localhost:8080/`: sections 1 to 3 render in order above the counter bar, three columns visible at desktop width, links resolve to `/schedule`, board renders unchanged below.
- Update `PROJECT_STATE.md`.
