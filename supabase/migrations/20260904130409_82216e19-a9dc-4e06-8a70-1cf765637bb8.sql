-- ============================================================
-- Phase 1: data foundations. Additive and reversible.
-- ============================================================

-- 1. Events: an explicit published switch, separate from is_placeholder.
--    A placeholder is "time or place not locked yet"; published is "this
--    belongs on the schedule at all". Default true so every existing row,
--    including the three placeholders, keeps its current intent.
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS published boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.events.published IS
  'Whether the event appears on the schedule and is eligible to collect an RSVP answer. Independent of is_placeholder (timing not locked) and prompt_rsvp (asks for its own headcount).';

COMMENT ON COLUMN public.events.prompt_rsvp IS
  'Whether this event collects its own yes/no answer and party size. Only meaningful when published.';

-- 2. The RSVP editable-until rule.
--    Order: explicit organizer override, else the latest reliable event end
--    time for that edition, else the end of the edition''s final day in
--    America/New_York. No grace period.
CREATE OR REPLACE FUNCTION public.rsvp_editable_until(_event_year integer DEFAULT NULL)
RETURNS timestamptz
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  y integer;
  override_raw text;
  override_ts timestamptz;
  latest_end timestamptz;
  last_day date;
BEGIN
  y := COALESCE(_event_year, public.current_edition_year());
  IF y IS NULL THEN
    RETURN NULL;
  END IF;

  -- An organizer override wins outright. Two shapes are accepted: a bare
  -- timestamp (applies to the current edition) or "<year>=<timestamp>".
  SELECT value INTO override_raw
  FROM public.app_settings
  WHERE key = 'rsvp_editable_until';

  IF override_raw IS NOT NULL AND btrim(override_raw) <> '' THEN
    IF override_raw LIKE '%=%' THEN
      IF split_part(override_raw, '=', 1) = y::text THEN
        BEGIN
          override_ts := split_part(override_raw, '=', 2)::timestamptz;
        EXCEPTION WHEN others THEN
          override_ts := NULL;
        END;
      END IF;
    ELSE
      BEGIN
        override_ts := override_raw::timestamptz;
      EXCEPTION WHEN others THEN
        override_ts := NULL;
      END;
    END IF;
    IF override_ts IS NOT NULL THEN
      RETURN override_ts;
    END IF;
  END IF;

  -- The latest reliable end time across the edition''s published events.
  -- A placeholder with a real end time still counts; a row with no end time
  -- simply contributes nothing.
  SELECT max(e.ends_at) INTO latest_end
  FROM public.events e
  WHERE e.event_year = y
    AND e.published
    AND e.ends_at IS NOT NULL;

  -- Fallback: end of the edition''s final day, Eastern.
  SELECT ends_on INTO last_day FROM public.editions WHERE event_year = y;
  IF last_day IS NULL THEN
    RETURN latest_end;
  END IF;

  RETURN GREATEST(
    COALESCE(latest_end, '-infinity'::timestamptz),
    ((last_day + 1)::timestamp AT TIME ZONE 'America/New_York') - interval '1 second'
  );
END;
$$;

COMMENT ON FUNCTION public.rsvp_editable_until(integer) IS
  'The moment RSVPs stop being editable for an edition. Organizer override in app_settings.rsvp_editable_until, else the latest published event end time, else the end of the edition final day in America/New_York. No grace period.';

CREATE OR REPLACE FUNCTION public.rsvp_is_editable(_event_year integer DEFAULT NULL)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT now() <= COALESCE(public.rsvp_editable_until(_event_year), 'infinity'::timestamptz);
$$;

