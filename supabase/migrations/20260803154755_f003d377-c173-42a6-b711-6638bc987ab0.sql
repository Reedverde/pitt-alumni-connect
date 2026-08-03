DROP POLICY IF EXISTS "public board rsvps authenticated" ON public.rsvps;

DROP POLICY IF EXISTS "signed in members read roster" ON public.people;

CREATE POLICY "members read own person row"
  ON public.people FOR SELECT
  TO authenticated
  USING (id = public.current_person_id() OR public.is_admin());