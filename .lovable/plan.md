# Per event RSVPs, drip hookup, and four cleanups

## What I verified first

- Current edition 2026 starts_on = 2026-10-02, is_current = true.
- Stray rows you suspected both exist: `app_settings.event_start_date = 2026-10-02` and `sequences.event_rsvp_prompt` (offset_days -25, audience going, active = false).
- Both stale event rows still exist ("Sabah alumni game" MENS_A, "Pressure and BITT alumni game" MENS_B). A single combined "Alumni Game" event and a "Whole-program family BBQ" event also exist. No foreign key in the database points at `events` at all, so nothing can reference them.
- `rsvps.src` values in use: 39 text, 31 email, 13 discord, 2 facebook, 1 groupme_a, 0 groupme_b, 44 null. So the GroupMe backfill touches exactly one row.
- Admins table has 6 rows. The copy lives in `src/routes/_authenticated/admin.tsx` line 114: "Three people share this page. Every write is logged with your name."
- `rsvps` row level security already scopes reads to `person_id = current_person_id() OR is_admin()`. There is no broader alumni read policy on that table.

## 1. New table `event_rsvps`

Touches: one migration, plus later reads in `src/lib/admin.server.ts` and the person panel in the admin People tab.

Shape as you specified: person_id, event_id referencing events, status yes/no, party_size default 1, responded_at, unique(person_id, event_id), created_at/updated_at with a touch trigger. Grants to authenticated and service_role, RLS on, policies: owner may insert and update own rows through `current_person_id()`, owner and admin may read, admin may manage.

One design note: the event_id foreign key will be the first FK pointing at `events`. That means deleting an event later becomes blocked unless we choose ON DELETE CASCADE. I would use CASCADE, since an event RSVP has no meaning without its event. This is exactly why item 3 (deleting the stale rows) should run before or inside the same migration.

Ambiguity to confirm: whether party_size on an event RSVP is independent of the weekend party_size, or should default from it. I will treat it as independent and default 1.

## 2. Gating and the drip hookup

Inline: in the existing claim/RSVP flow, when the submitted status is `going`, show BBQ and Alumni Game sub prompts after the answer is recorded. `maybe` and `not_this_year` never see them. This is a UI plus one small server function to write event_rsvps rows.

Drip: the cleanest hook is the mechanism already in place, no new date field. `src/lib/drip-cron.server.ts` computes target dates from `editions.starts_on` of the current edition plus `sequences.offset_days`, so an annually repeating prompt just needs a sequence row with a negative offset. Concretely:

- Reuse the existing `event_rsvp_prompt` sequence row rather than creating another one. Keep offset_days at -25 (that is 2026-09-07 for this edition) or move it, your call; the value is an offset, not a hardcoded date, so it self adjusts each year.
- Add a builder in `src/lib/mail.server.ts` and map `event_rsvp_prompt` to it in `src/lib/drip.server.ts`, same pattern as the other keys.
- Audience is already `{going}`. On top of that, the recipient list for this one sequence needs a per event filter: exclude anyone who already has an `event_rsvps` row for the event in question, whatever their answer. That is a narrow extra filter inside `resolveAudience` keyed on the sequence, not a change to the shared guardrails.
- Delete the stray `app_settings.event_start_date` row so there is only one source of truth. Nothing in the repo reads that key.

Risk worth naming: the existing global throttle skips anyone who received any sequence send in the last 7 days. At offset -25 this prompt sits between t_minus_28 and t_minus_21, so a person mailed at -28 is throttled out at -25. Either move the offset (for example -24 or -18 to clear both) or accept that some people only get the drip prompt on a later pass. I would move the offset rather than weaken the throttle.

## 3. Delete the two stale events

Safe: no FK anywhere points at `events`, and I confirmed both rows are the superseded division split pair. One migration statement, deleting by the two ids, guarded to only delete if they are still placeholders. Bundle with item 1 so the new FK is created against a clean table.

## 4. Collapse groupme_a and groupme_b into groupme

Touches: the `rsvps_src_check` constraint, one data row, and `src/lib/rsvp-src.ts`.

Order matters: backfill the single `groupme_a` row to `groupme` first, then replace the constraint. Backfill, not null, since the row carries real attribution.

Note: the current constraint already permits `groupme`, plus retired values `groupme_alumni`, `groupme_all`, `website`. I would keep the retired values allowed (historical rows exist elsewhere in principle) and just remove `groupme_a` and `groupme_b` from the allowed list.

UI flagged, not fixed, as you asked. The only place that mentions them is `src/lib/rsvp-src.ts`: the `RSVP_SOURCES` array (lines 9 to 10) and the `RSVP_SOURCE_LABELS` map (lines 26 to 27, "GroupMe (A side)" / "GroupMe (B side)"). Nothing else in `src/` generates or renders a groupme_a or groupme_b link; `/qr` uses `src=qr` only, and no QR or share link exists for GroupMe. So the change is: add `groupme` to the sources array, drop the two split entries, and relabel the retired `groupme` key to plain "GroupMe".

## 5. party_size exposure

This one does not need a fix. The security note in PROJECT_STATE.md is out of date. The live select policy on `rsvps` is `person_id = current_person_id() OR is_admin()`, so a signed in alumnus cannot read any other person's row at all, party_size included. There is no separate broad read policy.

So: no `admin_rsvp_detail` change, no column grant change. Column grants could not have fixed it anyway; grants are per role, not per row, so they cannot distinguish owner from other alumni. What I would do instead is correct the stale line in PROJECT_STATE.md. If you have a specific screen where you saw someone else's party size, tell me which one and I will trace that path, since it would then be a view or a server function leaking, not the table.

## 6. Admin copy

`src/routes/_authenticated/admin.tsx`, line 114. Reported only, not changed. It should read six, and the related PROJECT_STATE.md lines 140 and 146 say "three admins" too.

## Migration bundling

Three migrations rather than five:

1. Cleanup and schema: delete the two stale events, delete the stray `app_settings.event_start_date`, create `event_rsvps` with grants, RLS, policies, and the updated_at trigger.
2. Source consolidation: backfill the groupme_a row, then swap the `rsvps_src_check` constraint.
3. Sequence adjustment: point `event_rsvp_prompt` at its final offset (leave it inactive).

Keeping 2 separate from 1 means a constraint failure cannot roll back the new table. Item 5 needs no migration and item 6 needs no query.

## Code changes after the migrations

- `src/lib/rsvp-src.ts`: source list and labels.
- `src/lib/mail.server.ts`: event prompt builder and subject.
- `src/lib/drip.server.ts`: key to builder mapping plus the per event exclusion filter.
- Claim flow components plus a new server function for inline BBQ and Alumni Game answers.
- Admin People tab person panel: show each person's event answers joined from `event_rsvps`.
- `PROJECT_STATE.md`: correct the party_size note, record the GroupMe consolidation as done, record the event RSVP mechanism.

Nothing here activates a sequence, changes `outbound_email_mode`, or sends mail.