GRANT EXECUTE ON FUNCTION public.rsvp_editable_until(integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.rsvp_is_editable(integer) TO anon, authenticated, service_role;

-- 3. Archived coaches must not reach the public board. board_people already
--    filters archived; board_coaches did not. Same definition otherwise.
CREATE OR REPLACE VIEW public.board_coaches AS
 SELECT p.id,
    p.first_name,
    p.last_name,
    p.played_as,
    p.deceased,
        CASE
            WHEN p.deceased THEN 'memorial'::text
            WHEN (r.status = 'going'::text) THEN 'going'::text
            WHEN (r.status = 'maybe'::text) THEN 'maybe'::text
            WHEN (EXISTS ( SELECT 1
               FROM identities i
              WHERE ((i.person_id = p.id) AND (i.verified_at IS NOT NULL)))) THEN 'claimed'::text
            ELSE 'unclaimed'::text
        END AS state,
        CASE
            WHEN (EXISTS ( SELECT 1
               FROM stints s
              WHERE ((s.person_id = p.id) AND (s.role = 'coach'::text)))) THEN 'coach'::text
            ELSE 'manager'::text
        END AS role_label,
    (EXISTS ( SELECT 1
           FROM identities i
          WHERE (i.person_id = p.id))) AS has_contact
   FROM ((people p
     LEFT JOIN person_board_placement pbp ON ((pbp.person_id = p.id)))
     LEFT JOIN rsvps r ON (((r.person_id = p.id) AND (r.event_year = ( SELECT e.event_year
           FROM editions e
          WHERE e.is_current
         LIMIT 1)))))
  WHERE ((p.archived = false) AND (p.show_on_board = true) AND ((pbp.person_id IS NULL) OR (pbp.board_year IS NULL)) AND (EXISTS ( SELECT 1
           FROM stints s
          WHERE (s.person_id = p.id))) AND (NOT (EXISTS ( SELECT 1
           FROM stints s
          WHERE ((s.person_id = p.id) AND (s.role <> ALL (ARRAY['coach'::text, 'manager'::text])))))));

-- 4. A clearly named reading of the historically inclusive roster data that
--    is currently called current_players. Same rows, honest name. The old
--    view stays for compatibility and is retired in a later phase.
CREATE OR REPLACE VIEW public.roster_stints AS
  SELECT DISTINCT person_id, year, division
  FROM public.stints
  WHERE source = ANY (ARRAY['roster_import'::text, 'self'::text, 'admin'::text]);

COMMENT ON VIEW public.roster_stints IS
  'Every stint from a trusted source (roster import, self entry, admin entry), across all years. NOT limited to the current season. Replaces the misleadingly named current_players, which is kept only for compatibility.';

COMMENT ON VIEW public.current_players IS
  'DEPRECATED and misnamed: these are trusted-source roster stints for all years, not current players. Use roster_stints.';

GRANT SELECT ON public.roster_stints TO authenticated, service_role;

-- 5. Organizer-only reporting foundations. Security definer functions guarded
--    by is_admin(), matching the existing admin_rsvp_detail convention. No new
--    view is exposed to the Data API, so anonymous callers get nothing.

-- Yearly totals. "No response" is everyone eligible for the board who has no
-- rsvps row at all for that year, which is what keeps unanswered distinct
-- from an explicit no.
CREATE OR REPLACE FUNCTION public.admin_annual_rsvp_totals(_event_year integer DEFAULT NULL)
RETURNS TABLE(
  event_year integer,
  going integer,
  maybe integer,
  not_this_year integer,
  no_response integer,
  planned_heads integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE r.event_year = y;
END;
$$;

-- Per-event totals for the events that collect their own answer. Unanswered
-- is scoped to the people who said they are coming to the weekend: they are
-- the population an organizer still needs an answer from.
CREATE OR REPLACE FUNCTION public.admin_event_rsvp_totals(_event_year integer DEFAULT NULL)
RETURNS TABLE(
  event_id uuid,
  title text,
  starts_at timestamptz,
  is_placeholder boolean,
  yes_count integer,
  no_count integer,
  unanswered_count integer,
  planned_heads integer
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
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
  WHERE r.event_year = y AND r.status = 'going';

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
    LEFT JOIN public.rsvps g
      ON g.person_id = er.person_id AND g.event_year = y AND g.status = 'going'
    WHERE er.event_id = e.id
  ) a ON true
  WHERE e.event_year = y
    AND e.published
    AND e.prompt_rsvp
  ORDER BY e.sort_order;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_annual_rsvp_totals(integer) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_event_rsvp_totals(integer) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.admin_annual_rsvp_totals(integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_event_rsvp_totals(integer) FROM anon;
