---
name: Email program permanent rule
description: No daily drip or catch-up; only dated one-time campaigns and person-initiated sign-in links; RSVP confirmations retired; transactional_only is permanent
type: constraint
---
Permanent as of 2026-09-14 (Reed):

- No rolling daily drip, no automatic catch-up, no past-due sequence reconsideration. The `drip-daily` cron is disabled (row kept for history) and the hook fails closed.
- Only two outbound paths: an explicitly dated one-time campaign approved in `sequences`, and a sign-in/access link the person requested.
- Automatic RSVP confirmation email is retired. Never re-add it.
- `outbound_email_mode` stays `transactional_only` permanently. Never instruct anyone to set `drip_enabled`.
- A campaign sends in its approved minute or is marked missed and never sent late.
- Remaining 2026 campaigns (9:00 a.m. ET): t_minus_14 09-18, event_rsvp_prompt_t10_2026_09_22 09-22, t_minus_7 09-25, locked_schedule_2026_09_30 09-30, t_plus_3 10-05. Completed: t_minus_45, t_minus_21. Seven per edition is the maximum.
- Still required: cap serialization (per-person/edition advisory lock), 10-day quiet period, suppression/bounce/complaint, memorial exclusion, mailbox dedupe, claim-before-send.

**Why:** repeat sends in September 2026 came from daily reconsideration; dated approval is now the only authorization.
