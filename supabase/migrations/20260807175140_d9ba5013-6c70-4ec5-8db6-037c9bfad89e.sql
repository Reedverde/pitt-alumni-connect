ALTER TABLE public.rsvps DROP CONSTRAINT IF EXISTS rsvps_src_check;
ALTER TABLE public.rsvps ADD CONSTRAINT rsvps_src_check CHECK (
  src IS NULL OR src = ANY (ARRAY[
    'text','email','discord','groupme_a','groupme_b','facebook','instagram','x','esn','qr',
    -- retired values, kept only so historical rows remain valid
    'groupme','groupme_alumni','groupme_all','website'
  ])
);