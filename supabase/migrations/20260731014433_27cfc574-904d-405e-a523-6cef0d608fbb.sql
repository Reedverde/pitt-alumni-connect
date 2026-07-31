-- 1. Authenticated read of board-visible RSVPs, mirroring the anon policy.
CREATE POLICY "public board rsvps authenticated"
  ON public.rsvps
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.people p
      WHERE p.id = rsvps.person_id AND p.show_on_board
    )
  );

-- 2. Ordinary signed-in members may not read private RSVP detail columns.
REVOKE SELECT (party_size, src, responded_at) ON public.rsvps FROM authenticated;
GRANT SELECT (id, person_id, event_year, status) ON public.rsvps TO authenticated;

-- 3. Admin-only full detail accessor.
CREATE OR REPLACE FUNCTION public.admin_rsvp_detail(p_event_year integer DEFAULT NULL)
RETURNS TABLE (
  id uuid,
  person_id uuid,
  event_year integer,
  status text,
  party_size integer,
  src text,
  responded_at timestamptz
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT r.id, r.person_id, r.event_year, r.status::text, r.party_size, r.src::text, r.responded_at
    FROM public.rsvps r
    WHERE p_event_year IS NULL OR r.event_year = p_event_year;
END;
$$;

-- 4. Execute for signed-in callers only.
REVOKE ALL ON FUNCTION public.admin_rsvp_detail(integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.admin_rsvp_detail(integer) TO authenticated;