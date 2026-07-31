-- 1. assistant_coach becomes a valid stint role
ALTER TABLE public.stints DROP CONSTRAINT IF EXISTS stints_role_check;
ALTER TABLE public.stints ADD CONSTRAINT stints_role_check
  CHECK (role = ANY (ARRAY['player'::text, 'captain'::text, 'coach'::text, 'assistant_coach'::text, 'manager'::text]));

-- 2. duplicate_rulings is server-side only, matching sends/suppressions/etc.
REVOKE ALL ON public.duplicate_rulings FROM anon;
REVOKE ALL ON public.duplicate_rulings FROM authenticated;
GRANT ALL ON public.duplicate_rulings TO service_role;

-- 3. Short-lived reuse cache for sign-in links
CREATE TABLE IF NOT EXISTS public.magic_link_issues (
  email TEXT PRIMARY KEY,
  person_id UUID REFERENCES public.people(id) ON DELETE SET NULL,
  link TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

REVOKE ALL ON public.magic_link_issues FROM anon;
REVOKE ALL ON public.magic_link_issues FROM authenticated;
GRANT ALL ON public.magic_link_issues TO service_role;
ALTER TABLE public.magic_link_issues ENABLE ROW LEVEL SECURITY;
