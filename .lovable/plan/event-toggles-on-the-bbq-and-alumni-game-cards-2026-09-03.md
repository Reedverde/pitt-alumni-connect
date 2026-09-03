# Event toggles on the BBQ and Alumni Game cards

Put the three position toggle (No / no answer / Yes) directly on the two event cards on `/weekend` and on the homepage schedule summary, for everyone, signed in or not. The existing prompts inside the claim dialog stay exactly as they are.

## What gets built

**1. One shared toggle component, not a copy**

Extract the slider that already lives in `EventSubPrompts.tsx` into `src/components/events/EventAnswerToggle.tsx`: the tri state range input, the No / no answer yet / Yes caption row, the gold only on Yes rule, and the party size stepper. It becomes a controlled component (value in, change out) with no saving logic of its own. `EventSubPrompts.tsx` then renders that component instead of its own markup, so both surfaces stay identical forever.

**2. A card level control that knows how to save**

A second component, `EventCardAnswer.tsx`, wraps the toggle for card use: reads the viewer's existing answer, decides what a tap means, saves, and shows the confirm prompt. Both `EventTile` implementations render it only when the event is one of the two prompt events.

**3. Tap behavior**

- Signed out: the chosen state is held in session storage along with the page to come back to, then the visitor is sent to sign in. After the link lands, they return to the same page and the tap is applied automatically.
- Signed in and already going: saves straight away through the same write path the claim dialog uses.
- Signed in, marked maybe or not this year, taps Yes: nothing is saved. A short confirm asks "You're marked maybe for the weekend. Update to going?" Confirming flips the weekend answer to going and then saves the event answer. Declining changes nothing and the toggle returns to no answer.
- Signed in, marked maybe or not this year, taps No: saves straight away, no prompt.
- Party size appears under Yes exactly as it does today, default 1.

**4. Sign in and resume**

Reuse what exists, no new auth. The intent and a return path are written with the same safe storage helper the RSVP source capture already uses, and the sign in page gains a return path check so it sends the person back where they were instead of always to the profile page. On arrival the card component finds the stored intent, applies it once, and clears it.

## Files touched

- New: `src/components/events/EventAnswerToggle.tsx`, `src/components/events/EventCardAnswer.tsx`, plus a tiny intent helper in `src/lib/event-intent.ts`
- Edited: `src/components/claim/EventSubPrompts.tsx` (use the shared toggle), `src/routes/weekend.tsx` and `src/components/schedule/ScheduleSummary.tsx` (render the control inside `EventTile`), `src/routes/auth.tsx` (honour a return path), `src/lib/event-rsvp.functions.ts` and `src/lib/event-rsvp.server.ts` (add a read of my own answers)

## Technical notes

- `getPromptEvents` already resolves the two events by title on the current edition, so the cards match against that list rather than hardcoded ids. On a card that is not one of the two, nothing renders.
- New server function `getMyEventAnswers`, owner scoped through the existing authenticated identity resolution, so a returning visitor sees their saved position rather than a blank toggle. No email is exposed.
- `submitEventRsvpsServer` already refuses to write unless the person is going for the current edition. That server guard stays and is the reason the maybe path must flip the weekend answer first; the client confirm is a courtesy, not the enforcement.
- The upgrade to going uses the existing `setMyRsvp` server function, so audit logging and edition handling are unchanged.
- The confirm prompt is a small local modal that copies the overlay pattern already in `ClaimDialog` (fixed overlay, `role="dialog"`, escape to close), not a new dialog library and not a change to `ClaimDialog` itself.
- Gold stays reserved for the Yes position only. No and no answer read in Steel Ink and Chalk.

## Risks and ambiguity

- A signed out visitor whose email is not on the list will finish sign in without a record; the held intent then has nothing to write. It is dropped silently and the toggle stays at no answer.
- The homepage summary and `/weekend` both render the same cards, so a person can answer in two places in one session. The write is an upsert keyed on person and event, so last tap wins; the two surfaces will not stay live synced without a page level query, which is planned by keying the answer query per person so both read the same cache.
- Declining the upgrade prompt reverts the toggle visually. If they had a previously saved Yes, it reverts to that saved value rather than to no answer.
- Not covered unless you ask: any change to the drip reminder for people who have not answered, and any admin surface change.
