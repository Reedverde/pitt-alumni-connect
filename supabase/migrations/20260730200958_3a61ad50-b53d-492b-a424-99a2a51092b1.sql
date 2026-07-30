REVOKE ALL ON public.audit_log FROM authenticated;
GRANT SELECT ON public.audit_log TO authenticated; -- rows still gated to admins by RLS
REVOKE ALL ON public.suggestions FROM anon;
REVOKE ALL ON public.verifications FROM anon;
REVOKE ALL ON public.admins FROM anon;
REVOKE ALL ON public.current_players FROM anon;
GRANT ALL ON public.suggestions TO service_role;
GRANT ALL ON public.verifications TO service_role;
GRANT ALL ON public.admins TO service_role;