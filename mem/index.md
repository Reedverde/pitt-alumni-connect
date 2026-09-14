# Project Memory

## Core
Automatic launches happen in the 9:00 AM America/New_York minute only — never 9:15, 9:30 or 10:00, and never a later catch-up.
A missed automatic run is recorded and left undone; only a human may send or post it afterwards.
Never temporarily write a global "send everything" email mode; authorize one campaign at a time, scoped to its kind.
Website/Data work never changes email schedules, audiences, copy or sending.
A campaign recipient is claimed in the database before the provider is called; never read the sends table unpaginated.

## Memories
- [Automation timing rules](mem://features/automation-timing) — exact 9:00 launch minute, DST-safe cron, missed-not-late, scoped send authorization; T-10 = event RSVP reminder, headcount sequence disabled
- [Campaign send safety rules](mem://features/campaign-send-safety) — claim before send, 7 per edition cap, 10-day cooldown, one mailbox one copy, paginated history reads
- [Email program rule](mem://features/email-program-rule.md) — no daily drip or catch-up, dated one-time campaigns only, RSVP confirmations retired, transactional_only permanent
