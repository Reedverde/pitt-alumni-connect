CREATE POLICY "members add own identities" ON public.identities
  FOR INSERT TO authenticated
  WITH CHECK (person_id = public.current_person_id());

CREATE POLICY "members update own identities" ON public.identities
  FOR UPDATE TO authenticated
  USING (person_id = public.current_person_id())
  WITH CHECK (person_id = public.current_person_id());

CREATE POLICY "members delete own identities" ON public.identities
  FOR DELETE TO authenticated
  USING (person_id = public.current_person_id());

ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS anchors_only boolean NOT NULL DEFAULT false;