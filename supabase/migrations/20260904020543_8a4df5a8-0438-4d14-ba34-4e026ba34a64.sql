ALTER TABLE public.suggestions DROP CONSTRAINT IF EXISTS suggestions_type_check;
ALTER TABLE public.suggestions ADD CONSTRAINT suggestions_type_check
  CHECK (type = ANY (ARRAY['new_person'::text, 'edit'::text, 'memorial'::text, 'roster_import'::text, 'contact_tip'::text]));

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
           FROM stints s
          WHERE s.person_id = p.id AND (s.role = ANY (ARRAY['player'::text, 'captain'::text])) AND s.year = EXTRACT(year FROM (now() AT TIME ZONE 'America/New_York'::text))::integer)) AS is_current,
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
    (EXISTS ( SELECT 1
           FROM identities i
          WHERE i.person_id = p.id)) AS has_contact
   FROM people p
     JOIN person_board_placement pbp ON pbp.person_id = p.id
     LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1))
     LEFT JOIN team_names tn ON tn.division = pbp.board_division AND pbp.board_year >= COALESCE(tn.start_year, '-2147483648'::integer) AND pbp.board_year <= COALESCE(tn.end_year, 2147483647)
  WHERE p.archived = false AND p.show_on_board = true AND pbp.board_year IS NOT NULL AND (pbp.board_division IS NULL OR (EXISTS ( SELECT 1
           FROM divisions d
          WHERE d.code = pbp.board_division AND d.visible = true)));

CREATE OR REPLACE VIEW public.board_coaches AS
SELECT p.id,
    p.first_name,
    p.last_name,
    p.played_as,
    p.deceased,
        CASE
            WHEN p.deceased THEN 'memorial'::text
            WHEN r.status = 'going'::text THEN 'going'::text
            WHEN r.status = 'maybe'::text THEN 'maybe'::text
            WHEN (EXISTS ( SELECT 1
               FROM identities i
              WHERE i.person_id = p.id AND i.verified_at IS NOT NULL)) THEN 'claimed'::text
            ELSE 'unclaimed'::text
        END AS state,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM stints s
              WHERE s.person_id = p.id AND s.role = 'coach'::text)) THEN 'coach'::text
            ELSE 'manager'::text
        END AS role_label,
    (EXISTS ( SELECT 1
           FROM identities i
          WHERE i.person_id = p.id)) AS has_contact
   FROM people p
     LEFT JOIN person_board_placement pbp ON pbp.person_id = p.id
     LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1))
  WHERE p.show_on_board = true AND (pbp.person_id IS NULL OR pbp.board_year IS NULL) AND (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id)) AND NOT (EXISTS ( SELECT 1
           FROM stints s
          WHERE s.person_id = p.id AND (s.role <> ALL (ARRAY['coach'::text, 'manager'::text]))));