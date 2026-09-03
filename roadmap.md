# Roadmap

## Per event RSVPs pass (2026-09-03)

- [ ] Migration 1: delete two stale placeholder events, delete stray app_settings.event_start_date, create event_rsvps (grants, RLS, trigger)
- [ ] Migration 2: backfill rsvps.src groupme_a -> groupme, replace rsvps_src_check with text/email/discord/groupme/facebook/instagram/x/esn/qr only
- [ ] Migration 3: set sequences.event_rsvp_prompt offset_days = -24 (stays inactive)
- [ ] src/lib/rsvp-src.ts: single groupme source, drop retired labels
- [ ] src/lib/mail.server.ts: event RSVP prompt builder + subject
- [ ] src/lib/drip.server.ts: map event_rsvp_prompt, per event exclusion filter
- [ ] Inline BBQ / Alumni Game sub prompts in claim flow + server function
- [ ] Admin People tab: show event answers joined from event_rsvps
- [ ] PROJECT_STATE.md: party_size note correction, GroupMe consolidation done, event RSVP mechanism, admin count
- [ ] src/routes/_authenticated/admin.tsx line 114: three -> six people
- [ ] Verify outbound_email_mode and sequence active flags untouched
