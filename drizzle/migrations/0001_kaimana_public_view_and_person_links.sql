ALTER TABLE public.kaimana_roster ADD COLUMN IF NOT EXISTS person_id uuid REFERENCES public.people(id);
CREATE UNIQUE INDEX IF NOT EXISTS kaimana_roster_person_uq ON public.kaimana_roster(person_id) WHERE person_id IS NOT NULL;
UPDATE public.kaimana_roster kr SET person_id = p.id FROM public.people p
 WHERE kr.person_id IS NULL AND p.merged_into_person_id IS NULL AND NOT p.deceased
 AND (lower(p.first_name||' '||coalesce(p.last_name,'')) = lower(kr.display_name)
   OR (kr.display_name='Chango' AND p.id='1291515a-7eb2-4d4c-85cb-e566dc44f5be')
   OR (kr.display_name='Morey' AND p.id='81c8fa3b-706c-4e3e-916b-df0b88e8853b'));

CREATE OR REPLACE FUNCTION public.kaimana_is_brody() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NOT NULL AND (
    lower(coalesce(auth.jwt()->>'email','')) IN ('williambrotman@gmail.com','brotan@alumni.pitt.edu','brotan@alumni.pitt.edy','brotman@alumni.pitt.edu','brotman@alumni.pitt.edy')
    OR EXISTS (SELECT 1 FROM public.identities WHERE auth_user_id = auth.uid() AND person_id = '7136af44-75a7-480a-a7ea-d3969c72c211'))
$$;
GRANT EXECUTE ON FUNCTION public.kaimana_is_brody() TO anon, authenticated;

GRANT SELECT ON public.kaimana_roster, public.kaimana_posts TO anon;
DROP POLICY IF EXISTS kr_select ON public.kaimana_roster;
CREATE POLICY kr_select ON public.kaimana_roster FOR SELECT TO anon, authenticated USING (NOT public.kaimana_is_brody());
DROP POLICY IF EXISTS kp_select ON public.kaimana_posts;
CREATE POLICY kp_select ON public.kaimana_posts FOR SELECT TO anon, authenticated USING (NOT public.kaimana_is_brody());
DROP POLICY IF EXISTS kr_update ON public.kaimana_roster;
CREATE POLICY kr_update ON public.kaimana_roster FOR UPDATE TO authenticated
 USING (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR (person_id IS NOT NULL AND person_id = public.current_person_id()) OR public.kaimana_is_coordinator()))
 WITH CHECK (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR (person_id IS NOT NULL AND person_id = public.current_person_id()) OR public.kaimana_is_coordinator()));