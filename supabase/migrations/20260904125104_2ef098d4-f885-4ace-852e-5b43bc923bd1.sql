ALTER TABLE public.events ADD COLUMN prompt_rsvp boolean NOT NULL DEFAULT false;

UPDATE public.events
SET prompt_rsvp = true
WHERE event_year = 2026
  AND title IN ('Whole-program family BBQ', 'Alumni Game');