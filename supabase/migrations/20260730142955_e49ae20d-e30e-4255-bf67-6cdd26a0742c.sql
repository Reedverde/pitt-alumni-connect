CREATE OR REPLACE VIEW public.person_board_placement AS
SELECT
  p.id AS person_id,
  COALESCE((SELECT max(s.year) FROM public.stints s WHERE s.person_id = p.id), p.grad_year) AS board_year,
  COALESCE(
    (
      -- A-over-B rule, resolved within the person's latest track.
      -- A wins on ties or when the most recent year in the track is A;
      -- B wins only with strictly more B years AND a final year on B.
      WITH s AS (
        SELECT st.year,
               regexp_replace(st.division, '_[AB]$', '') AS track,
               right(st.division, 1) AS lvl,
               st.division
        FROM public.stints st
        WHERE st.person_id = p.id
      ),
      latest AS (
        SELECT track, division FROM s ORDER BY year DESC, division LIMIT 1
      )
      SELECT CASE
        WHEN (SELECT division FROM latest) !~ '_[AB]$'
          THEN (SELECT division FROM latest)
        ELSE (SELECT track FROM latest) || '_' || CASE
          WHEN (SELECT count(DISTINCT s.year) FROM s WHERE s.track = (SELECT track FROM latest) AND s.lvl = 'A')
               >= (SELECT count(DISTINCT s.year) FROM s WHERE s.track = (SELECT track FROM latest) AND s.lvl = 'B')
            THEN 'A'
          WHEN (SELECT s.lvl FROM s WHERE s.track = (SELECT track FROM latest) ORDER BY s.year DESC, s.lvl LIMIT 1) = 'A'
            THEN 'A'
          ELSE 'B'
        END
      END
    ),
    p.seed_division
  ) AS board_division,
  (SELECT count(*) FROM public.stints s WHERE s.person_id = p.id) AS stint_count
FROM public.people p;