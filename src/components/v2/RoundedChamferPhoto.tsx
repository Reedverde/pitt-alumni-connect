import { useEffect, useId, useRef, useState } from "react";

import { notchPoints, NOTCH_ALL, type NotchCorner } from "@/components/media/notch";

type Pt = [number, number];

/**
 * Walk a polygon and emit a path whose vertices are rounded with circular
 * arcs. Every corner of the silhouette, including the diagonal-to-horizontal
 * junctions of a chamfer, gets the same visible radius instead of a
 * razor-sharp point. Arcs are approximated with quadratic Béziers, which is
 * visually exact at these radii and keeps the path trivially inspectable.
 */
function roundedPolygonPath(points: Pt[], radius: number): string {
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
    // Trim distance along each edge, capped so neighbouring arcs never meet.
    const t = Math.min(radius, lenIn / 2, lenOut / 2);

    const inX = curr[0] - ((curr[0] - prev[0]) / lenIn) * t;
    const inY = curr[1] - ((curr[1] - prev[1]) / lenIn) * t;
    const outX = curr[0] + ((next[0] - curr[0]) / lenOut) * t;
    const outY = curr[1] + ((next[1] - curr[1]) / lenOut) * t;

    d.push(`${i === 0 ? "M" : "L"} ${inX} ${inY} Q ${curr[0]} ${curr[1]} ${outX} ${outY}`);
  }
  return `${d.join(" ")} Z`;
}

type RoundedChamferPhotoProps = {
  src: string;
  alt: string;
  /** Reserved box, e.g. "4 / 3". Prevents layout shift. */
  ratio?: string;
  /** Chamfer depth in px. The diagonal cuts stay; only their points soften. */
  notch?: number;
  /** Corner radius in px, applied to every vertex of the silhouette. */
  radius?: number;
  corners?: NotchCorner[];
  position?: string;
  className?: string;
};

/**
 * A photograph with bold angled chamfers whose vertices are rounded. Plain
 * border-radius cannot express this (it rounds a rectangle, not a polygon),
 * so the silhouette is an SVG clip path recomputed from the measured box.
 */
export function RoundedChamferPhoto({
  src,
  alt,
  ratio = "4 / 3",
  notch = 40,
  radius = 16,
  corners = NOTCH_ALL,
  position,
  className,
}: RoundedChamferPhotoProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const clipId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const path =
    size.w > 0 && size.h > 0
      ? roundedPolygonPath(notchPoints(size.w, size.h, notch, corners), radius)
      : "";

  return (
    <figure className={className} style={{ margin: 0 }}>
      <div ref={ref} style={{ position: "relative", width: "100%", aspectRatio: ratio }}>
        {path && (
          <svg aria-hidden="true" width={0} height={0} style={{ position: "absolute" }}>
            <defs>
              <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
                <path d={path} />
              </clipPath>
            </defs>
          </svg>
        )}
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: position,
            clipPath: path ? `url(#${clipId})` : undefined,
          }}
        />
      </div>
    </figure>
  );
}
