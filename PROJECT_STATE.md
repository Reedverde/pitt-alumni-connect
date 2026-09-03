

## 2026-09-03 Correction: hotel and GroupMe status re-confirmed

No code changed in this pass. Two facts were re-verified against this file after being misstated in conversation:

- The hotel (Hilton Garden Inn Pittsburgh University Place) has been named, shipped to HotelBlock and editions.lodging_note, and live since 2026-08-07. It should never again be treated as an open item.
- GroupMe is a single shared platform link per current instruction, not two separate links. The groupme_a/groupme_b values in this file predate that decision and are marked superseded above; the actual rsvps.src constraint and UI labels still need a follow-up migration to collapse to one `groupme` value, this has not been done yet.

Also noted: app_settings has no event_start_date key. The real mechanism for computing T-minus offsets is editions.starts_on on the current edition row, read by the drip cron (see DRIP DAILY CRON section above). A row was added to app_settings today with key event_start_date value 2026-10-02 and a sequences row event_rsvp_prompt at offset_days -25, outside of this repo's actual dispatch mechanism. These may be redundant or dead relative to editions.starts_on and should be reviewed against the real schema before being relied on, rather than assumed live.
