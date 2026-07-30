ALTER TABLE public.identities ADD COLUMN IF NOT EXISTS primary_set_manually_at timestamptz;

CREATE OR REPLACE FUNCTION public.promote_verified_primary(_identity_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _person uuid;
  _verified timestamptz;
  _manual_exists boolean;
BEGIN
  SELECT person_id, verified_at INTO _person, _verified
  FROM public.identities WHERE id = _identity_id;

  IF _person IS NULL OR _verified IS NULL THEN
    RETURN false; -- never promote an unverified address
  END IF;

  -- lock the person's rows for the length of the transaction
  PERFORM 1 FROM public.identities WHERE person_id = _person FOR UPDATE;

  SELECT EXISTS (
    SELECT 1 FROM public.identities
    WHERE person_id = _person AND is_primary AND primary_set_manually_at IS NOT NULL
      AND id <> _identity_id
  ) INTO _manual_exists;

  IF _manual_exists THEN
    RETURN false; -- a manual choice outranks automatic promotion
  END IF;

  UPDATE public.identities
     SET is_primary = false
   WHERE person_id = _person AND is_primary AND id <> _identity_id;

  UPDATE public.identities
     SET is_primary = true
   WHERE id = _identity_id AND NOT is_primary;

  RETURN true;
END;
$$;

REVOKE ALL ON FUNCTION public.promote_verified_primary(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.promote_verified_primary(uuid) TO service_role;

-- Backfill: most recently verified address wins, only for people who have one.
WITH winner AS (
  SELECT DISTINCT ON (person_id) person_id, id
  FROM public.identities
  WHERE verified_at IS NOT NULL
  ORDER BY person_id, verified_at DESC, created_at DESC, id
)
UPDATE public.identities i
   SET is_primary = (i.id = w.id)
  FROM winner w
 WHERE i.person_id = w.person_id
   AND i.is_primary <> (i.id = w.id);