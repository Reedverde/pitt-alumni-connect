
GRANT EXECUTE ON FUNCTION public.current_roster_year() TO service_role;
ALTER VIEW public.current_people SET (security_invoker = off);
