CREATE TABLE public.editions (
  event_year int PRIMARY KEY,
  title text NOT NULL,
  starts_on date NOT NULL,
  ends_on date NOT NULL,
  is_current boolean NOT NULL DEFAULT false,
  published boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.editions TO anon, authenticated;
GRANT ALL ON public.editions TO service_role;

ALTER TABLE public.editions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Published editions are public"
ON public.editions FOR SELECT
TO anon, authenticated
USING (published = true);

CREATE UNIQUE INDEX editions_one_current ON public.editions (is_current) WHERE is_current;

INSERT INTO public.editions (event_year, title, starts_on, ends_on, is_current, published)
VALUES (2026, 'Alumni Weekend 2026', DATE '2026-10-02', DATE '2026-10-04', true, true);

CREATE OR REPLACE FUNCTION public.editions_single_current()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_current THEN
    UPDATE public.editions SET is_current = false
    WHERE is_current AND event_year <> NEW.event_year;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER editions_single_current_trg
BEFORE INSERT OR UPDATE OF is_current ON public.editions
FOR EACH ROW WHEN (NEW.is_current) EXECUTE FUNCTION public.editions_single_current();

CREATE OR REPLACE FUNCTION public.current_edition_year()
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT event_year FROM public.editions WHERE is_current LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.current_edition_year() TO anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.set_current_edition(_event_year int)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.editions SET is_current = false WHERE is_current AND event_year <> _event_year;
  UPDATE public.editions SET is_current = true WHERE event_year = _event_year;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'No edition for year %', _event_year;
  END IF;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.set_current_edition(int) FROM anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_current_edition(int) TO service_role;

INSERT INTO public.editions (event_year, title, starts_on, ends_on, is_current, published)
SELECT DISTINCT e.event_year,
       'Alumni Weekend ' || e.event_year,
       make_date(e.event_year, 10, 1),
       make_date(e.event_year, 10, 3),
       false, false
FROM public.events e
WHERE NOT EXISTS (SELECT 1 FROM public.editions ed WHERE ed.event_year = e.event_year);

INSERT INTO public.editions (event_year, title, starts_on, ends_on, is_current, published)
SELECT DISTINCT r.event_year,
       'Alumni Weekend ' || r.event_year,
       make_date(r.event_year, 10, 1),
       make_date(r.event_year, 10, 3),
       false, false
FROM public.rsvps r
WHERE NOT EXISTS (SELECT 1 FROM public.editions ed WHERE ed.event_year = r.event_year);

ALTER TABLE public.events
  ADD CONSTRAINT events_event_year_fkey FOREIGN KEY (event_year) REFERENCES public.editions(event_year) ON UPDATE CASCADE;

ALTER TABLE public.rsvps
  ADD CONSTRAINT rsvps_event_year_fkey FOREIGN KEY (event_year) REFERENCES public.editions(event_year) ON UPDATE CASCADE;

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
     LEFT JOIN public.rsvps r ON (((r.person_id = p.id) AND (r.event_year = public.current_edition_year()))))
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