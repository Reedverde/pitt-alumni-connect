DROP POLICY IF EXISTS photo_slots_public_read ON public.photo_slots;
CREATE POLICY photo_slots_public_read ON public.photo_slots FOR SELECT TO anon, authenticated
  USING (photo_id IS NOT NULL OR public.is_admin());
DROP POLICY IF EXISTS photos_public_read ON public.photos;
CREATE POLICY photos_public_read ON public.photos FOR SELECT TO anon, authenticated
  USING (board_year IS NOT NULL OR EXISTS (SELECT 1 FROM public.photo_slots s WHERE s.photo_id = photos.id) OR public.is_admin());