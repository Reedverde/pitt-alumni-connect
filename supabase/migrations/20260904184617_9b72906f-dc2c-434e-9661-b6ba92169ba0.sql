ALTER TABLE public.sequences
  ADD COLUMN IF NOT EXISTS scheduled_at timestamptz,
  ADD COLUMN IF NOT EXISTS dispatched_at timestamptz,
  ADD COLUMN IF NOT EXISTS cancelled_at timestamptz,
  ADD COLUMN IF NOT EXISTS one_time boolean NOT NULL DEFAULT false;

INSERT INTO public.sequences (key, offset_days, audience_states, active, anchors_only, scheduled_at, one_time)
VALUES (
  'rsvp_confirm_2026_09_04',
  -28,
  ARRAY['unclaimed','claimed'],
  false,
  false,
  timestamptz '2026-09-04 18:00:00 America/New_York',
  true
)
ON CONFLICT (key) DO UPDATE
  SET audience_states = EXCLUDED.audience_states,
      scheduled_at = EXCLUDED.scheduled_at,
      one_time = true,
      cancelled_at = NULL;