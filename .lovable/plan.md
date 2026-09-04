# Alumni Connect: one connected redesign

Three layers that the product currently blends together, separated everywhere:

1. **Identity / claim** — this name is me, this email is mine (permanent)
2. **Roster profile** — names, city, program, playing years, privacy preferences (evergreen)
3. **Annual RSVP** — one card per edition year, plus per-event answers (dated, kept as history)

Nothing is deleted. Every existing RSVP, stint, identity and auth record stays exactly as it is.

## What I confirmed in the project before planning

- One current edition exists: 2026, Oct 2 to 4. It is the only published edition, so the annual card must be generated from the edition record rather than any hardcoded year.
- 2026 has five events. Exactly two are flagged to collect an individual response. Only two of the five carry an end time, so a "weekend is over" rule cannot rely on event end times alone and needs a defined fallback.
- Current 2026 answers: 63 going, 35 maybe, 32 not this year. People with no row are the implicit "No response" bucket, and that distinction must survive.
- The public board view for placed alumni excludes archived people. The separate coaches view does not, so an archived coach can appear publicly today. One archived person exists.
- The view named `current_players` is not about current players at all: it is every stint from the trusted sources, with no year and no role filter. The name misleads anyone reading the data layer.
- Stints carry a source and a confirmation stamp. The sources in use are the alumni-page scrape, admin entry, roster import, and self-entry. The confirmation stamp is largely unused, which is what makes the public "unconfirmed" presentation misleading.
- Contact tips are stored today as a single free-text value with no contact type.
- The chamfer design tokens already exist as shared tiers with matching CSS variables and reusable box/photo primitives. Everything new reuses them.

---

## Phase 1 — Data foundations (no visible change)

**Outcome.** The data layer can express the new model before any screen changes.

**Instructions.** Add an admin-settable fallback for when the annual card stops being editable. Derive the cutoff from the latest event end time of the edition where one exists, otherwise from the edition's last day at end of day Eastern, with the admin setting overriding both. Give events an explicit published flag so the annual card can list eligible events without treating a placeholder as unpublished. Give contact tips a structured shape of contact type plus value, and treat every existing tip as type "other". Correct the coaches view so archived people are excluded, matching the placed-alumni view. Introduce a clearly named replacement for the misleading `current_players` view, documented as trusted-source roster stints, and leave the old name in place until call sites move in the final phase. Add two admin-only reporting views: annual totals per edition and response totals per event.

**Areas affected.** Editions and events data, app settings, suggestions payloads, the coaches board view, the roster-stints view, and new reporting views.

**Risks.** Recreating the coaches view is the only behavioural change here; a mistake would hide legitimate coaches. Reporting views must not become a side door around row-level security, so they stay admin-audience only and are gated in the server functions that read them.

**Acceptance.** The board renders unchanged. Reporting totals reconcile exactly with direct counts. The security linter shows nothing new. An anonymous request against the new reporting views returns nothing.

## Phase 2 — Find Your Year cleanup

**Outcome.** A visitor lands, searches, and finds their name without decoding a legend first.

**Instructions.** Make search the dominant control at the top of the board. Demote filtering to a compact row of four: Program, Profile Status, Era, Sort. Split what is currently one blended status list into two: profile status (Claimed, Unclaimed, No contact) and this year's attendance (Going, Maybe, Not this year, No response). Keep In memoriam as its own separate toggle, never folded into either group. Move the legend below the filters as secondary information. Add one short line explaining that a name sits under its last playing season, falling back to graduation year when no playing history is known.

**Areas affected.** The board experience component, name chip, label row, board data function and grouping helper.

**Risks.** The board data currently carries a single blended state. Both new states should be carried alongside it during the phase and the old one retired only at the end, so nothing reads a half-migrated shape.

**Acceptance.** Counts in the sticky bar match the Phase 1 reporting totals. No email address appears in any public payload. Archived coaches are gone. Desktop and mobile both verified.

## Phase 3 — Claiming and the missing-person path

**Outcome.** Claiming a profile is possible without answering the RSVP, and a missing person arrives with enough detail for an organizer to act.

**Instructions.** Restructure the claim into pick your name, verify your email, confirm basic roster facts, then optionally answer this year's RSVP. Saying you are coming is still the signup, and there is still no bare "create account" button anywhere; the change is only that a claim no longer forces an answer. The missing-person submission collects first and last name, played-as name, program or team, approximate playing years or simply the last year played, optional graduation year, and email. Every uncertain field offers a "Not sure" choice. Before submitting, show likely duplicate matches from the existing fuzzy matcher and let the person pick one instead.

**Areas affected.** The claim dialog, the RSVP server layer, and the account server functions.

