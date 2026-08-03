DROP VIEW IF EXISTS public.board_people CASCADE;

CREATE VIEW public.board_people
WITH (security_invoker = off) AS
SELECT p.id,
    p.first_name,
    p.last_name,
    p.played_as,
    p.deceased,
    pbp.board_year,
    pbp.board_division,
    tn.name AS team_label,
        CASE
            WHEN p.deceased THEN 'memorial'::text
            WHEN r.status = 'going'::text THEN 'going'::text
            WHEN r.status = 'maybe'::text THEN 'maybe'::text
            WHEN (EXISTS ( SELECT 1
               FROM identities i
              WHERE i.person_id = p.id AND i.verified_at IS NOT NULL)) THEN 'claimed'::text
            ELSE 'unclaimed'::text
        END AS state,
    (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id AND (s.role = ANY (ARRAY['player'::text, 'captain'::text])) AND s.year = EXTRACT(year FROM (now() AT TIME ZONE 'America/New_York'::text))::integer)) AS is_current,
    (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id)) AND NOT (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id AND s.role <> 'coach'::text)) AS is_coach,
    COALESCE(
      (SELECT array_agg(DISTINCT s.division)
         FROM stints s
        WHERE s.person_id = p.id AND s.division IS NOT NULL),
      ARRAY(SELECT DISTINCT d FROM unnest(ARRAY[p.seed_division, p.seed_division_alt]) AS d WHERE d IS NOT NULL),
      ARRAY[]::text[]
    ) AS divisions
   FROM people p
     JOIN person_board_placement pbp ON pbp.person_id = p.id
     LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1))
     LEFT JOIN team_names tn ON tn.division = pbp.board_division AND pbp.board_year >= COALESCE(tn.start_year, '-2147483648'::integer) AND pbp.board_year <= COALESCE(tn.end_year, 2147483647)
  WHERE p.show_on_board = true AND pbp.board_year IS NOT NULL AND (pbp.board_division IS NULL OR (EXISTS ( SELECT 1
           FROM divisions d
          WHERE d.code = pbp.board_division AND d.visible = true)));

CREATE VIEW public.board_year_counts
WITH (security_invoker = off) AS
SELECT board_year,
    count(*)::integer AS total,
    count(*) FILTER (WHERE state = ANY (ARRAY['claimed'::text, 'going'::text, 'maybe'::text]))::integer AS claimed,
    count(*) FILTER (WHERE state = 'going'::text)::integer AS going
   FROM public.board_people
  GROUP BY board_year;

GRANT SELECT ON public.board_people TO anon, authenticated;
GRANT ALL ON public.board_people TO service_role;
GRANT SELECT ON public.board_year_counts TO anon, authenticated;
GRANT ALL ON public.board_year_counts TO service_role;