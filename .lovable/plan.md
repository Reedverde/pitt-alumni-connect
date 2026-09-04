# Alumni Connect: profile vs. annual RSVP separation

One organizing idea runs through every phase: three distinct layers that the product currently blends together.

1. **Identity / claim** — this name is me, this email is mine (permanent)
2. **Roster profile** — names, city, program, playing years, privacy prefs (evergreen)
3. **Annual RSVP** — one card per edition year, plus per-event answers (dated, historical)

Nothing existing is deleted. All 130 RSVP rows, 1,040 stints, identities, and auth stay as they are.

## What I verified before writing this

- One current edition exists: 2026, Oct 2 to 4, `is_current = true`.
- 2026 has five events; exactly two carry `prompt_rsvp = true` (family BBQ, Alumni Game). Two events have `ends_at`, three do not, so a "weekend is over" rule cannot rely on event end times alone.
- 2026 RSVPs today: 63 going, 35 maybe, 32 not this year. People with no row are the implicit "No response" bucket.
- `board_people` filters `p.archived = false`; `board_coaches` does **not**. One archived person exists, so an archived coach can surface publicly today.
- `current_players` is `SELECT DISTINCT person_id, year, division FROM stints WHERE source IN ('roster_import','self','admin')`. It has no year filter and no role filter, so the name is wrong: it means "trusted-source stints", not current players.
- `stints.source` values in use: `esn_alumni_page` (886), `admin` (74), `roster_import` (72), `self` (8). `confirmed_by`/`confirmed_at` exist and are the basis of the "unconfirmed" presentation.
- Contact tips are stored as `suggestions.payload.contact_value` free text; no contact type.
- Chamfer tokens already exist: `src/components/media/chamfer.ts` (`CHAMFER` tiers sm/md/lg/hero) plus `RoundedChamferBox`, mirrored as CSS vars in `src/styles.css`. Everything new reuses these, not new literals.

---

## Phase 1 — Schema and views (independently verifiable, no UI change)

Migrations, all additive and idempotent:

- `app_settings` row `rsvp_editable_until` (ISO timestamp, nullable). The annual card is editable while `now() < COALESCE(setting, derived)`. Derived = latest `events.ends_at` for the edition, else `editions.ends_on` at 23:59:59 America/New_York. Fallback exists because three of five 2026 events have no `ends_at`.
- `events.published boolean not null default true` if absent, so the annual card can list "published/eligible" events without conflating with `is_placeholder`.
- `suggestions` contact tips gain a structured payload shape: `{ contact_type: 'email'|'phone'|'social'|'other', contact_value, context_note }`. Backfill old rows to `contact_type: 'other'`. No new table; tips stay admin-only (private) under existing RLS.
- Recreate `board_coaches` with `p.archived = false` added. This is the one behavioural fix in Phase 1.
- Add `roster_stints` as an alias view of `current_players` with a comment documenting the semantics; keep `current_players` in place so nothing breaks, and migrate call sites in a later phase.
- New reporting views for admin only: `admin_annual_rsvp_rollup` (per edition year: going / maybe / not this year / no response / planned heads) and `admin_event_rsvp_rollup` (per event: yes / no / unanswered / planned heads). Both `security_invoker`, admin-gated by `is_admin()` in the calling server functions.
- No RLS is loosened. Every new view gets explicit GRANTs matching its audience; the two admin rollups are `authenticated` only and gated in code.

Verify: `supabase--linter`, spot-check counts against raw table queries, confirm `/` renders identically.

## Phase 2 — Public "Find Your Year" cleanup

Files: `src/components/board/BoardExperience.tsx`, `NameChip.tsx`, `LabelRow.tsx`, `src/lib/board.functions.ts`, `board-grouping.ts`.

- Search becomes the dominant control at the top; filters demote to a compact row: **Program**, **Profile status**, **Era**, **Sort**.
- Status split becomes explicit, replacing today's single blended list:
  - Profile status: Claimed / Unclaimed / No contact
  - Attendance (2026): Going / Maybe / Not this year / No response
  - In memoriam is its own toggle, never mixed into either group.
- `BoardPerson` gains `profile_state` and `attendance_state` alongside the existing `state` (kept for compatibility during the transition, removed at the end of the phase).
- Secondary legend below the filters; one-line explainer that year placement is the **last playing season**, not graduation.

Verify at desktop and mobile against `/v2` styling; counts in the sticky bar must match Phase 1 rollups.

## Phase 3 — Claim flow

Files: `src/components/claim/ClaimDialog.tsx`, `src/lib/rsvp.server.ts`, `rsvp.functions.ts`, `account.functions.ts`.

Steps become: pick name → verify email → confirm roster facts (program, years, city) → **optional** annual RSVP. RSVP is no longer required to claim. The three-invariant rule still holds in the other direction: answering the RSVP is still the signup, there is still no bare "create account" button.

