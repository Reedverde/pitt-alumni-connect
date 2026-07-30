import { useQuery } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";

/** The five picture seats in the layout. Adding one is a row in photo_slots. */
export const SLOT_LABELS: Record<string, string> = {
  why_founding_1998: "Founding, 1998",
  why_back_to_back_2013: "Back to back, 2013",
  why_return_2026: "The return, 2026",
  why_statement_card: "Statement card",
  weekend_hero: "Weekend hero",
};

export type SlotPhoto = {
  id: string;
  storage_path: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  original_name: string | null;
};

/** Images live in a private bucket and are streamed by a public app route,
 *  so there is no signed URL and no expiry to manage. */
export function photoUrl(storagePath: string) {
  return `/api/public/photo/${storagePath}`;
}

export async function fetchSlotMap(): Promise<Record<string, SlotPhoto | null>> {
  const { data } = await supabase
    .from("photo_slots")
    .select("key, photos ( id, storage_path, alt, width, height, original_name )");
  const map: Record<string, SlotPhoto | null> = {};
  for (const row of data ?? []) {
    const photo = (row as unknown as { photos: SlotPhoto | SlotPhoto[] | null }).photos;
    map[row.key] = Array.isArray(photo) ? (photo[0] ?? null) : photo;
  }
  return map;
}

export function usePhotoSlots() {
  return useQuery({
    queryKey: ["photo-slots"],
    queryFn: fetchSlotMap,
    staleTime: 60_000,
  });
}
