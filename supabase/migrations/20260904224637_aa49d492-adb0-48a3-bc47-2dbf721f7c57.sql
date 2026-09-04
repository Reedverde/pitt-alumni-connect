-- ============ 1. Event model =============================================
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS admin_key       text,
  ADD COLUMN IF NOT EXISTS admin_name      text,
  ADD COLUMN IF NOT EXISTS timezone        text NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS status          text NOT NULL DEFAULT 'tentative',
  ADD COLUMN IF NOT EXISTS audience        text NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS organizer_notes text,
  ADD COLUMN IF NOT EXISTS ask_party_size  boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS critical_mass   integer,
  ADD COLUMN IF NOT EXISTS capacity        integer,
  ADD COLUMN IF NOT EXISTS created_at      timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at      timestamptz NOT NULL DEFAULT now();

COMMENT ON COLUMN public.events.notes IS 'Public description shown on /schedule.';
COMMENT ON COLUMN public.events.organizer_notes IS 'Private organizer detail. Never public, never news.';

DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_status_check
    CHECK (status IN ('tentative','confirmed','changed','cancelled'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_audience_check
    CHECK (audience IN ('everyone','alumni','current_players','families','spectators','adults','division'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_capacity_check
    CHECK (capacity IS NULL OR capacity > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE public.events ADD CONSTRAINT events_critical_mass_check
    CHECK (critical_mass IS NULL OR critical_mass > 0);
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Everything on a published schedule asks for an RSVP unless an organizer opts out.
ALTER TABLE public.events ALTER COLUMN prompt_rsvp SET DEFAULT true;

-- Backfill, in place, without touching identifiers or answers.
UPDATE public.events SET
  status = CASE
    WHEN is_placeholder THEN 'tentative'
    WHEN time_tbd OR starts_at IS NULL THEN 'tentative'
    ELSE 'confirmed' END
WHERE status = 'tentative';

UPDATE public.events SET audience = 'division' WHERE division IS NOT NULL AND audience = 'everyone';

UPDATE public.events SET admin_key = left(
    regexp_replace(lower(coalesce(title,'event')), '[^a-z0-9]+', '-', 'g'), 40)
  || '-' || event_year::text
WHERE admin_key IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS events_admin_key_year_idx
  ON public.events (event_year, admin_key);

CREATE OR REPLACE FUNCTION public.events_touch_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $fn$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $fn$;

DROP TRIGGER IF EXISTS events_touch_updated_at ON public.events;
CREATE TRIGGER events_touch_updated_at BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_touch_updated_at();

-- ============ 2. Durable change history ==================================
CREATE TABLE IF NOT EXISTS public.event_changes (
  id           bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_id     uuid,
  event_year   integer,
  op           text NOT NULL CHECK (op IN ('insert','update','delete')),
  changed_fields text[] NOT NULL DEFAULT '{}',
  before       jsonb,
  after        jsonb,
  actor_person_id uuid,
  source       text,
  newsworthy   boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.event_changes TO authenticated;
GRANT ALL ON public.event_changes TO service_role;
ALTER TABLE public.event_changes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read event changes" ON public.event_changes;
CREATE POLICY "Admins read event changes" ON public.event_changes
  FOR SELECT TO authenticated USING (public.is_admin());

CREATE INDEX IF NOT EXISTS event_changes_event_idx ON public.event_changes (event_id, created_at DESC);

-- ============ 3. Capture + single news path ==============================
CREATE OR REPLACE FUNCTION public.events_capture_change()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE
  b jsonb;
  a jsonb;
  changed text[] := '{}';
  k text;
  src text;
  actor uuid;
  news_kind text;
  news_title text;
  news_summary text;
  news_key text;
  when_text text;
  bits text[] := '{}';
  was_public boolean;
  is_public boolean;
  row_id uuid;
  row_year integer;
  stamp text;
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
      RETURN NULL; -- nothing but a touch
    END IF;
  END IF;

  BEGIN
    actor := public.current_person_id();
  EXCEPTION WHEN others THEN actor := NULL; END;

  src := coalesce(
    nullif(current_setting('request.jwt.claim.role', true), ''),
    nullif((nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'), ''),
    current_user);

  was_public := TG_OP <> 'INSERT' AND coalesce((b ->> 'published')::boolean, false);
  is_public  := TG_OP <> 'DELETE' AND coalesce((a ->> 'published')::boolean, false);

  -- Decide the one public update this change deserves, if any.
  IF TG_OP = 'DELETE' THEN
    IF was_public AND NOT coalesce((b ->> 'is_placeholder')::boolean, false) THEN
      news_kind := 'schedule_cancelled';
      news_title := coalesce(b ->> 'title', 'An event') || ' is off the schedule';
      news_summary := coalesce(b ->> 'title', 'An event')
        || ' has been cancelled. Check the Schedule for what is still on.';
      news_key := 'evt:' || row_id::text || ':cancelled';
    END IF;
  ELSIF TG_OP = 'INSERT' THEN
    IF is_public THEN
      news_kind := CASE WHEN coalesce((a ->> 'time_tbd')::boolean, true) THEN 'schedule_added' ELSE 'schedule_confirmed' END;
      news_title := coalesce(a ->> 'title', 'A new event') || ' is on the schedule';
      news_summary := CASE
        WHEN NOT coalesce((a ->> 'time_tbd')::boolean, true) AND (a ->> 'starts_at') IS NOT NULL
          THEN to_char(((a ->> 'starts_at')::timestamptz AT TIME ZONE 'America/New_York'), 'FMDay, FMHH12:MI AM') || '.'
        ELSE 'Time still to be confirmed.' END
        || CASE WHEN coalesce(a ->> 'location', '') <> '' THEN ' At ' || (a ->> 'location') || '.' ELSE '' END;
      news_key := 'evt:' || row_id::text || ':added';
    END IF;
  ELSE
    -- Unpublished before and after: organizers are still drafting.
    IF was_public OR is_public THEN
      IF (a ->> 'status') = 'cancelled' AND (b ->> 'status') IS DISTINCT FROM 'cancelled' THEN
        news_kind := 'schedule_cancelled';
        news_title := coalesce(a ->> 'title', 'An event') || ' is cancelled';
        news_summary := coalesce(a ->> 'title', 'An event')
          || ' will not happen this year. Check the Schedule for what is still on.';
        news_key := 'evt:' || row_id::text || ':cancelled';
      ELSIF NOT was_public AND is_public THEN
        news_kind := 'schedule_added';
        news_title := coalesce(a ->> 'title', 'An event') || ' is on the schedule';
        news_summary := 'Details and RSVP are on the Schedule.';
        news_key := 'evt:' || row_id::text || ':added';
      ELSE
        when_text := CASE
          WHEN NOT coalesce((a ->> 'time_tbd')::boolean, true) AND (a ->> 'starts_at') IS NOT NULL
            THEN to_char(((a ->> 'starts_at')::timestamptz AT TIME ZONE 'America/New_York'), 'FMDay, FMHH12:MI AM')
          ELSE NULL END;

        IF 'status' = ANY (changed) AND (a ->> 'status') = 'confirmed' THEN
          bits := bits || (CASE WHEN when_text IS NOT NULL THEN 'is confirmed for ' || when_text ELSE 'is confirmed' END);
        END IF;
        IF 'time_tbd' = ANY (changed) AND NOT coalesce((a ->> 'time_tbd')::boolean, true) THEN
          bits := bits || (CASE WHEN when_text IS NOT NULL THEN 'has a confirmed time, ' || when_text ELSE 'has a confirmed time' END);
        ELSIF ('starts_at' = ANY (changed)) OR ('ends_at' = ANY (changed)) THEN
          bits := bits || (CASE WHEN when_text IS NOT NULL THEN 'moved to ' || when_text ELSE 'moved to a new time' END);
        END IF;
        IF 'day_number' = ANY (changed) AND when_text IS NULL THEN
          bits := bits || 'moved to a different day';
        END IF;
        IF 'location' = ANY (changed) THEN
          bits := bits || (CASE WHEN coalesce(a ->> 'location','') <> '' THEN 'is now at ' || (a ->> 'location') ELSE 'changed location' END);
        END IF;
        IF 'audience' = ANY (changed) THEN
          bits := bits || 'is open to a different group';
        END IF;
        IF 'ticket_url' = ANY (changed) AND coalesce(a ->> 'ticket_url','') <> '' THEN
          bits := bits || 'has tickets available';
        END IF;
        IF 'title' = ANY (changed) THEN
          bits := bits || ('is now called ' || coalesce(a ->> 'title', 'something else'));
        END IF;

        IF array_length(bits, 1) IS NOT NULL THEN
          news_kind := 'schedule_changed';
          news_title := coalesce(a ->> 'title', 'The schedule') || ' has a schedule change';
          news_summary := coalesce(a ->> 'title', 'The schedule') || ' ' || array_to_string(bits, ' and ') || '.';
          stamp := lower(concat_ws('|', a ->> 'day_number', coalesce(a ->> 'starts_at', 'tbd'),
                                   btrim(coalesce(a ->> 'location', '')), a ->> 'status',
                                   a ->> 'audience', coalesce(a ->> 'ticket_url',''), a ->> 'title'));
          news_key := 'evt:' || row_id::text || ':change:' || md5(stamp);
        END IF;
      END IF;
    END IF;
  END IF;

  INSERT INTO public.event_changes (event_id, event_year, op, changed_fields, before, after, actor_person_id, source, newsworthy)
  VALUES (row_id, row_year, lower(TG_OP), changed, b, a, actor, src, news_key IS NOT NULL);

  IF news_key IS NOT NULL THEN
    INSERT INTO public.news_pending_updates (kind, title, summary, category, related_url, dedupe_key)
    VALUES (news_kind, left(news_title, 160), left(news_summary, 400), 'Schedule',
            'https://alumni.pittultimate.org/schedule', left(news_key, 200))
    ON CONFLICT (dedupe_key) DO NOTHING;
  END IF;

  RETURN NULL;
END; $fn$;

DROP TRIGGER IF EXISTS events_capture_change ON public.events;
CREATE TRIGGER events_capture_change
  AFTER INSERT OR UPDATE OR DELETE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.events_capture_change();