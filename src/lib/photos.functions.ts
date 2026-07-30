import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { PhotoRow, SlotRow } from "./photos.server";

export type PhotoLibrary = { isAdmin: boolean; photos: PhotoRow[]; slots: SlotRow[] };

export const getPhotoLibrary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PhotoLibrary> => {
    const mod = await import("./photos.server");
    const actor = await mod.isAdminClient(context.supabase);
    if (!actor) return { isAdmin: false, photos: [], slots: [] };
    const [photos, slots] = await Promise.all([mod.listPhotos(), mod.listSlots()]);
    return { isAdmin: true, photos, slots };
  });

export const updatePhotoAlt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { photoId: string; alt: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./photos.server");
    const actor = await mod.isAdminClient(context.supabase);
    if (!actor) return { ok: false, error: "Not allowed." };
    return mod.setPhotoAlt(actor.personId, data.photoId, String(data.alt ?? ""));
  });

export const assignPhotoSlot = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string; photoId: string | null }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./photos.server");
    const actor = await mod.isAdminClient(context.supabase);
    if (!actor) return { ok: false, error: "Not allowed." };
    return mod.assignSlot(actor.personId, data.key, data.photoId);
  });

export const removePhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { photoId: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./photos.server");
    const actor = await mod.isAdminClient(context.supabase);
    if (!actor) return { ok: false, error: "Not allowed." };
    return mod.deletePhoto(actor.personId, data.photoId);
  });
