ALTER VIEW public.roster_stints SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.rsvp_editable_until(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rsvp_is_editable(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.rsvp_editable_until(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.rsvp_is_editable(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_annual_rsvp_totals(integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.admin_event_rsvp_totals(integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.rsvp_editable_until(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_is_editable(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_annual_rsvp_totals(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_event_rsvp_totals(integer) TO authenticated, service_role;
