import type { SupabaseClient } from "@supabase/supabase-js";

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { Database } from "@/integrations/supabase/types";

export const BUCKET = "photos";
export const MAX_BYTES = 10 * 1024 * 1024;

export type PhotoRow = {
  id: string;
  storage_path: string;
  original_name: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
  uploaded_at: string;
};

export type SlotRow = {
  key: string;
  photo_id: string | null;
  updated_at: string | null;
  photo: PhotoRow | null;
};

/** Content-type sniffed from the actual bytes. A .jpg extension on a PDF
 *  fails here, which is the only check that matters. */
export function sniffImageType(bytes: Uint8Array): "image/jpeg" | "image/png" | "image/webp" | null {
  if (bytes.length < 12) return null;
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  )
    return "image/png";
  const ascii = (i: number) => String.fromCharCode(bytes[i]);
  const riff = ascii(0) + ascii(1) + ascii(2) + ascii(3);
  const webp = ascii(8) + ascii(9) + ascii(10) + ascii(11);
  if (riff === "RIFF" && webp === "WEBP") return "image/webp";
  return null;
}

const EXT: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export async function isAdminClient(supabase: SupabaseClient<Database>) {
  const [adminRes, personRes] = await Promise.all([
    supabase.rpc("is_admin"),
    supabase.rpc("current_person_id"),
  ]);
  if (adminRes.error || adminRes.data !== true) return null;
  return { personId: (personRes.data as string | null) ?? null };
}

async function audit(
  actor: string | null,
  action: string,
  recordId: string | null,
  before: unknown,
  after: unknown,
) {
  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: actor,
    action,
    table_name: "photos",
    record_id: recordId,
    before: (before ?? null) as never,
    after: (after ?? null) as never,
  });
}

export async function storePhoto(opts: {
  actor: string | null;
  bytes: Uint8Array;
  originalName: string;
  width: number | null;
  height: number | null;
  alt: string | null;
}): Promise<{ ok: true; photo: PhotoRow } | { ok: false; error: string }> {
  if (opts.bytes.byteLength > MAX_BYTES) return { ok: false, error: "Larger than 10MB." };
  const type = sniffImageType(opts.bytes);
  if (!type) return { ok: false, error: "Not a JPEG, PNG or WebP file." };

  // The uploaded name is never used as a path. A uuid decides where it lands.
  const path = `${crypto.randomUUID()}.${EXT[type]}`;
  const up = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(path, opts.bytes, { contentType: type, upsert: false });
  if (up.error) return { ok: false, error: up.error.message };

  const { data, error } = await supabaseAdmin
    .from("photos")
    .insert({
      storage_path: path,
      original_name: opts.originalName.slice(0, 200),
      alt: opts.alt,
      width: opts.width,
      height: opts.height,
      uploaded_by: opts.actor,
    })
    .select("id, storage_path, original_name, alt, width, height, uploaded_at")
    .single();
  if (error || !data) {
    await supabaseAdmin.storage.from(BUCKET).remove([path]);
    return { ok: false, error: error?.message ?? "Could not record the upload." };
  }
  await audit(opts.actor, "photo_upload", data.id, null, data);
  return { ok: true, photo: data as PhotoRow };
}

export async function listPhotos(): Promise<PhotoRow[]> {
  const { data } = await supabaseAdmin
    .from("photos")
    .select("id, storage_path, original_name, alt, width, height, uploaded_at")
    .order("uploaded_at", { ascending: false });
  return (data ?? []) as PhotoRow[];
}

export async function listSlots(): Promise<SlotRow[]> {
  const { data } = await supabaseAdmin
    .from("photo_slots")
    .select(
      "key, photo_id, updated_at, photos ( id, storage_path, original_name, alt, width, height, uploaded_at )",
    )
    .order("key");
  return ((data ?? []) as unknown as (SlotRow & { photos: PhotoRow | null })[]).map((r) => ({
    key: r.key,
    photo_id: r.photo_id,
    updated_at: r.updated_at,
    photo: r.photos ?? null,
  }));
}

export async function setPhotoAlt(actor: string | null, photoId: string, alt: string) {
  const trimmed = alt.trim().slice(0, 300);
  const { data } = await supabaseAdmin
    .from("photos")
    .update({ alt: trimmed || null })
    .eq("id", photoId)
    .select("id, alt")
    .single();
  await audit(actor, "photo_alt", photoId, null, data);
  return { ok: true };
}

export async function assignSlot(actor: string | null, key: string, photoId: string | null) {
  const { error } = await supabaseAdmin
    .from("photo_slots")
    .update({ photo_id: photoId, updated_by: actor, updated_at: new Date().toISOString() })
    .eq("key", key);
  if (error) return { ok: false as const, error: error.message };
  await audit(actor, "photo_slot_assign", photoId, null, { key, photo_id: photoId });
  return { ok: true as const };
}

export async function deletePhoto(actor: string | null, photoId: string) {
  const { data: used } = await supabaseAdmin
    .from("photo_slots")
    .select("key")
    .eq("photo_id", photoId);
  if (used && used.length > 0) {
    return {
      ok: false as const,
      error: `Assigned to ${used.map((u) => u.key).join(", ")}. Unassign it first.`,
    };
  }
  const { data: row } = await supabaseAdmin
    .from("photos")
    .select("id, storage_path, original_name, alt, width, height, uploaded_at")
    .eq("id", photoId)
    .maybeSingle();
  if (!row) return { ok: false as const, error: "Already gone." };
  await supabaseAdmin.storage.from(BUCKET).remove([row.storage_path]);
  await supabaseAdmin.from("photos").delete().eq("id", photoId);
  await audit(actor, "photo_delete", photoId, row, null);
  return { ok: true as const };
}
