UPDATE public.sequences SET audience_states = ARRAY['unclaimed','claimed','maybe'] WHERE key = 't_minus_28';
UPDATE public.sequences SET audience_states = ARRAY['maybe'] WHERE key = 't_minus_21';