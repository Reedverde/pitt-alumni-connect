DROP POLICY IF EXISTS photos_bucket_read ON storage.objects;
CREATE POLICY photos_bucket_admin_read ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'photos' AND public.is_admin());