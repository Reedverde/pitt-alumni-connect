CREATE TABLE public.auth_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_attempted text NOT NULL,
  person_id uuid NULL REFERENCES public.people(id) ON DELETE SET NULL,
  outcome text NOT NULL,
  detail text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX auth_attempts_created_at_idx ON public.auth_attempts (created_at DESC);

GRANT SELECT ON public.auth_attempts TO authenticated;
GRANT ALL ON public.auth_attempts TO service_role;

ALTER TABLE public.auth_attempts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "auth_attempts admin read only"
  ON public.auth_attempts
  FOR SELECT
  TO authenticated
  USING (public.is_admin());