CREATE TABLE public.photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  storage_path text NOT NULL UNIQUE,
  original_name text,
  alt text,
  width int,
  height int,
  uploaded_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photos TO authenticated;
GRANT ALL ON public.photos TO service_role;

ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photos_public_read" ON public.photos FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "photos_admin_insert" ON public.photos FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "photos_admin_update" ON public.photos FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "photos_admin_delete" ON public.photos FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.photo_slots (
  key text PRIMARY KEY,
  photo_id uuid REFERENCES public.photos(id) ON DELETE SET NULL,
  updated_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  updated_at timestamptz DEFAULT now()
);

GRANT SELECT ON public.photo_slots TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.photo_slots TO authenticated;
GRANT ALL ON public.photo_slots TO service_role;

ALTER TABLE public.photo_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "photo_slots_public_read" ON public.photo_slots FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "photo_slots_admin_insert" ON public.photo_slots FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "photo_slots_admin_update" ON public.photo_slots FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "photo_slots_admin_delete" ON public.photo_slots FOR DELETE TO authenticated USING (public.is_admin());

INSERT INTO public.photo_slots (key) VALUES
  ('why_founding_1998'),
  ('why_back_to_back_2013'),
  ('why_return_2026'),
  ('why_statement_card'),
  ('weekend_hero');

CREATE POLICY "photos_bucket_admin_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'photos' AND public.is_admin());
CREATE POLICY "photos_bucket_admin_update" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin()) WITH CHECK (bucket_id = 'photos' AND public.is_admin());
CREATE POLICY "photos_bucket_admin_delete" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'photos' AND public.is_admin());
CREATE POLICY "photos_bucket_read" ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'photos');