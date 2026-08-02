CREATE OR REPLACE VIEW public.board_coaches
WITH (security_invoker = off) AS
SELECT p.id,
       p.first_name,
       p.last_name,
       p.played_as,
       p.deceased,
       CASE
         WHEN p.deceased THEN 'memorial'::text
         WHEN r.status = 'going'::text THEN 'going'::text
         WHEN r.status = 'maybe'::text THEN 'maybe'::text
         WHEN (EXISTS (SELECT 1 FROM identities i WHERE i.person_id = p.id AND i.verified_at IS NOT NULL)) THEN 'claimed'::text
         ELSE 'unclaimed'::text
       END AS state
FROM people p
LEFT JOIN person_board_placement pbp ON pbp.person_id = p.id
LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (SELECT e.event_year FROM editions e WHERE e.is_current LIMIT 1)
WHERE p.show_on_board = true
  AND (pbp.person_id IS NULL OR pbp.board_year IS NULL)
  AND EXISTS (SELECT 1 FROM stints s WHERE s.person_id = p.id)
  AND NOT EXISTS (SELECT 1 FROM stints s WHERE s.person_id = p.id AND s.role <> 'coach'::text);

REVOKE ALL ON public.board_coaches FROM anon, authenticated;
GRANT SELECT (id, first_name, last_name, played_as, deceased, state) ON public.board_coaches TO anon, authenticated;