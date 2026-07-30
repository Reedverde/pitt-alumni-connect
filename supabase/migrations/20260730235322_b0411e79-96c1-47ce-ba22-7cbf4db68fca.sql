CREATE TABLE public.duplicate_rulings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  person_a_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  person_b_id uuid NOT NULL REFERENCES public.people(id) ON DELETE CASCADE,
  ruling text NOT NULL CHECK (ruling IN ('keep_separate','merged')),
  ruled_by uuid REFERENCES public.people(id) ON DELETE SET NULL,
  ruled_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT duplicate_rulings_pair_order CHECK (person_a_id < person_b_id),
  CONSTRAINT duplicate_rulings_pair_unique UNIQUE (person_a_id, person_b_id)
);

GRANT ALL ON public.duplicate_rulings TO service_role;

ALTER TABLE public.duplicate_rulings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read duplicate rulings" ON public.duplicate_rulings
  FOR SELECT TO authenticated USING (public.is_admin());
CREATE POLICY "Admins insert duplicate rulings" ON public.duplicate_rulings
  FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update duplicate rulings" ON public.duplicate_rulings
  FOR UPDATE TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());
CREATE POLICY "Admins delete duplicate rulings" ON public.duplicate_rulings
  FOR DELETE TO authenticated USING (public.is_admin());

CREATE OR REPLACE FUNCTION public.touch_duplicate_rulings_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

REVOKE ALL ON FUNCTION public.touch_duplicate_rulings_updated_at() FROM PUBLIC, anon, authenticated;

CREATE TRIGGER update_duplicate_rulings_updated_at
  BEFORE UPDATE ON public.duplicate_rulings
  FOR EACH ROW EXECUTE FUNCTION public.touch_duplicate_rulings_updated_at();

INSERT INTO public.duplicate_rulings (person_a_id, person_b_id, ruling, ruled_by, note)
SELECT LEAST(a, b), GREATEST(a, b), 'keep_separate',
       '3fcf7db0-a4c0-4b06-b71c-3d319f8fb6ba'::uuid,
       'Confirmed distinct by Reed, 2026-07-30, against the esnultimate.org alumni page'
FROM (VALUES
  ('3c9f2325-2d54-4a27-ab7f-ac509db91947'::uuid, 'c1893070-cbf9-4568-a98a-bd3c90f045e1'::uuid),
  ('99d816d8-739c-4052-a1ba-ebaf4d08e110'::uuid, '079bee5b-a19d-42ce-b57a-051f5fbdd184'::uuid),
  ('f8ef8af5-ec5c-4879-98f0-131fe4517959'::uuid, '267f4adf-17b3-4dbb-90f1-7a15538ebefc'::uuid),
  ('a2b1c082-2dea-4696-9a2c-164eae033845'::uuid, '7b1c9e4b-bbff-430f-96a3-99dd5cce8063'::uuid),
  ('86aaff49-1465-45b9-b59f-fd44d0ecc7d7'::uuid, '4360dec8-a8ec-4836-8af9-053c12710e88'::uuid)
) AS v(a, b)
ON CONFLICT (person_a_id, person_b_id) DO NOTHING;