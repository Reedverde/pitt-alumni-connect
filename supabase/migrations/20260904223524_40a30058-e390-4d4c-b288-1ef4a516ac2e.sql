CREATE TABLE public.profile_reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  outcome text NOT NULL CHECK (outcome IN ('confirmed', 'correction_pending')),
  source text NOT NULL DEFAULT 'unknown',
  suggestion_id uuid REFERENCES public.suggestions(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.profile_reviews TO authenticated;
GRANT ALL ON public.profile_reviews TO service_role;

ALTER TABLE public.profile_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners can read their own profile reviews"
ON public.profile_reviews FOR SELECT TO authenticated
USING (person_id = public.current_person_id());

CREATE POLICY "Admins can read all profile reviews"
ON public.profile_reviews FOR SELECT TO authenticated
USING (public.is_admin());

CREATE INDEX profile_reviews_person_created_idx
ON public.profile_reviews (person_id, created_at DESC);