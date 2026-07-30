ALTER TABLE public.duplicate_rulings
  DROP CONSTRAINT duplicate_rulings_person_a_id_fkey,
  DROP CONSTRAINT duplicate_rulings_person_b_id_fkey;