-- 1. New canonical event fields ------------------------------------------
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS doors_at timestamptz,
  ADD COLUMN IF NOT EXISTS relative_timing text;

COMMENT ON COLUMN public.events.doors_at IS 'Optional open/doors time, distinct from the start of the event itself.';
COMMENT ON COLUMN public.events.relative_timing IS 'Plain-language timing when no clock time exists, e.g. "After the Pitt game".';

-- 2. Last publicly announced state, per event ------------------------------
CREATE TABLE IF NOT EXISTS public.event_announced_state (
  event_id uuid PRIMARY KEY,
  event_year integer,
  title text,
  state jsonb NOT NULL,
  announced_at timestamptz NOT NULL DEFAULT now(),
  news_id uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_announced_state TO authenticated;
GRANT ALL ON public.event_announced_state TO service_role;

ALTER TABLE public.event_announced_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admins read announced event state"
  ON public.event_announced_state FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.event_announced_state_touch()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DROP TRIGGER IF EXISTS event_announced_state_touch ON public.event_announced_state;
CREATE TRIGGER event_announced_state_touch
  BEFORE UPDATE ON public.event_announced_state
  FOR EACH ROW EXECUTE FUNCTION public.event_announced_state_touch();

-- 3. Seed the baseline from the schedule AS ALREADY ANNOUNCED --------------
--    (done before the corrections below, so those corrections read as the
--     first real net change the bulletin will report)
INSERT INTO public.event_announced_state (event_id, event_year, title, state, announced_at)
SELECT e.id, e.event_year, e.title,
  jsonb_build_object(
    'published', e.published,
    'title', e.title,
    'day_number', e.day_number,
    'starts_at', e.starts_at,
    'ends_at', e.ends_at,
    'doors_at', e.doors_at,
    'relative_timing', e.relative_timing,
    'time_tbd', e.time_tbd,
    'location', e.location,
    'audience', e.audience,
    'division', e.division,
    'status', e.status,
    'ticket_url', e.ticket_url
  ),
  timestamptz '2026-09-04 23:00:00+00'
FROM public.events e
WHERE e.published = true
ON CONFLICT (event_id) DO NOTHING;

-- 4. Event corrections Reed confirmed -------------------------------------
UPDATE public.events SET
  starts_at = timestamptz '2026-10-04 14:00:00+00',
  ends_at   = timestamptz '2026-10-04 16:00:00+00',
  doors_at  = timestamptz '2026-10-04 13:00:00+00',
  time_tbd  = false,
  status    = 'confirmed',
  relative_timing = NULL
WHERE id = '9d9ed934-cde4-4abc-a16e-7085f39d8b00';

UPDATE public.events SET
  starts_at = NULL,
  ends_at = NULL,
  time_tbd = true,
  relative_timing = 'After the Pitt game'
WHERE id = '6ffb72ae-19f9-4704-b18d-d9820bbc10f5';

-- 5. Event history stays durable; the bulletin no longer takes per-edit rows
CREATE OR REPLACE FUNCTION public.events_capture_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  b jsonb; a jsonb; changed text[] := '{}'; k text; src text; actor uuid;
  row_id uuid; row_year integer;
BEGIN
  IF TG_OP = 'DELETE' THEN
    b := to_jsonb(OLD); a := NULL; row_id := OLD.id; row_year := OLD.event_year;
  ELSIF TG_OP = 'INSERT' THEN
    b := NULL; a := to_jsonb(NEW); row_id := NEW.id; row_year := NEW.event_year;
  ELSE
    b := to_jsonb(OLD); a := to_jsonb(NEW); row_id := NEW.id; row_year := NEW.event_year;
    FOR k IN SELECT jsonb_object_keys(a) LOOP
      IF k <> 'updated_at' AND (b -> k) IS DISTINCT FROM (a -> k) THEN
        changed := changed || k;
      END IF;
    END LOOP;
    IF array_length(changed, 1) IS NULL THEN
      RETURN NULL;
    END IF;
  END IF;

  BEGIN actor := public.current_person_id(); EXCEPTION WHEN others THEN actor := NULL; END;

  src := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    current_user);

  INSERT INTO public.event_changes
    (event_id, event_year, op, changed_fields, before, after, actor_person_id, source, newsworthy)
  VALUES (row_id, row_year, lower(TG_OP), changed, b, a, actor, src, false);

  RETURN NULL;
END; $$;

-- 6. One bulletin a day, 9:00 AM Eastern. Today's slot is already used, so
--    nothing publishes while this work is being validated.
UPDATE public.news_settings
   SET daily_digest_time = '09:00',
       weekly_time = '09:00',
       last_digest_date = '2026-09-05'
 WHERE id = true;

-- 7. Exactly-once guard for automated bulletins
CREATE UNIQUE INDEX IF NOT EXISTS news_items_dedupe_key_uniq
  ON public.news_items (dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 8. The one approved locked-schedule email --------------------------------
ALTER TABLE public.sequences ADD COLUMN IF NOT EXISTS missed_at timestamptz;

INSERT INTO public.sequences (key, offset_days, audience_states, active, anchors_only, one_time, scheduled_at)
VALUES ('locked_schedule_2026_09_30', -4, ARRAY['going','maybe'], false, false, true,
        timestamptz '2026-09-30 13:00:00+00')
ON CONFLICT (key) DO UPDATE SET
  audience_states = EXCLUDED.audience_states,
  one_time = true,
  scheduled_at = EXCLUDED.scheduled_at,
  cancelled_at = NULL,
  active = false;

-- The reminder this one replaces must not also go out.
UPDATE public.sequences SET active = false WHERE key = 't_minus_2';