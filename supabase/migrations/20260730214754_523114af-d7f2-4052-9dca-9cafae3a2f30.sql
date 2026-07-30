ALTER TABLE public.rsvps
  ADD COLUMN party_size integer NOT NULL DEFAULT 1;

ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_party_size_range CHECK (party_size BETWEEN 1 AND 12);

INSERT INTO public.sequences (key, offset_days, audience_states, active, anchors_only)
VALUES ('t_minus_10_headcount', -10, ARRAY['going'], false, false)
ON CONFLICT (key) DO NOTHING;