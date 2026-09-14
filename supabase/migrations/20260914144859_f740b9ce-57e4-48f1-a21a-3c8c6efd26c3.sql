ALTER TABLE public.sends ADD COLUMN IF NOT EXISTS event_year integer;

UPDATE public.sends
   SET event_year = public.current_edition_year()
 WHERE event_year IS NULL
   AND (sequence_id IS NOT NULL OR kind LIKE 'drip:%' OR kind LIKE 'campaign:%' OR kind LIKE 'resend:%');

ALTER TABLE public.sends DROP CONSTRAINT IF EXISTS sends_outcome_check;
ALTER TABLE public.sends ADD CONSTRAINT sends_outcome_check
  CHECK (outcome = ANY (ARRAY['sent','blocked','failed','suppressed','claimed']));

CREATE INDEX IF NOT EXISTS sends_person_campaign_year_idx
  ON public.sends (person_id, event_year)
  WHERE sequence_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS sends_person_campaign_recent_idx
  ON public.sends (person_id, created_at)
  WHERE sequence_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS sends_sequence_mailbox_uniq
  ON public.sends (sequence_id, lower(btrim(to_email)))
  WHERE sequence_id IS NOT NULL AND outcome IN ('sent','claimed');

-- Reserve a recipient before the provider is ever called. Every refusal is
-- named so the dispatcher can report it accurately.
CREATE OR REPLACE FUNCTION public.claim_campaign_send(
  _person_id uuid,
  _sequence_id uuid,
  _to_email text,
  _kind text,
  _event_year integer,
  _cap integer DEFAULT 7,
  _cooldown_days integer DEFAULT 10,
  _skip_cooldown boolean DEFAULT false
) RETURNS TABLE(outcome text, send_id uuid)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  addr text := lower(btrim(coalesce(_to_email, '')));
  existing uuid;
  cap_used integer;
  new_id uuid;
BEGIN
  IF _person_id IS NULL OR _sequence_id IS NULL OR addr = '' THEN
    RETURN QUERY SELECT 'invalid'::text, NULL::uuid; RETURN;
  END IF;

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
END $$;

-- Records what the provider said on an already-reserved row. Never inserts.
CREATE OR REPLACE FUNCTION public.finalize_campaign_send(
  _send_id uuid,
  _status text,
  _provider text,
  _message_id text,
  _error text
) RETURNS text
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  final_outcome text;
BEGIN
  final_outcome := CASE
    WHEN _status IN ('sent','delivered') THEN 'sent'
    WHEN _status = 'blocked' THEN 'blocked'
    WHEN _status IN ('suppressed','throttled') THEN 'suppressed'
    ELSE 'failed' END;

  UPDATE public.sends
     SET status = _status,
         provider = coalesce(_provider, provider),
         provider_message_id = _message_id,
         error = _error,
         outcome = final_outcome,
         blocked_reason = CASE WHEN final_outcome = 'sent' THEN NULL ELSE _error END,
         sent_at = CASE WHEN final_outcome = 'sent' THEN now() ELSE sent_at END
   WHERE id = _send_id;

  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  RETURN final_outcome;
END $$;

CREATE OR REPLACE VIEW public.campaign_send_counts
WITH (security_invoker = on) AS
  SELECT s.person_id,
         s.event_year,
         count(*)::int AS campaign_sends,
         max(s.created_at) AS last_campaign_at
    FROM public.sends s
   WHERE s.sequence_id IS NOT NULL
     AND s.person_id IS NOT NULL
     AND s.outcome IN ('sent','claimed')
   GROUP BY s.person_id, s.event_year;

REVOKE ALL ON FUNCTION public.claim_campaign_send(uuid, uuid, text, text, integer, integer, integer, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.finalize_campaign_send(uuid, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_campaign_send(uuid, uuid, text, text, integer, integer, integer, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.finalize_campaign_send(uuid, text, text, text, text) TO service_role;
REVOKE ALL ON public.campaign_send_counts FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.campaign_send_counts TO service_role;