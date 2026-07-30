ALTER TABLE public.sends
  ADD COLUMN IF NOT EXISTS outcome text NOT NULL DEFAULT 'sent',
  ADD COLUMN IF NOT EXISTS blocked_reason text NULL;

UPDATE public.sends SET
  outcome = CASE
    WHEN status IN ('sent','delivered') THEN 'sent'
    WHEN status = 'blocked' THEN 'blocked'
    WHEN status IN ('suppressed','throttled') THEN 'suppressed'
    ELSE 'failed'
  END,
  blocked_reason = CASE WHEN status IN ('blocked','throttled','suppressed') THEN error ELSE blocked_reason END;

ALTER TABLE public.sends
  ADD CONSTRAINT sends_outcome_check CHECK (outcome IN ('sent','blocked','failed','suppressed'));

CREATE INDEX IF NOT EXISTS sends_outcome_idx ON public.sends (outcome, created_at DESC);

CREATE TABLE IF NOT EXISTS public.confirmation_sends (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  event_year integer NOT NULL,
  status text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (person_id, event_year, status)
);

GRANT ALL ON public.confirmation_sends TO service_role;
ALTER TABLE public.confirmation_sends ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read confirmation sends"
  ON public.confirmation_sends FOR SELECT TO authenticated
  USING (public.is_admin());