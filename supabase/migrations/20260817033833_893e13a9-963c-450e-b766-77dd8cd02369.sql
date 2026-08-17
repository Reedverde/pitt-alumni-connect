CREATE TABLE public.internal_secrets (
  key text PRIMARY KEY,
  value_hash text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_secrets TO service_role;
ALTER TABLE public.internal_secrets ENABLE ROW LEVEL SECURITY;
-- Deliberately no policies: nothing but trusted server code may read this.

INSERT INTO public.internal_secrets (key, value_hash)
VALUES ('news_cron_token', '07973963eea17a0a82e94fd7171f4eced56ff45308a50f476542373917e5d0dc');