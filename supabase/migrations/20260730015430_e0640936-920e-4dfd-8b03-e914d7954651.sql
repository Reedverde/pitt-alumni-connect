ALTER VIEW public.person_board_placement SET (security_invoker = on);
ALTER VIEW public.current_players SET (security_invoker = on);
ALTER VIEW public.identities_needing_second_email SET (security_invoker = on);

REVOKE EXECUTE ON FUNCTION public.current_person_id() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_person_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, service_role;

COMMENT ON VIEW public.board_people IS 'Public board projection. Intentionally owner-run (security definer) so anonymous visitors can read only these safe columns without any grant on people, stints, rsvps or identities. Never add an email column here.';
COMMENT ON VIEW public.board_year_counts IS 'Public aggregate over board_people. Intentionally owner-run (security definer); exposes counts only.';