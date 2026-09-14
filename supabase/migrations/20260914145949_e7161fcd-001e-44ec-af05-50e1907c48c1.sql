CREATE OR REPLACE FUNCTION public.claim_campaign_send(_person_id uuid, _sequence_id uuid, _to_email text, _kind text, _event_year integer, _cap integer DEFAULT 7, _cooldown_days integer DEFAULT 10, _skip_cooldown boolean DEFAULT false)
 RETURNS TABLE(outcome text, send_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  addr text := lower(btrim(coalesce(_to_email, '')));
  existing uuid;
  cap_used integer;
  new_id uuid;
BEGIN
  IF _person_id IS NULL OR _sequence_id IS NULL OR addr = '' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

  -- Serialize every claim for one person within one edition, whatever the
  -- sequence. Without this, two different sequences could each read six
  -- existing campaigns and both insert, landing at eight.
  PERFORM pg_advisory_xact_lock(
    hashtext('campaign_send:' || _person_id::text || ':' || coalesce(_event_year, -1)::text)
  );

  SELECT s.id INTO existing FROM public.sends s
   WHERE s.person_id = _person_id AND s.sequence_id = _sequence_id LIMIT 1;
  IF existing IS NOT NULL THEN
    RETURN QUERY SELECT 'already_sent'::text, existing; RETURN;
  END IF;

  SELECT count(*) INTO cap_used FROM public.sends s
   WHERE s.person_id = _person_id
     AND s.sequence_id IS NOT NULL
     AND s.outcome IN ('sent','claimed')
     AND s.event_year IS NOT DISTINCT FROM _event_year;
  IF cap_used >= _cap THEN
    RETURN QUERY SELECT 'over_cap'::text, NULL::uuid; RETURN;
  END IF;

  IF NOT _skip_cooldown AND EXISTS (
    SELECT 1 FROM public.sends s
     WHERE s.person_id = _person_id
       AND s.sequence_id IS NOT NULL
       AND s.outcome IN ('sent','claimed')
       AND s.created_at >= now() - make_interval(days => greatest(_cooldown_days, 0))
  ) THEN
    RETURN QUERY SELECT 'cooldown'::text, NULL::uuid; RETURN;
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sends s
     WHERE s.sequence_id = _sequence_id
       AND lower(btrim(s.to_email)) = addr
       AND s.outcome IN ('sent','claimed')
  ) THEN
    RETURN QUERY SELECT 'duplicate_mailbox'::text, NULL::uuid; RETURN;
  END IF;

  BEGIN
    INSERT INTO public.sends
      (person_id, sequence_id, kind, to_email, provider, status, outcome, error, event_year)
    VALUES
      (_person_id, _sequence_id, _kind, addr, 'none', 'claimed', 'claimed', NULL, _event_year)
    ON CONFLICT (person_id, sequence_id) DO NOTHING
    RETURNING id INTO new_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN QUERY SELECT 'duplicate_mailbox'::text, NULL::uuid; RETURN;
  END;

  IF new_id IS NULL THEN
    SELECT s.id INTO existing FROM public.sends s
     WHERE s.person_id = _person_id AND s.sequence_id = _sequence_id LIMIT 1;
    RETURN QUERY SELECT 'already_sent'::text, existing; RETURN;
  END IF;

  RETURN QUERY SELECT 'claimed'::text, new_id;
END $function$;

REVOKE ALL ON FUNCTION public.claim_campaign_send(uuid, uuid, text, text, integer, integer, integer, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_send(uuid, uuid, text, text, integer, integer, integer, boolean) TO service_role;