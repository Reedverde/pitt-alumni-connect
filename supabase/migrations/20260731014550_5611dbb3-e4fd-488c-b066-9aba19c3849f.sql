REVOKE SELECT ON public.rsvps FROM authenticated;
GRANT SELECT (id, person_id, event_year, status) ON public.rsvps TO authenticated;