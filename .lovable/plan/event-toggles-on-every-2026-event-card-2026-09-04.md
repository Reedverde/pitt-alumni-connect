# Event toggles on every 2026 event card

Put the three position toggle (No / no answer / Yes) directly on every event card of the current edition, on `/weekend` and on the homepage schedule summary, for everyone, signed in or not. The existing prompts inside the claim dialog stay as they are, but now cover the full set of events too.

## Scope change from the previous version

- No allowlist. The toggle appears on all 7 current 2026 events, not just BBQ and Alumni Game.
- Placeholder events count. The 3 rows with `is_placeholder = true` (Bar Crawl, Sabah alumni gathering, Pressure and BITT alumni gathering) get the toggle even before a time or location is locked.
- Events without a locked time get the toggle as well.
- Bar Crawl is included deliberately, as a soft interest signal rather than a hosted headcount.

## What gets built

**1. One shared toggle component, not a copy**

Extract the slider that already lives in `EventSubPrompts.tsx` into `src/components/events/EventAnswerToggle.tsx`: the tri state range input, the No / no answer yet / Yes caption row, the gold only on Yes rule, and the party size stepper. Controlled component, value in and change out, no saving logic of its own. `EventSubPrompts.tsx` renders it, so both surfaces stay identical forever.

**2. A card level control that knows how to save**

`EventCardAnswer.tsx` wraps the toggle for card use: reads the viewer's existing answer, decides what a tap means, saves, and shows the confirm prompt. Both `EventTile` implementations render it for every event of the current edition.

**3. Which events are eligible**

`getPromptEvents` stops matching titles. It becomes "every event row for the current edition," ordered by `sort_order`, with no `is_placeholder` filter. That same list is the server side allowlist for writes, so eligibility has exactly one definition. The `key`/`label` pair that today hardcodes `bbq` and `alumni_game` is replaced by the event id and its own title.

**4. Tap behavior**

- Signed out: the chosen state is held in session storage with the page to come back to, then the visitor is sent to sign in. After the link lands, they return to the same page and the tap is applied automatically.
- Signed in and already going: saves straight away through the same write path the claim dialog uses.
- Signed in, marked maybe or not this year, taps Yes: nothing is saved. A short confirm asks "You're marked maybe for the weekend. Update to going?" Confirming flips the weekend answer to going and then saves the event answer. Declining changes nothing and the toggle returns to its previously saved value.
- Signed in, marked maybe or not this year, taps No: saves straight away, no prompt.
- Party size appears under Yes only, default 1.

**5. Sign in and resume**

Reuse what exists, no new auth. The intent and a return path are written with the same safe storage helper the RSVP source capture uses, and the sign in page honours a return path instead of always landing on the profile page. On arrival the card component finds the stored intent, applies it once, and clears it.

## Files touched

- New: `src/components/events/EventAnswerToggle.tsx`, `src/components/events/EventCardAnswer.tsx`, `src/lib/event-intent.ts`
- Edited: `src/components/claim/EventSubPrompts.tsx`, `src/routes/weekend.tsx`, `src/components/schedule/ScheduleSummary.tsx`, `src/routes/auth.tsx` and `src/routes/auth_.callback.tsx`, `src/lib/event-rsvp.functions.ts`, `src/lib/event-rsvp.server.ts`

## Technical notes

- New server function `getMyEventAnswers`, owner scoped through the existing authenticated identity resolution, so a returning visitor sees their saved position. No email is exposed.
- `submitEventRsvpsServer` keeps refusing to write a Yes unless the person is going for the current edition. A No is accepted from anyone, so a maybe can rule an event out without changing the weekend answer. The client confirm is a courtesy, not the enforcement.
- The upgrade to going uses the existing `setMyRsvp` server function, so audit logging and edition handling are unchanged.
- The confirm prompt is a small local modal copying the overlay pattern already in `ClaimDialog`, not a new dialog library.
- Gold stays reserved for the Yes position. No and no answer read in Steel Ink and Chalk.
- Anything downstream that assumed two prompt events (the claim dialog panel, the drip "nothing left to answer" check, the admin event headcount panel) now reads the same full list, so it grows to 7 rows without special casing.

## Risks and ambiguity

- Seven sliders inside the claim dialog is a longer panel than two. It stays skippable and the weekend answer is already saved before it appears, so nobody is blocked, but the panel becomes scrollable on a phone.
- The drip prompt for people who have not answered now needs all 7 answers before it goes quiet. That is a real behaviour change to the reminder cadence; say the word if it should stay keyed to a smaller set.
- Placeholder events collect answers against a time and place that may still change. The answer is stored per event id, so a rescheduled placeholder keeps its answers; a deleted and recreated one loses them.
- The homepage summary and `/weekend` render the same cards, so a person can answer in two places in one session. The write is an upsert keyed on person and event, last tap wins, and both surfaces share one query key per person.
