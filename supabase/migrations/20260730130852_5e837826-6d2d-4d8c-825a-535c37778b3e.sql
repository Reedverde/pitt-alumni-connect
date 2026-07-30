ALTER TABLE public.editions
  ADD COLUMN IF NOT EXISTS lodging_note text,
  ADD COLUMN IF NOT EXISTS travel_note text;