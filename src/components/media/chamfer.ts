/**
 * Chamfer geometry tokens and helpers.
 *
 * The design rule: any diagonal cut in the layout keeps its strong angle, but
 * every vertex, including the diagonal-to-horizontal and diagonal-to-vertical
 * junctions, is softened with a visible radius. No razor-sharp points.
 *
 * Two numbers describe every chamfer:
 *   cut    how deep the 45 degree slice bites into the box, in px
 *   radius how much each vertex of the resulting polygon is rounded, in px
 *
 * Use a tier rather than a literal pair. Tiers are also mirrored as CSS custom
 * properties in src/styles.css (--chamfer-<tier>-cut / --chamfer-<tier>-radius)
 * for the rare case where CSS needs the same numbers.
 *
 * Tiers
 *   sm    chips, small cards, thumbnails
 *   md    standard content images, three-up rows, decorative planes
 *   lg    feature portraits and wide editorial images
 *   hero  page-dominant photography and full-bleed planes
 *
 * The board's own notch (--notch-sm / --notch-lg, notch.ts) is a separate,
 * older system and is deliberately left alone: `/` must not shift.
 */
import { notchPoints, type NotchCorner } from "@/components/media/notch";

export type ChamferTier = "sm" | "md" | "lg" | "hero";

export type ChamferSpec = { cut: number; radius: number };

export const CHAMFER: Record<ChamferTier, ChamferSpec> = {
  sm: { cut: 20, radius: 8 },
  md: { cut: 40, radius: 12 },
  lg: { cut: 64, radius: 16 },
  hero: { cut: 96, radius: 22 },
};

/** Fractional point, 0..1 of the box, for silhouettes that are not plain chamfers. */
export type ChamferPoint = [number, number];

export type Pt = [number, number];

/**
 * Walk a polygon and emit a path whose vertices are rounded with circular
 * arcs, approximated with quadratic Beziers. Each arc is trimmed to at most
 * half of the shorter adjacent edge so neighbouring arcs never collide.
 */
export function roundedPolygonPath(points: Pt[], radius: number): string {
  const n = points.length;
  if (n < 3 || radius <= 0) {
    return `M ${points.map(([x, y]) => `${x} ${y}`).join(" L ")} Z`;
  }
  const d: string[] = [];

  for (let i = 0; i < n; i++) {
    const prev = points[(i - 1 + n) % n];
    const curr = points[i];
    const next = points[(i + 1) % n];

    const lenIn = Math.hypot(curr[0] - prev[0], curr[1] - prev[1]);
    const lenOut = Math.hypot(next[0] - curr[0], next[1] - curr[1]);
    if (lenIn === 0 || lenOut === 0) continue;
    const t = Math.min(radius, lenIn / 2, lenOut / 2);

    const inX = curr[0] - ((curr[0] - prev[0]) / lenIn) * t;
    const inY = curr[1] - ((curr[1] - prev[1]) / lenIn) * t;
    const outX = curr[0] + ((next[0] - curr[0]) / lenOut) * t;
    const outY = curr[1] + ((next[1] - curr[1]) / lenOut) * t;

    d.push(`${i === 0 ? "M" : "L"} ${inX} ${inY} Q ${curr[0]} ${curr[1]} ${outX} ${outY}`);
  }
  return `${d.join(" ")} Z`;
}

/**
 * Resolve a silhouette for a measured box: either a custom fractional polygon
 * or the standard 45 degree chamfer on the requested corners.
 */
export function chamferPath(args: {
  w: number;
  h: number;
  cut: number;
  radius: number;
  corners: NotchCorner[];
  points?: ChamferPoint[];
}): string {
  const { w, h, cut, radius, corners, points } = args;
  if (w <= 0 || h <= 0) return "";
  // Never let the cut exceed the box: a chamfer deeper than half the short
  // side stops reading as a corner and starts eating the image.
  const safeCut = Math.min(cut, Math.min(w, h) / 2);
  const pts: Pt[] = points
    ? points.map(([fx, fy]) => [fx * w, fy * h] as Pt)
    : notchPoints(w, h, safeCut, corners);
  return roundedPolygonPath(pts, radius);
}
