---
name: Current-roster classification rule
description: How "Current" is derived (2027 stint only), the alumni overrides, and the removed Pitt-email heuristic
type: feature
---
"Current" = the person has a real stint in the newest roster year in `stints` (currently 2027), in any role: player, captain, coach or manager. Single source of truth: the `public.current_people` view, read by `board_people.is_current` and organizer reporting.

Exclusions: anyone with `current_status_overrides.is_current = false` (Morey Averill, Adam Ricci, Jake Sperry, Peter Kotz — Reed direct confirmation 2026-09-05).

Removed 2026-09-06 (Reed's confirmation): the working-`@pitt.edu` branch. A deliverable Pitt address is contactability evidence only and never makes someone Current. Never create playing stints from email evidence.

People stay placed under their latest recorded playing season; a 2027 coach stint can make someone Current while they remain under 2026/2025 for playing history (Tyler Weinberger, Will Litchholt), and they also appear in Coaches and Managers.

Constraint: `block_current_season_playing_stint` requires `source = 'roster_import'` for playing stints in the current calendar year.
