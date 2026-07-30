-- people: signed-in members read only non-sensitive columns
REVOKE SELECT, UPDATE, INSERT, DELETE ON public.people FROM authenticated;
GRANT SELECT (id, first_name, last_name, played_as, current_city, grad_year,
              seed_division, seed_division_alt, deceased, show_on_board,
              share_email, open_to_network)
  ON public.people TO authenticated;
GRANT UPDATE (first_name, last_name, played_as, current_city,
              show_on_board, share_email, open_to_network)
  ON public.people TO authenticated;
GRANT ALL ON public.people TO service_role;

-- internal-only tables: no Data API access for anon or authenticated
REVOKE ALL ON public.audit_log FROM anon;
REVOKE ALL ON public.sends FROM anon, authenticated;
REVOKE ALL ON public.suppressions FROM anon, authenticated;
REVOKE ALL ON public.preapproved_emails FROM anon, authenticated;
REVOKE ALL ON public.sequences FROM anon, authenticated;
REVOKE ALL ON public.throttle_events FROM anon, authenticated;
REVOKE ALL ON public.identities_needing_second_email FROM anon, authenticated;
GRANT ALL ON public.audit_log TO service_role;
GRANT ALL ON public.sends TO service_role;
GRANT ALL ON public.suppressions TO service_role;
GRANT ALL ON public.preapproved_emails TO service_role;
GRANT ALL ON public.sequences TO service_role;
GRANT ALL ON public.throttle_events TO service_role;
GRANT SELECT ON public.identities_needing_second_email TO service_role;