CREATE TABLE public.throttle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bucket text NOT NULL,
  kind text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX throttle_events_kind_bucket_created_idx
  ON public.throttle_events (kind, bucket, created_at DESC);

GRANT ALL ON public.throttle_events TO service_role;

ALTER TABLE public.throttle_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.suggestions ALTER COLUMN submitted_by DROP NOT NULL;