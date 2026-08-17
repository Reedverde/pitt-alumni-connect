ALTER TABLE public.news_items
  ADD COLUMN IF NOT EXISTS discord_posted_at timestamptz,
  ADD COLUMN IF NOT EXISTS discord_message_id text,
  ADD COLUMN IF NOT EXISTS discord_delivery_status text NOT NULL DEFAULT 'not_sent',
  ADD COLUMN IF NOT EXISTS discord_delivery_error text;

ALTER TABLE public.news_items
  DROP CONSTRAINT IF EXISTS news_items_discord_delivery_status_check;

ALTER TABLE public.news_items
  ADD CONSTRAINT news_items_discord_delivery_status_check
  CHECK (discord_delivery_status IN ('not_sent','sent','failed'));