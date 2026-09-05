---
name: Automation timing and send authorization
description: Exact 9:00 America/New_York launch minute for News and scheduled email, DST-safe cron, missed-never-late, scoped per-campaign send permission
type: feature
---

## The launch minute

Anything automatic that is scheduled for 9:00 launches inside the 9:00 minute in
America/New_York and in no other minute. Seconds within that minute and ordinary
network latency are fine, and work claimed in that minute may finish afterwards.
A later minute is a later decision, and the machine does not make it: 9:01, 9:15,
9:30 and 10:00 are all "missed".

- Before the minute: nothing happens, nothing is recorded.
- In the minute: the run claims the day and proceeds.
- After the minute: the slot is recorded as missed and stays unsent/unposted.
  There is no grace period, no window and no catch-up. Only an organizer can act.

Code: `windowVerdict` in `src/lib/news.server.ts` (local HH:MM equality),
`launchVerdict` in `src/lib/launch-window.ts` (same-minute instant comparison,
0 to 59.999 seconds after the approved moment).

## DST-safe scheduling

Cron is UTC, so the News job runs `0 13,14 * * *`. One of those two is 9:00
Eastern year round; the other is 8:00 (turned away as early) or 10:00 (missed,
and only if the 9:00 run never claimed the day). Never poll every fifteen
minutes to find the hour.

## Scoped send authorization

The global `app_settings.outbound_email_mode` is read, never written, by
automation. An approved campaign carries a `ScopedSendAuthorization { kind,
reason }` into `sendPlainEmail`; the mail choke point honours it for that one
campaign kind, for the length of that one dispatch. No other request can ever
observe a moment of unrestricted sending.

## T-10 email (2026)
The September 22 (T-10) message is the event RSVP reminder (`event_rsvp_prompt`, offset -10, audience going); `t_minus_10_headcount` is disabled but kept. Timing is always `editions.starts_on + offset_days`, never a hardcoded date.
The September 22, 2026 send uses its own key `event_rsvp_prompt_t10_2026_09_22`; `event_rsvp_prompt` (sent Sept 4) and `t_minus_10_headcount` stay inactive. A reused campaign key is suppressed by its own already-sent rule, so a repeat send always needs a new key, never a relaxed cooldown.