Missing-person path captures first, last, played-as, program/team, approximate playing years **or** last year, optional graduation year, and email, each with a "Not sure" option, and surfaces duplicate suggestions from the existing fuzzy matcher (`src/lib/fuzzy.ts`, `name-match.ts`) before submitting.

Risk: `submitRsvpServer` currently assumes a status is always present. It gains a claim-only path that writes identity plus roster confirmation with no `rsvps` row.

## Phase 4 — /me rebuild

File: `src/routes/_authenticated/me.tsx` (947 lines today, split into `src/components/me/*`).

- **My alumni profile** (evergreen, top): names, played-as, city, program/division, playing years and stints, email identities with primary selection, privacy and networking preferences.
- **Annual card**, titled from the current edition dynamically: "2026 Alumni Weekend RSVP" now, a new card next year, prior years retained read-only below.
- Card contents: overall status (Going / Maybe / Not this year / No response), overall party size when Going, then every published, eligible event of that edition with its own response and party size.
- Editable until the Phase 1 cutoff; after that the card renders read-only with a short explanation.

## Phase 5 — Three-position response control

New `src/components/events/TriStateAnswer.tsx`, replacing the range-input approach in `EventSubPrompts.tsx` / `EventAnswerToggle.tsx`.

- Positions: left **No** (muted earth neutral), center **No choice** (genuinely distinct unanswered state, never persisted as No), right **Yes** (accessible green, not Pitt Gold — gold stays reserved for attending).
- `role="radiogroup"` with three radios; arrow-key and Home/End support, visible focus ring, `aria-describedby` on the event label, and a polite live region announcing the saved state.
- Animated thumb, disabled under `prefers-reduced-motion`.
- Inline "Saved" / "Couldn't save" feedback next to the control, not a toast.

Verify with keyboard-only and screen-reader passes plus a Playwright run.

## Phase 6 — Admin redesign

Files: `src/routes/_authenticated/admin.tsx`, `src/lib/admin.server.ts`, `src/components/admin/Panels.tsx`, `PeopleTable.tsx`, `ReviewQueue.tsx`.

- **Overview**: going, planned heads, maybe, not this year, no response, claimed, no contact, going-with-missing-event-answers, pending new people, missing placement or profile fields, bounced or suppressed contacts. Each tile links to a filtered queue.
- **Per-event totals**: yes / no / unanswered / planned heads, from the Phase 1 rollup view.
- **Person detail** splits into Profile, Contact, Roster, Annual RSVP, Events — mirroring the same three-layer model as `/me`.
- Missing-person review shows the structured fields and duplicate candidates side by side.
- CSV export stays admin-only and gains the annual and per-event columns.
- Provenance stays: `stints.source` and `confirmed_by`/`confirmed_at` remain visible in admin, but the misleading public-facing "unconfirmed" treatment is removed.

## Phase 7 — Visual and cleanup pass

- Every new surface uses `/v2` typography and palette, original photo colors, and `RoundedChamferBox` / `RoundedChamferPhoto` with `CHAMFER` tiers for all angled images and decorative shapes. No plain rectangles for chamfered elements, no razor-sharp vertices, no new hard-coded notch/radius pairs.
- Migrate remaining `current_players` call sites to `roster_stints`.
- Update `PROJECT_STATE.md`.

---

## Safety, sequencing, acceptance

- Phases 1, 2, 5 and 7 are independently verifiable and can ship alone. Phase 4 depends on 1; Phase 6 depends on 1 and 3.
- Rollback: every migration is additive, so rollback is a UI revert. The one exception is the `board_coaches` recreate, which is reversible by re-running the prior definition.
- No destructive SQL: no drops of `people`, `stints`, `rsvps`, `identities`, `event_rsvps`; no edits to existing RSVP rows.

Acceptance criteria:

- Public: board renders for a logged-out visitor, filters split into profile vs. attendance, no email is exposed in any public payload, archived coaches absent.
- Authenticated: a member can claim without an RSVP; `/me` shows the evergreen profile plus a 2026 card and any prior-year cards read-only.
- Historical: 2026 counts equal 63 / 35 / 32 before and after every phase; no `rsvps` row's `responded_at` changes.
- Admin: every overview tile's number reconciles with a direct table query; CSV opens with the new columns.
- RLS: linter clean of anything newly introduced; anonymous queries against `event_rsvps`, `identities`, `suggestions` and the two admin rollups all return zero rows.

## Open question

Cutoff default: I plan to derive from the latest event `ends_at`, falling back to `editions.ends_on` at 23:59:59 Eastern, with `rsvp_editable_until` as an admin override. Say the word if you would rather the card stay editable for a grace period after the weekend.
