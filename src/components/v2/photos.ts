import type { BoardPhoto } from "@/lib/board.functions";
import { photoUrl } from "@/lib/photo-slots";

export type V2Photo = { src: string; alt: string; year: number };

/**
 * Picks a real photograph off the board data, trying each candidate year in
 * order. Nothing is invented: if a year has no upload the module simply falls
 * through to the next candidate, and renders nothing when none exist.
 */
export function pickV2Photo(
  photos: Record<string, BoardPhoto>,
  candidates: number[],
): V2Photo | null {
  for (const year of candidates) {
    const photo = photos[String(year)];
    if (!photo) continue;
    return {
      src: photoUrl(photo.storage_path),
      alt: (photo.alt ?? "").trim() || `Pitt Ultimate, ${year}`,
      year,
    };
  }
  return null;
}

/** Any remaining year, newest first, so a module always has something real. */
export function anyV2Photo(
  photos: Record<string, BoardPhoto>,
  exclude: number[] = [],
): V2Photo | null {
  const years = Object.keys(photos)
    .map(Number)
    .filter((y) => !exclude.includes(y))
    .sort((a, b) => b - a);
  return pickV2Photo(photos, years);
}
