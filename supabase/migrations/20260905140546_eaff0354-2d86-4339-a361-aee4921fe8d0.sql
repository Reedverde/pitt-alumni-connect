
-- The newest roster season present in the data. New roster imports move it forward
-- on their own; nothing needs editing each year.
CREATE OR REPLACE FUNCTION public.current_roster_year()
RETURNS integer
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$ SELECT max(year) FROM public.stints $$;

REVOKE EXECUTE ON FUNCTION public.current_roster_year() FROM PUBLIC, anon, authenticated;

-- The single definition of "current", used by the board, profiles and organizer reports.
CREATE OR REPLACE VIEW public.current_people AS
  SELECT DISTINCT s.person_id
  FROM public.stints s
  WHERE s.year = public.current_roster_year()
  UNION
  SELECT DISTINCT i.person_id
  FROM public.identities i
  WHERE lower(i.email) LIKE '%@pitt.edu'
    AND EXISTS (
      SELECT 1 FROM public.sends sn
      WHERE lower(sn.to_email) = lower(i.email)
        AND sn.provider_message_id IS NOT NULL
        AND sn.status = 'sent'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.suppressions su WHERE su.email = lower(btrim(i.email))
    );

REVOKE ALL ON public.current_people FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.current_people TO service_role;

CREATE OR REPLACE VIEW public.board_people AS
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
           FROM public.current_people cp
          WHERE cp.person_id = p.id)) AS is_current,
    (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id)) AND NOT (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id AND s.role <> 'coach'::text)) AS is_coach,
    COALESCE(( SELECT array_agg(DISTINCT s.division) AS array_agg
           FROM stints s
          WHERE s.person_id = p.id AND s.division IS NOT NULL), ARRAY( SELECT DISTINCT d.d
           FROM unnest(ARRAY[p.seed_division, p.seed_division_alt]) d(d)
          WHERE d.d IS NOT NULL), ARRAY[]::text[]) AS divisions,
    (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id AND (s.role = ANY (ARRAY['coach'::text, 'manager'::text])))) AS has_coached,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM stints s
              WHERE s.person_id = p.id AND s.role = 'coach'::text)) THEN 'coach'::text
            WHEN (EXISTS ( SELECT 1
               FROM stints s
              WHERE s.person_id = p.id AND s.role = 'manager'::text)) THEN 'manager'::text
            ELSE NULL::text
        END AS coach_role,
    COALESCE(pr.has_deliverable_email, false) AS has_contact
   FROM people p
     JOIN person_board_placement pbp ON pbp.person_id = p.id
     LEFT JOIN person_reachability pr ON pr.person_id = p.id
     LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1))
     LEFT JOIN team_names tn ON tn.division = pbp.board_division AND pbp.board_year >= COALESCE(tn.start_year, '-2147483648'::integer) AND pbp.board_year <= COALESCE(tn.end_year, 2147483647)
  WHERE p.archived = false AND p.show_on_board = true AND pbp.board_year IS NOT NULL AND (pbp.board_division IS NULL OR (EXISTS ( SELECT 1
           FROM divisions d
          WHERE d.code = pbp.board_division AND d.visible = true)));

COMMENT ON VIEW public.current_people IS
  'The single definition of a current Pitt player or coach: any stint in current_roster_year(), or a working @pitt.edu identity (a delivered send with a provider message id, not suppressed). identities.verified_at is never used here; it remains proof of inbox authentication.';
