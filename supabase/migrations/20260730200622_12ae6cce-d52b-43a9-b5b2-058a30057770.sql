DROP POLICY IF EXISTS "admins manage identities" ON public.identities;
DROP POLICY IF EXISTS "members add own identities" ON public.identities;
DROP POLICY IF EXISTS "members delete own identities" ON public.identities;
DROP POLICY IF EXISTS "members update own identities" ON public.identities;
DROP POLICY IF EXISTS "own identities" ON public.identities;
DROP POLICY IF EXISTS "public claimed flags" ON public.identities;

ALTER TABLE public.identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "identities select own or admin" ON public.identities
  FOR SELECT TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin());

CREATE POLICY "identities insert own or admin" ON public.identities
  FOR INSERT TO authenticated
  WITH CHECK (person_id = public.current_person_id() OR public.is_admin());

CREATE POLICY "identities update own or admin" ON public.identities
  FOR UPDATE TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin())
  WITH CHECK (person_id = public.current_person_id() OR public.is_admin());

CREATE POLICY "identities delete own or admin" ON public.identities
  FOR DELETE TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin());

-- Public board needs only "is this person claimed". anon holds column grants on
-- person_id and verified_at only; no email column is reachable.
CREATE POLICY "identities public claimed flag only" ON public.identities
  FOR SELECT TO anon
  USING (verified_at IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.people p WHERE p.id = identities.person_id AND p.show_on_board
  ));

REVOKE ALL ON public.identities FROM anon;
GRANT SELECT (person_id, verified_at) ON public.identities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identities TO authenticated;
GRANT ALL ON public.identities TO service_role;