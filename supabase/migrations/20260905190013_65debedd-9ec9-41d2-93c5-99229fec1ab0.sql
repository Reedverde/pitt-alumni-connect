CREATE TABLE public.current_status_overrides (
  person_id uuid PRIMARY KEY REFERENCES public.people(id) ON DELETE CASCADE,
  is_current boolean NOT NULL DEFAULT false,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.current_status_overrides TO authenticated;
GRANT ALL ON public.current_status_overrides TO service_role;

ALTER TABLE public.current_status_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage current status overrides"
  ON public.current_status_overrides FOR ALL
  TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_current_status_overrides()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER touch_current_status_overrides
  BEFORE UPDATE ON public.current_status_overrides
  FOR EACH ROW EXECUTE FUNCTION public.touch_current_status_overrides();

CREATE OR REPLACE VIEW public.current_people AS
SELECT person_id FROM (
  SELECT DISTINCT s.person_id
    FROM stints s
   WHERE s.year = (SELECT max(stints.year) FROM stints)
  UNION
  SELECT DISTINCT i.person_id
    FROM identities i
   WHERE lower(i.email) LIKE '%@pitt.edu'
     AND EXISTS (SELECT 1 FROM sends sn
                  WHERE lower(sn.to_email) = lower(i.email)
                    AND sn.provider_message_id IS NOT NULL
                    AND sn.status = 'sent')
     AND NOT EXISTS (SELECT 1 FROM suppressions su
                      WHERE su.email = lower(btrim(i.email)))
) c
WHERE NOT EXISTS (
  SELECT 1 FROM public.current_status_overrides o
   WHERE o.person_id = c.person_id AND o.is_current = false
);