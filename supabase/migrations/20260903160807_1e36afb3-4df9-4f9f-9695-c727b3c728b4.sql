UPDATE public.rsvps SET src = 'groupme' WHERE src IN ('groupme_a','groupme_b','groupme_alumni','groupme_all');
UPDATE public.rsvps SET src = NULL WHERE src = 'website';

ALTER TABLE public.rsvps DROP CONSTRAINT IF EXISTS rsvps_src_check;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_src_check CHECK (
  src IS NULL OR src = ANY (ARRAY['text','email','discord','groupme','facebook','instagram','x','esn','qr'])
);