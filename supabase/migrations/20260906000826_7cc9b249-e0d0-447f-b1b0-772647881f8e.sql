CREATE OR REPLACE VIEW public.current_people AS
SELECT c.person_id
FROM (
  SELECT DISTINCT s.person_id
  FROM public.stints s
  WHERE s.year = (SELECT max(stints.year) FROM public.stints)
) c
WHERE NOT EXISTS (
  SELECT 1 FROM public.current_status_overrides o
  WHERE o.person_id = c.person_id AND o.is_current = false
);