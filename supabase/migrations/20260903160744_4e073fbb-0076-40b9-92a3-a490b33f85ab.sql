DELETE FROM public.events WHERE id IN ('31e8c4a0-77d1-40de-9743-bc17c1791e87','a6033cd8-28c4-4449-92e5-2b8f37d03fd5');

DELETE FROM public.app_settings WHERE key = 'event_start_date';

CREATE TABLE public.event_rsvps (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  status text NOT NULL CHECK (status IN ('yes','no')),
  party_size integer NOT NULL DEFAULT 1 CHECK (party_size >= 1 AND party_size <= 20),
  responded_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_id)
);

CREATE INDEX event_rsvps_event_idx ON public.event_rsvps (event_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rsvps TO authenticated;
GRANT ALL ON public.event_rsvps TO service_role;

ALTER TABLE public.event_rsvps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members read own event rsvps" ON public.event_rsvps
  FOR SELECT TO authenticated
  USING (person_id = public.current_person_id() OR public.is_admin());

CREATE POLICY "members write own event rsvps" ON public.event_rsvps
  FOR INSERT TO authenticated
  WITH CHECK (person_id = public.current_person_id());

CREATE POLICY "members update own event rsvps" ON public.event_rsvps
  FOR UPDATE TO authenticated
  USING (person_id = public.current_person_id())
  WITH CHECK (person_id = public.current_person_id());

CREATE POLICY "members delete own event rsvps" ON public.event_rsvps
  FOR DELETE TO authenticated
  USING (person_id = public.current_person_id());

CREATE POLICY "admins manage event rsvps" ON public.event_rsvps
  FOR ALL TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE TRIGGER event_rsvps_touch_updated_at
  BEFORE UPDATE ON public.event_rsvps
  FOR EACH ROW EXECUTE FUNCTION public.news_touch_updated_at();