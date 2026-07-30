-- Anonymous board needs only "has this person verified an email", never the address.
GRANT SELECT (person_id, verified_at) ON public.identities TO anon;

DROP POLICY IF EXISTS "anon reads claimed flag only" ON public.identities;
CREATE POLICY "anon reads claimed flag only"
  ON public.identities
  FOR SELECT
  TO anon
  USING (verified_at IS NOT NULL);

-- Board views now enforce the caller's own RLS instead of the creator's.
ALTER VIEW public.person_board_placement SET (security_invoker = on);
ALTER VIEW public.board_people SET (security_invoker = on);
ALTER VIEW public.board_year_counts SET (security_invoker = on);

-- Signed-in members no longer read the whole roster's RSVP and stint rows.
DROP POLICY IF EXISTS "members read rsvps" ON public.rsvps;
CREATE POLICY "members read own rsvps"
  ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin());

DROP POLICY IF EXISTS "members read stints" ON public.stints;
CREATE POLICY "members read own stints"
  ON public.stints
  FOR SELECT
  TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin());