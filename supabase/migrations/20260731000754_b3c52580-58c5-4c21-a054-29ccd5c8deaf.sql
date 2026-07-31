-- Board placement is about the cohort that recognises a name, which is the
-- years someone played. An alum who comes back to coach must not be dragged
-- out of their class row and into the current year.
CREATE OR REPLACE VIEW public.person_board_placement AS
 SELECT id AS person_id,
    COALESCE(( SELECT max(s.year) AS max
           FROM stints s
          WHERE (s.person_id = p.id AND s.role = ANY (ARRAY['player'::text, 'captain'::text]))), grad_year) AS board_year,
    COALESCE(( WITH s AS (
                 SELECT st.year,
                    regexp_replace(st.division, '_[AB]$'::text, ''::text) AS track,
                    "right"(st.division, 1) AS lvl,
                    st.division
                   FROM stints st
                  WHERE (st.person_id = p.id AND st.role = ANY (ARRAY['player'::text, 'captain'::text]))
                ), latest AS (
                 SELECT s.track,
                    s.division
                   FROM s
                  ORDER BY s.year DESC, s.division
                 LIMIT 1
                )
         SELECT
                CASE
                    WHEN (( SELECT latest.division
                       FROM latest) !~ '_[AB]$'::text) THEN ( SELECT latest.division
                       FROM latest)
                    ELSE ((( SELECT latest.track
                       FROM latest) || '_'::text) ||
                    CASE
                        WHEN (( SELECT count(DISTINCT s.year) AS count
                           FROM s
                          WHERE ((s.track = ( SELECT latest.track
                                   FROM latest)) AND (s.lvl = 'A'::text))) >= ( SELECT count(DISTINCT s.year) AS count
                           FROM s
                          WHERE ((s.track = ( SELECT latest.track
                                   FROM latest)) AND (s.lvl = 'B'::text)))) THEN 'A'::text
                        WHEN (( SELECT s.lvl
                           FROM s
                          WHERE (s.track = ( SELECT latest.track
                                   FROM latest))
                          ORDER BY s.year DESC, s.lvl
                         LIMIT 1) = 'A'::text) THEN 'A'::text
                        ELSE 'B'::text
                    END)
                END AS "case"), seed_division) AS board_division,
    ( SELECT count(*) AS count
           FROM stints s
          WHERE (s.person_id = p.id)) AS stint_count
   FROM people p;

ALTER VIEW public.person_board_placement SET (security_invoker = on);

-- The cuts protection, now enforced for every caller including the service
-- role, and narrowed to the roles it was always about. A sitting coach is not
-- a cut risk; a listed current-season player who then gets cut is.
CREATE OR REPLACE FUNCTION public.block_current_season_playing_stint()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.role IN ('player', 'captain')
     AND NEW.year = EXTRACT(year FROM now())::integer THEN
    RAISE EXCEPTION 'Current-season playing stints cannot be recorded.';
  END IF;
  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.block_current_season_playing_stint() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS block_current_season_playing_stint ON public.stints;
CREATE TRIGGER block_current_season_playing_stint
  BEFORE INSERT OR UPDATE ON public.stints
  FOR EACH ROW EXECUTE FUNCTION public.block_current_season_playing_stint();

-- Members still may not touch any current-season row themselves; non-playing
-- current-season roles are admin entered only.
