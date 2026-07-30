/**
 * Shared geometry for the 45-degree corner notch.
 *
 * clip-path clips borders, so an outline for a notched box must be drawn as an
 * SVG polygon (see NotchedBox) rather than a CSS border.
 */
export type NotchCorner = "tl" | "tr" | "bl" | "br";

export const NOTCH_SM = 16;
export const NOTCH_LG = 28;

/** Photographs are cut on all four corners: the frame reads as an octagon. */
export const NOTCH_ALL: NotchCorner[] = ["tl", "tr", "br", "bl"];

/** Points, in pixels, walking the notched outline clockwise from top-left. */
export function notchPoints(w: number, h: number, n: number, corners: NotchCorner[]) {
  const has = (c: NotchCorner) => corners.includes(c);
  const pts: Array<[number, number]> = [];

  if (has("tl")) pts.push([0, n], [n, 0]);
  else pts.push([0, 0]);

  if (has("tr")) pts.push([w - n, 0], [w, n]);
  else pts.push([w, 0]);

  if (has("br")) pts.push([w, h - n], [w - n, h]);
  else pts.push([w, h]);

  if (has("bl")) pts.push([n, h], [0, h - n]);
  else pts.push([0, h]);

  return pts;
}

/** Percent-free clip-path using the same geometry, safe for any box size. */
export function notchClipPath(n: number, corners: NotchCorner[]) {
  const has = (c: NotchCorner) => corners.includes(c);
  const p: string[] = [];
  const px = `${n}px`;

  if (has("tl")) p.push(`0 ${px}`, `${px} 0`);
  else p.push("0 0");

  if (has("tr")) p.push(`calc(100% - ${px}) 0`, `100% ${px}`);
  else p.push("100% 0");

  if (has("br")) p.push(`100% calc(100% - ${px})`, `calc(100% - ${px}) 100%`);
  else p.push("100% 100%");

  if (has("bl")) p.push(`${px} 100%`, `0 calc(100% - ${px})`);
  else p.push("0 100%");

  return `polygon(${p.join(", ")})`;
}