-- ============================================================
-- ONE-OFF ADMIN BOOTSTRAP (idempotent).
--
-- !!! THE SAMPLE ADMIN GRANTS AT THE BOTTOM OF THIS MIGRATION MUST BE
-- !!! DELETED AFTER THE REAL ROSTER IMPORT. They exist only so /admin is
-- !!! testable before the real people rows (nick-kaczmarek,
-- !!! william-brotman, reed-verdesoto) are loaded.
--
-- Delete with:
--   DELETE FROM public.admins a USING public.people p
--   WHERE a.person_id = p.id AND p.seed_id LIKE 'sample-%';
-- ============================================================

-- Real organizers. Note: Brody Brotman's record is 'william-brotman'.
INSERT INTO public.admins (person_id)
SELECT p.id
FROM public.people p
WHERE p.seed_id IN ('nick-kaczmarek', 'william-brotman', 'reed-verdesoto')
ON CONFLICT (person_id) DO NOTHING;

-- TEMPORARY sample admins (see banner above).
INSERT INTO public.admins (person_id)
SELECT p.id
FROM (
  SELECT id FROM public.people ORDER BY member_no DESC LIMIT 3
) p
ON CONFLICT (person_id) DO NOTHING;