SELECT setval(
  pg_get_serial_sequence('public.people', 'member_no'),
  (SELECT COALESCE(MAX(member_no), 0) + 1 FROM public.people),
  false
);