
CREATE OR REPLACE VIEW public.current_people AS
  SELECT DISTINCT s.person_id
  FROM public.stints s
  WHERE s.year = (SELECT max(year) FROM public.stints)
  UNION
  SELECT DISTINCT i.person_id
  FROM public.identities i
  WHERE lower(i.email) LIKE '%@pitt.edu'
    AND EXISTS (
      SELECT 1 FROM public.sends sn
      WHERE lower(sn.to_email) = lower(i.email)
        AND sn.provider_message_id IS NOT NULL
        AND sn.status = 'sent'
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.suppressions su WHERE su.email = lower(btrim(i.email))
    );

DROP FUNCTION IF EXISTS public.current_roster_year();
