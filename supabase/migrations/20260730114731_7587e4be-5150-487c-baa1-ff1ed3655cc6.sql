ALTER TABLE public.divisions ADD COLUMN IF NOT EXISTS visible boolean NOT NULL DEFAULT true;

UPDATE public.divisions SET visible = false WHERE code IN ('WOMENS_A','WOMENS_B');

DROP VIEW IF EXISTS public.board_year_counts;
DROP VIEW IF EXISTS public.board_people;

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
            WHEN (r.status = 'going'::text) THEN 'going'::text
            WHEN (r.status = 'maybe'::text) THEN 'maybe'::text
            WHEN (EXISTS ( SELECT 1
               FROM identities i
              WHERE ((i.person_id = p.id) AND (i.verified_at IS NOT NULL)))) THEN 'claimed'::text
            ELSE 'unclaimed'::text
        END AS state
   FROM (((public.people p
     JOIN public.person_board_placement pbp ON ((pbp.person_id = p.id)))
     LEFT JOIN public.rsvps r ON (((r.person_id = p.id) AND (r.event_year = 2026))))
     LEFT JOIN public.team_names tn ON (((tn.division = pbp.board_division) AND ((pbp.board_year >= COALESCE(tn.start_year, '-2147483648'::integer)) AND (pbp.board_year <= COALESCE(tn.end_year, 2147483647))))))
  WHERE p.show_on_board = true
    AND pbp.board_year IS NOT NULL
    AND (pbp.board_division IS NULL OR EXISTS (
      SELECT 1 FROM public.divisions d
      WHERE d.code = pbp.board_division AND d.visible = true));

CREATE VIEW public.board_year_counts
WITH (security_invoker = off) AS
SELECT board_year,
    (count(*))::integer AS total,
    (count(*) FILTER (WHERE (state = ANY (ARRAY['claimed'::text, 'going'::text, 'maybe'::text]))))::integer AS claimed,
    (count(*) FILTER (WHERE (state = 'going'::text)))::integer AS going
   FROM public.board_people
  GROUP BY board_year;

GRANT SELECT ON public.board_people TO anon, authenticated;
GRANT SELECT ON public.board_year_counts TO anon, authenticated;
GRANT ALL ON public.board_people TO service_role;
GRANT ALL ON public.board_year_counts TO service_role;