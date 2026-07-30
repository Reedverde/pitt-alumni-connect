DROP POLICY IF EXISTS "identities public claimed flag only" ON public.identities;
REVOKE ALL ON public.identities FROM anon;