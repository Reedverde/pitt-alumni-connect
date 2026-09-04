-- 1. Deliverability is derived, never stored. A person is reachable when at
--    least one of their addresses is not suppressed. Any address counts, not
--    only the primary, so suppressing a dead alternate leaves a person with a
--    working primary reachable.
CREATE OR REPLACE VIEW public.person_reachability AS
SELECT p.id AS person_id,
  EXISTS (
    SELECT 1
    FROM public.identities i
    WHERE i.person_id = p.id
      AND i.email IS NOT NULL
      AND btrim(i.email) <> ''
      AND NOT EXISTS (
        SELECT 1 FROM public.suppressions s
        WHERE s.email = lower(btrim(i.email))
      )
  ) AS has_deliverable_email
FROM public.people p;

COMMENT ON VIEW public.person_reachability IS
  'Derived deliverability. person_id plus a boolean for having at least one non-suppressed address. Intentionally owner-run so dependent public views can read it without any grant on identities or suppressions. Never add an email column here.';

GRANT SELECT ON public.person_reachability TO authenticated, service_role;

-- 2. Suppression keys are always lowercased and trimmed, so a re-import of a
--    differently cased address cannot slip past the check.
CREATE OR REPLACE FUNCTION public.suppressions_normalize_email()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.email := lower(btrim(NEW.email));
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS suppressions_normalize_email ON public.suppressions;
CREATE TRIGGER suppressions_normalize_email
BEFORE INSERT OR UPDATE ON public.suppressions
FOR EACH ROW EXECUTE FUNCTION public.suppressions_normalize_email();

UPDATE public.suppressions SET email = lower(btrim(email))
WHERE email <> lower(btrim(email));

-- 3. Soft bounces are counted per send row; three across an address retires it.
ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS soft_bounce_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS delivered_at timestamptz;

-- 4. has_contact on the public board views now means deliverable, not merely
--    present in identities.
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

CREATE OR REPLACE VIEW public.board_coaches AS
 SELECT p.id,
    p.first_name,
    p.last_name,
    p.played_as,
    p.deceased,
        CASE
            WHEN p.deceased THEN 'memorial'::text
            WHEN (r.status = 'going'::text) THEN 'going'::text
            WHEN (r.status = 'maybe'::text) THEN 'maybe'::text
            WHEN (EXISTS ( SELECT 1
               FROM identities i
              WHERE ((i.person_id = p.id) AND (i.verified_at IS NOT NULL)))) THEN 'claimed'::text
            ELSE 'unclaimed'::text
        END AS state,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM stints s
              WHERE ((s.person_id = p.id) AND (s.role = 'coach'::text)))) THEN 'coach'::text
            ELSE 'manager'::text
        END AS role_label,
    COALESCE(pr.has_deliverable_email, false) AS has_contact
   FROM (((people p
     LEFT JOIN person_board_placement pbp ON ((pbp.person_id = p.id)))
     LEFT JOIN person_reachability pr ON ((pr.person_id = p.id)))
     LEFT JOIN rsvps r ON (((r.person_id = p.id) AND (r.event_year = ( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1)))))
  WHERE ((p.archived = false) AND (p.show_on_board = true) AND ((pbp.person_id IS NULL) OR (pbp.board_year IS NULL)) AND (EXISTS ( SELECT 1
           FROM stints s
          WHERE (s.person_id = p.id))) AND (NOT (EXISTS ( SELECT 1
           FROM stints s
          WHERE ((s.person_id = p.id) AND (s.role <> ALL (ARRAY['coach'::text, 'manager'::text])))))));

GRANT SELECT ON public.board_people TO anon, authenticated, service_role;
GRANT SELECT ON public.board_coaches TO anon, authenticated, service_role;

-- 5. Backfill of confirmed hard bounces. Never removed automatically.
INSERT INTO public.suppressions (email, reason) VALUES
  ('abs132@pitt.edu','hard_bounce'),
  ('apr27@pitt.edu','hard_bounce'),
  ('bwc16@pitt.edu','hard_bounce'),
  ('cjm210@pitt.edu','hard_bounce'),
  ('crd74@pitt.edu','hard_bounce'),
  ('dbf14@pitt.edu','hard_bounce'),
  ('dgs31@pitt.edu','hard_bounce'),
  ('dlm85@pitt.edu','hard_bounce'),
  ('egm19@pitt.edu','hard_bounce'),
  ('ejk43@pitt.edu','hard_bounce'),
  ('fed12@pitt.edu','hard_bounce'),
  ('jds154@pitt.edu','hard_bounce'),
  ('jmc304@pitt.edu','hard_bounce'),
  ('jrh183@pitt.edu','hard_bounce'),
  ('kwc13@pitt.edu','hard_bounce'),
  ('maz58@pitt.edu','hard_bounce'),
  ('mbm79@pitt.edu','hard_bounce'),
  ('mjr134@pitt.edu','hard_bounce'),
  ('mjy24@pitt.edu','hard_bounce'),
  ('mss132@pitt.edu','hard_bounce'),
  ('npl13@pitt.edu','hard_bounce'),
  ('rstrausser@evanhospital.com','hard_bounce'),
  ('sdr37@pitt.edu','hard_bounce'),
  ('sdw32@pitt.edu','hard_bounce'),
  ('smz30@pitt.edu','hard_bounce'),
  ('sth60@pitt.edu','hard_bounce'),
  ('tjb133@pitt.edu','hard_bounce'),
  ('tjw53@pitt.edu','hard_bounce'),
  ('tom32@pitt.edu','hard_bounce'),
  ('ultimate@mikeyanchak.com','hard_bounce')
ON CONFLICT (email) DO NOTHING;