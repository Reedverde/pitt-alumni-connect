
-- 1. Views run with the querying user's permissions
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
        END AS state
   FROM people p
     JOIN person_board_placement pbp ON pbp.person_id = p.id
     LEFT JOIN rsvps r ON r.person_id = p.id AND r.event_year = (SELECT e.event_year FROM editions e WHERE e.is_current LIMIT 1)
     LEFT JOIN team_names tn ON tn.division = pbp.board_division AND pbp.board_year >= COALESCE(tn.start_year, '-2147483648'::integer) AND pbp.board_year <= COALESCE(tn.end_year, 2147483647)
  WHERE p.show_on_board = true AND pbp.board_year IS NOT NULL AND (pbp.board_division IS NULL OR (EXISTS ( SELECT 1
           FROM divisions d
          WHERE d.code = pbp.board_division AND d.visible = true)));

ALTER VIEW public.person_board_placement SET (security_invoker = on);
ALTER VIEW public.board_people SET (security_invoker = on);
ALTER VIEW public.board_year_counts SET (security_invoker = on);

-- 2. people: anon may only read board-safe columns of board-visible rows
REVOKE SELECT ON public.people FROM anon;
GRANT SELECT (id, first_name, last_name, played_as, deceased, grad_year, seed_division, seed_division_alt, show_on_board) ON public.people TO anon;
DROP POLICY IF EXISTS "public board people" ON public.people;
CREATE POLICY "public board people" ON public.people
  FOR SELECT TO anon USING (show_on_board = true);

-- 3. stints
REVOKE SELECT ON public.stints FROM anon;
GRANT SELECT (id, person_id, year, division, role) ON public.stints TO anon;
DROP POLICY IF EXISTS "public board stints" ON public.stints;
CREATE POLICY "public board stints" ON public.stints
  FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = stints.person_id AND p.show_on_board));
DROP POLICY IF EXISTS "members read stints" ON public.stints;
CREATE POLICY "members read stints" ON public.stints
  FOR SELECT TO authenticated USING (
    person_id = public.current_person_id()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = stints.person_id AND p.show_on_board)
  );

-- 4. rsvps
REVOKE SELECT ON public.rsvps FROM anon;
GRANT SELECT (id, person_id, status, event_year) ON public.rsvps TO anon;
DROP POLICY IF EXISTS "public board rsvps" ON public.rsvps;
CREATE POLICY "public board rsvps" ON public.rsvps
  FOR SELECT TO anon USING (EXISTS (SELECT 1 FROM public.people p WHERE p.id = rsvps.person_id AND p.show_on_board));
DROP POLICY IF EXISTS "members read rsvps" ON public.rsvps;
CREATE POLICY "members read rsvps" ON public.rsvps
  FOR SELECT TO authenticated USING (
    person_id = public.current_person_id()
    OR public.is_admin()
    OR EXISTS (SELECT 1 FROM public.people p WHERE p.id = rsvps.person_id AND p.show_on_board)
  );

-- 5. identities: anon may only see whether a board person is claimed, never emails
REVOKE SELECT ON public.identities FROM anon;
GRANT SELECT (person_id, verified_at) ON public.identities TO anon;
DROP POLICY IF EXISTS "public claimed flags" ON public.identities;
CREATE POLICY "public claimed flags" ON public.identities
  FOR SELECT TO anon USING (
    verified_at IS NOT NULL
    AND EXISTS (SELECT 1 FROM public.people p WHERE p.id = identities.person_id AND p.show_on_board)
  );

-- 6. verifications: only the parties involved and admins
DROP POLICY IF EXISTS "members read verifications" ON public.verifications;
CREATE POLICY "members read verifications" ON public.verifications
  FOR SELECT TO authenticated USING (
    verified_by = public.current_person_id()
    OR person_id = public.current_person_id()
    OR public.is_admin()
  );

-- 7. divisions: hidden divisions are not public
DROP POLICY IF EXISTS "divisions readable by everyone" ON public.divisions;
CREATE POLICY "visible divisions are public" ON public.divisions
  FOR SELECT TO anon USING (visible = true);
CREATE POLICY "members read divisions" ON public.divisions
  FOR SELECT TO authenticated USING (visible = true OR public.is_admin());

-- 8. Lock down SECURITY DEFINER routines that clients should not call
REVOKE ALL ON FUNCTION public.current_edition_year() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.editions_single_current() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_current_edition(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.promote_verified_primary(uuid) FROM PUBLIC, anon, authenticated;
