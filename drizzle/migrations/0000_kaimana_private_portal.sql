CREATE TABLE public.kaimana_access (
  email text PRIMARY KEY,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member','coordinator')),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.kaimana_access TO service_role;
ALTER TABLE public.kaimana_access ENABLE ROW LEVEL SECURITY;

INSERT INTO public.kaimana_access(email, role) VALUES
 ('kinlingsham@gmail.com','coordinator'),
 ('tmaxdillon@gmail.com','coordinator');

CREATE OR REPLACE FUNCTION public.kaimana_blocked() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT auth.uid() IS NULL
    OR lower(coalesce(auth.jwt()->>'email','')) IN ('williambrotman@gmail.com','brotan@alumni.pitt.edu','brotan@alumni.pitt.edy','brotman@alumni.pitt.edu','brotman@alumni.pitt.edy')
    OR EXISTS (SELECT 1 FROM public.identities WHERE auth_user_id = auth.uid() AND person_id = '7136af44-75a7-480a-a7ea-d3969c72c211')
$$;

CREATE OR REPLACE FUNCTION public.kaimana_can_access() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.kaimana_blocked() AND (
    public.current_person_id() IS NOT NULL
    OR EXISTS (SELECT 1 FROM public.kaimana_access WHERE email = lower(coalesce(auth.jwt()->>'email','')))
  )
$$;

CREATE OR REPLACE FUNCTION public.kaimana_is_coordinator() RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT NOT public.kaimana_blocked() AND (
    public.is_admin()
    OR EXISTS (SELECT 1 FROM public.kaimana_access WHERE role='coordinator' AND email = lower(coalesce(auth.jwt()->>'email','')))
  )
$$;
REVOKE ALL ON FUNCTION public.kaimana_blocked(), public.kaimana_can_access(), public.kaimana_is_coordinator() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.kaimana_blocked(), public.kaimana_can_access(), public.kaimana_is_coordinator() TO authenticated;

CREATE TABLE public.kaimana_roster (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  display_name text NOT NULL CHECK (length(display_name) BETWEEN 1 AND 80),
  status text NOT NULL DEFAULT 'playing' CHECK (status IN ('playing','sideline','maybe','out')),
  note text CHECK (note IS NULL OR length(note) <= 280),
  auth_user_id uuid UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.kaimana_roster TO authenticated;
GRANT ALL ON public.kaimana_roster TO service_role;
ALTER TABLE public.kaimana_roster ENABLE ROW LEVEL SECURITY;
CREATE POLICY kr_select ON public.kaimana_roster FOR SELECT TO authenticated USING (public.kaimana_can_access());
CREATE POLICY kr_insert ON public.kaimana_roster FOR INSERT TO authenticated WITH CHECK (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR public.kaimana_is_coordinator()));
CREATE POLICY kr_update ON public.kaimana_roster FOR UPDATE TO authenticated USING (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR public.kaimana_is_coordinator())) WITH CHECK (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR public.kaimana_is_coordinator()));
CREATE POLICY kr_delete ON public.kaimana_roster FOR DELETE TO authenticated USING (public.kaimana_is_coordinator());

INSERT INTO public.kaimana_roster(display_name, status) VALUES
 ('Henry Ing','playing'),('Michael Ing','playing'),('Trent Dillon','playing'),('Sam VanDusen','playing'),
 ('Maxwell Olesen','playing'),('Michael Brenner','playing'),('Scott Heyman','playing'),('Tristan Yarter','playing'),
 ('Aiden Landis','playing'),('Marcel Oliart','playing'),('Roger Zeng','playing'),('Will Hoffenkamp','playing'),
 ('Chango','playing'),('Kevin Tsui','playing'),('Morey','playing'),('Kyle Hartley','playing'),
 ('Dan O''Connor','playing'),('Jack Slevin','playing'),('Ben Ristau','playing'),('Leo Warren','playing');

CREATE TABLE public.kaimana_posts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id uuid NOT NULL DEFAULT auth.uid(),
  author_name text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 80),
  body text NOT NULL CHECK (length(body) BETWEEN 1 AND 4000),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.kaimana_posts TO authenticated;
GRANT ALL ON public.kaimana_posts TO service_role;
ALTER TABLE public.kaimana_posts ENABLE ROW LEVEL SECURITY;
CREATE POLICY kp_select ON public.kaimana_posts FOR SELECT TO authenticated USING (public.kaimana_can_access());
CREATE POLICY kp_insert ON public.kaimana_posts FOR INSERT TO authenticated WITH CHECK (public.kaimana_can_access() AND auth_user_id = auth.uid());
CREATE POLICY kp_delete ON public.kaimana_posts FOR DELETE TO authenticated USING (public.kaimana_can_access() AND (auth_user_id = auth.uid() OR public.kaimana_is_coordinator()));