-- Answers exactly one question, with a yes/no shape: does this sign-in link
-- belong to the user who is already signed in? It never returns an email, an
-- id, or any other detail, so a forwarded link cannot be used to learn whose
-- address it was. It also does NOT consume or invalidate the token.
CREATE OR REPLACE FUNCTION public.signin_token_state(_token text, _user_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  owner uuid;
  sent_at timestamptz;
BEGIN
  IF _token IS NULL OR length(_token) < 16 THEN
    RETURN 'invalid';
  END IF;

  SELECT u.id,
         GREATEST(
           COALESCE(u.recovery_sent_at, 'epoch'::timestamptz),
           COALESCE(u.confirmation_sent_at, 'epoch'::timestamptz)
         )
    INTO owner, sent_at
    FROM auth.users u
   WHERE u.recovery_token = _token
      OR u.confirmation_token = _token
   LIMIT 1;

  IF owner IS NULL THEN
    RETURN 'invalid';
  END IF;

  -- GoTrue's default one-time-link lifetime. Past it, verify would refuse
  -- anyway; saying so up front avoids a blank page.
  IF sent_at < now() - interval '1 hour' THEN
    RETURN 'expired';
  END IF;

  IF _user_id IS NOT NULL AND owner = _user_id THEN
    RETURN 'same';
  END IF;

  RETURN 'other';
END;
$$;

REVOKE ALL ON FUNCTION public.signin_token_state(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.signin_token_state(text, uuid) TO service_role;