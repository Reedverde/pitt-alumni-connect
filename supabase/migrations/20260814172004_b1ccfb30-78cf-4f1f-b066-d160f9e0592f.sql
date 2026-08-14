CREATE OR REPLACE FUNCTION public.news_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============ news_items ============
CREATE TABLE public.news_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General'
    CHECK (category IN ('Weekend','Schedule','Travel','Lodging','RSVP','Photos','General')),
  post_type text NOT NULL DEFAULT 'manual'
    CHECK (post_type IN ('daily_digest','weekly_going','manual','urgent')),
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','published','archived')),
  published_at timestamptz,
  related_url text,
  author text,
  event_year integer,
  dedupe_key text UNIQUE,
  created_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX news_items_published_idx
  ON public.news_items (published_at DESC) WHERE status = 'published';

GRANT SELECT ON public.news_items TO anon, authenticated;
GRANT ALL ON public.news_items TO service_role;
ALTER TABLE public.news_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read published news"
  ON public.news_items FOR SELECT TO anon, authenticated
  USING (status = 'published' AND published_at IS NOT NULL AND published_at <= now());

CREATE POLICY "Admins read all news"
  ON public.news_items FOR SELECT TO authenticated
  USING (public.is_admin());

CREATE POLICY "Admins write news"
  ON public.news_items FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER news_items_updated_at
  BEFORE UPDATE ON public.news_items
  FOR EACH ROW EXECUTE FUNCTION public.news_touch_updated_at();

-- ============ news_pending_updates ============
CREATE TABLE public.news_pending_updates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL,
  title text NOT NULL,
  summary text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'General'
    CHECK (category IN ('Weekend','Schedule','Travel','Lodging','RSVP','Photos','General')),
  related_url text,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','suppressed','consumed')),
  dedupe_key text UNIQUE,
  consumed_at timestamptz,
  consumed_news_id uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.news_pending_updates TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.news_pending_updates TO authenticated;
ALTER TABLE public.news_pending_updates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only pending updates"
  ON public.news_pending_updates FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER news_pending_updated_at
  BEFORE UPDATE ON public.news_pending_updates
  FOR EACH ROW EXECUTE FUNCTION public.news_touch_updated_at();

-- ============ news_roundup_members ============
CREATE TABLE public.news_roundup_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_year integer NOT NULL,
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  news_id uuid REFERENCES public.news_items(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_year, person_id)
);

GRANT ALL ON public.news_roundup_members TO service_role;
GRANT SELECT ON public.news_roundup_members TO authenticated;
ALTER TABLE public.news_roundup_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read roundup members"
  ON public.news_roundup_members FOR SELECT TO authenticated
  USING (public.is_admin());

-- ============ news_settings (singleton) ============
CREATE TABLE public.news_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  enabled boolean NOT NULL DEFAULT true,
  timezone text NOT NULL DEFAULT 'America/New_York',
  daily_digest_time text NOT NULL DEFAULT '19:00',
  weekly_day integer NOT NULL DEFAULT 1 CHECK (weekly_day BETWEEN 0 AND 6),
  weekly_time text NOT NULL DEFAULT '09:00',
  last_digest_date date,
  last_weekly_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.news_settings TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.news_settings TO authenticated;
ALTER TABLE public.news_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins only news settings"
  ON public.news_settings FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TRIGGER news_settings_updated_at
  BEFORE UPDATE ON public.news_settings
  FOR EACH ROW EXECUTE FUNCTION public.news_touch_updated_at();

INSERT INTO public.news_settings (id) VALUES (true) ON CONFLICT DO NOTHING;