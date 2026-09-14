---
name: Campaign send safety rules
description: Claim-before-send, seven-per-edition cap, 10-day cooldown, one-mailbox-one-copy, and the no-unpaginated-sends-read rule after the Sept 2026 duplicate email incident
type: feature
---

Every automated campaign email must reserve its recipient in the database
before the provider is called: `claim_campaign_send(...)` inserts a `claimed`
row on `public.sends`, and `finalize_campaign_send(...)` completes that same
row. Never insert a second send row for a claimed recipient, and never report a
delivery as sent when its ledger write failed.

Limits, all enforced in SQL as well as in code:
- Maximum **seven** automated campaign emails per person per edition
  (`sends.event_year`). Magic links and RSVP confirmations are transactional
  and never count.
- 10-day quiet period between campaign emails to one person. Only an explicitly
  approved dated campaign may skip it.
- One mailbox receives one copy per campaign (unique index on sequence +
  normalized address).

Never read `public.sends` (or any growing table) with a single unpaginated
select — PostgREST stops at 1,000 rows and a short read reads as "never
emailed". Use `fetchAllRows` from `src/lib/campaign-guards.ts`, which throws on
a failed page.

A due sequence runs only within two days of its target date; it is not
reconsidered every day forever.
