DELETE FROM public.rsvps
WHERE event_year = 2026
  AND person_id = (SELECT person_id FROM public.identities WHERE email = 'partysize.test@example.com');

DELETE FROM public.identities WHERE email = 'partysize.test@example.com';