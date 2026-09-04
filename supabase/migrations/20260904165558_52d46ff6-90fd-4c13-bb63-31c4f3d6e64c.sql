-- Three tables carried full read/write privileges for signed-out visitors.
-- Nothing leaked, because their access rules only ever named signed-in users
-- and the secrets table has no rules at all, but the privileges themselves
-- should never have been there. Remove them and grant exactly what is used.

REVOKE ALL ON public.internal_secrets FROM anon, authenticated;
GRANT ALL ON public.internal_secrets TO service_role;

REVOKE ALL ON public.auth_attempts FROM anon, authenticated;
GRANT SELECT ON public.auth_attempts TO authenticated;
GRANT ALL ON public.auth_attempts TO service_role;

REVOKE ALL ON public.event_rsvps FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;