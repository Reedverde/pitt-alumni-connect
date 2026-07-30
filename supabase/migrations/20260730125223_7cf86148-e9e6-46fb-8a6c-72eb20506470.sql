ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_placeholder boolean NOT NULL DEFAULT false;

INSERT INTO public.events (event_year, title, day_number, division, location, notes, time_tbd, starts_at, sort_order, is_placeholder)
SELECT e.event_year, v.title, 1, v.division, NULL, 'Each program plans its own Friday. Details to come.', true, NULL, 10, true
FROM public.editions e
CROSS JOIN (VALUES
  ('Sabah alumni meetup', 'MENS_A'),
  ('Pressure and BITT alumni meetup', 'MENS_B')
) AS v(title, division)
WHERE e.is_current = true
  AND NOT EXISTS (
    SELECT 1 FROM public.events x
    WHERE x.event_year = e.event_year AND x.day_number = 1 AND x.division = v.division
  );