**Risks.** The RSVP write path currently assumes a status is always present; a claim-only path must not write an empty or default annual row, because that would silently convert "No response" into an answer.

**Acceptance.** A claim completes with no annual row created. A missing-person submission arrives in the review queue with all the new fields including the "Not sure" markers. Duplicate suggestions still appear.

## Phase 4 — /me rebuild

**Outcome.** A member sees who they are permanently, then what they said about this year, then their history.

**Instructions.** Top of the page is "My alumni profile", editable: names, played-as, city, program or division, playing years and stints, email addresses with a primary choice, and privacy and networking preferences. Below it, a single annual card titled from the current edition, so it reads "2026 Alumni Weekend RSVP" today and becomes a new card next year with no code change. Prior years remain below as read-only history. The current card is editable until the Phase 1 cutoff, after which it renders read-only with a short plain sentence saying why.

**Areas affected.** The `/me` route, which is large enough today that it should be split into focused profile, annual card and history components.

**Risks.** The card must resolve its year from the edition record, never from the system clock, or the page breaks the moment an edition is rolled forward.

**Acceptance.** Rolling the current edition forward in a test produces a new empty card and pushes the old one into read-only history with its answers intact.

## Phase 5 — The annual card and the three-position control

**Outcome.** One card answers the weekend and every event on it, with an unanswered state that is genuinely unanswered.

**Instructions.** The card carries an overall status of Going, Maybe, Not this year or No response, a party size shown only when Going, then a row for every published eligible event of that edition with its own answer and its own party size. Each event row uses a three-position segmented slider: No on the left in a muted earth neutral, No choice in the centre, Yes on the right in an accessible green. Green is deliberate here because Pitt Gold means attending the weekend and nothing else. Centre is a real state that is never saved as No. The thumb animates between positions and holds still when the visitor prefers reduced motion. The control is reachable and operable by keyboard with a visible focus ring, is labelled by its event, and announces its saved state to a screen reader. Saving feedback appears inline beside the control rather than as a toast.

**Areas affected.** The event prompt components used by both the claim flow and `/me`, and the event RSVP server layer.

**Risks.** Today an event yes can silently promote someone to going for the weekend. That behaviour should be kept but made visible in the card, otherwise the overall status appears to change on its own.

**Acceptance.** Keyboard-only and screen-reader passes both succeed. An untouched event stays unanswered in the data. Party size only persists for a yes.

## Phase 6 — Organizer tools

**Outcome.** An organizer opens one overview and knows what to do next.

**Instructions.** Lead with an overview of going, planned heads, maybe, not this year, no response, claimed, no contact, going with missing event answers, pending new people and duplicates, incomplete profiles or missing placement, and bounced or suppressed contacts. Every tile opens the matching filtered queue. Add per-event totals of yes, no, unanswered and planned heads. Split person detail into clearly separated sections for profile, contact, roster, annual RSVP and events, mirroring the same three layers as `/me`. Rework missing-person review so the structured fields and duplicate candidates sit side by side. Keep the planning export admin-only and extend it with the annual and per-event columns. Keep source and confirmation provenance visible to organizers, and remove the misleading unused confirmation presentation from public-facing surfaces.

**Areas affected.** The admin route, the admin server layer, the panels, people table and review queue components.

**Risks.** The export is the widest data surface in the product and must stay behind the admin check with no public path to it.

**Acceptance.** Every tile number reconciles with a direct count. The export contains the new columns and is unreachable without admin.

## Phase 7 — Visual and cleanup pass

**Outcome.** The new surfaces look like they were always part of the site.

**Instructions.** Apply the current `/v2` Pitt direction throughout: same typography, same palette, original photo colors, fully responsive. Every image and every decorative angled shape uses the shared chamfer tokens with softened rounded vertices, at the tier that fits its size. No plain rectangles where a chamfer belongs, no razor-sharp points, no new one-off notch and radius values. Move the remaining readers of the misleading roster view onto the clearly named one and update the project state document.

**Acceptance.** A visual sweep of desktop and mobile finds no sharp-cornered chamfer and no untokenized geometry.

---

## Sequencing and safety

Phases 1, 2, 5 and 7 can each ship and be verified alone. Phase 4 depends on 1. Phase 6 depends on 1 and 3. Every data change is additive, so a rollback is a UI revert; the coaches view correction is the only recreate and is reversible on its own. No existing profile, stint, identity or RSVP row is edited or removed at any point, and the 2026 totals of 63, 35 and 32 are checked before and after each phase.

## One decision to confirm

The editable-until cutoff defaults to the latest event end time, falling back to the edition's final day at end of day Eastern, with an admin override. Tell me if you would rather members keep a grace period to edit for a day or two after the weekend.
