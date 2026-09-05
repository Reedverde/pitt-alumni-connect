-- Reporting counts the eligible board, not raw rows. An archived, memorial or
-- hidden record can still own an RSVP row from before it was set aside; those
-- rows must not move an organizer's attendance number. This matches the rule
-- the dashboard already applies in application code.

CREATE OR REPLACE FUNCTION public.admin_annual_rsvp_totals(_event_year integer DEFAULT NULL::integer)
 RETURNS TABLE(event_year integer, going integer, maybe integer, not_this_year integer, no_response integer, planned_heads integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  y integer;
  eligible integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  y := COALESCE(_event_year, public.current_edition_year());

  SELECT count(*) INTO eligible
  FROM public.people p
  WHERE p.archived = false AND p.deceased = false AND p.show_on_board = true;

  RETURN QUERY
  SELECT
    y,
    count(*) FILTER (WHERE r.status = 'going')::integer,
    count(*) FILTER (WHERE r.status = 'maybe')::integer,
    count(*) FILTER (WHERE r.status = 'not_this_year')::integer,
    GREATEST(eligible - count(*)::integer, 0),
    COALESCE(sum(r.party_size) FILTER (WHERE r.status = 'going'), 0)::integer
  FROM public.rsvps r
  JOIN public.people p ON p.id = r.person_id
  WHERE r.event_year = y
    AND p.archived = false AND p.deceased = false AND p.show_on_board = true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_event_rsvp_totals(_event_year integer DEFAULT NULL::integer)
 RETURNS TABLE(event_id uuid, title text, starts_at timestamp with time zone, is_placeholder boolean, yes_count integer, no_count integer, unanswered_count integer, planned_heads integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  y integer;
  going_total integer;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;

  y := COALESCE(_event_year, public.current_edition_year());

  SELECT count(*) INTO going_total
  FROM public.rsvps r
  JOIN public.people p ON p.id = r.person_id
  WHERE r.event_year = y AND r.status = 'going'
    AND p.archived = false AND p.deceased = false AND p.show_on_board = true;

  RETURN QUERY
  SELECT
    e.id,
    e.title,
    e.starts_at,
    e.is_placeholder,
    COALESCE(a.yes_count, 0),
    COALESCE(a.no_count, 0),
    GREATEST(going_total - COALESCE(a.going_answered, 0), 0),
    COALESCE(a.planned_heads, 0)
  FROM public.events e
  LEFT JOIN LATERAL (
    SELECT
      count(*) FILTER (WHERE er.status = 'yes')::integer AS yes_count,
      count(*) FILTER (WHERE er.status = 'no')::integer AS no_count,
      count(*) FILTER (WHERE g.person_id IS NOT NULL)::integer AS going_answered,
      COALESCE(sum(er.party_size) FILTER (WHERE er.status = 'yes'), 0)::integer AS planned_heads
    FROM public.event_rsvps er
    JOIN public.people ep ON ep.id = er.person_id
      AND ep.archived = false AND ep.deceased = false AND ep.show_on_board = true
    LEFT JOIN public.rsvps g
      ON g.person_id = er.person_id AND g.event_year = y AND g.status = 'going'
    WHERE er.event_id = e.id
  ) a ON true
  WHERE e.event_year = y
    AND e.published
    AND e.prompt_rsvp
  ORDER BY e.sort_order;
END;
$function$;

CREATE OR REPLACE FUNCTION public.admin_rsvp_detail(p_event_year integer DEFAULT NULL::integer)
 RETURNS TABLE(id uuid, person_id uuid, event_year integer, status text, party_size integer, src text, responded_at timestamp with time zone)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'admin only';
  END IF;
  RETURN QUERY
    SELECT r.id, r.person_id, r.event_year, r.status::text, r.party_size, r.src::text, r.responded_at
    FROM public.rsvps r
    JOIN public.people p ON p.id = r.person_id
    WHERE (p_event_year IS NULL OR r.event_year = p_event_year)
      AND p.archived = false AND p.deceased = false AND p.show_on_board = true;
END;
$function$;