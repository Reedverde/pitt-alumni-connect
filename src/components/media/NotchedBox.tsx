import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { NOTCH_SM, type NotchCorner } from "./notch";
import { chamferPath } from "./chamfer";

type NotchedBoxProps = {
  corners?: NotchCorner[];
  notch?: number;
  /** Outline colour. Omit for no outline. */
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  /** Draw the outline above the content, so a clipped photo cannot cover it. */
  strokeOnTop?: boolean;
  /** Background fill, clipped to the shaped silhouette. */
  fill?: string;
  /**
   * Clip the children to the shape. Needed for images, which would otherwise
   * keep square corners and hide the cut. Off by default: on a text tile the
   * diagonal cuts into the first glyph of the top-left line.
   */
  clipContent?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * A container with 45 degree corner cuts and softened vertices.
 *
 * One shape language: the angle stays strong, but every vertex is rounded, the
 * same rule the chamfer tiers follow. The outline is an SVG path, not a CSS
 * border, because clip-path would eat a border along the diagonal.
 */
export function NotchedBox({
  corners = ["tl"],
  notch = NOTCH_SM,
  stroke,
  strokeWidth = 1.5,
  dashed = false,
  strokeOnTop = false,
  fill,
  clipContent = false,
  className,
  style,
  children,
}: NotchedBoxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Softened vertices scale with the cut, so a small tile and a large plane
  // read as the same family rather than two different shapes.
  const radius = notch <= 20 ? 8 : notch <= 48 ? 12 : 16;
  const measured = size.w > 0 && size.h > 0;
  const clipD = measured
    ? chamferPath({ w: size.w, h: size.h, cut: notch, radius, corners })
    : "";
  const clipPath = clipD ? `path("${clipD}")` : undefined;

  const inset = strokeWidth / 2;
  // Keep content out of the removed triangles: a cut corner pushes its two
  // sides in by the notch size. Uncut sides keep their normal padding.
  const cut = (c: NotchCorner) => corners.includes(c);
  const contentPad = clipContent
    ? undefined
    : {
        paddingTop: cut("tl") || cut("tr") ? notch : undefined,
        paddingRight: cut("tr") || cut("br") ? notch : undefined,
        paddingBottom: cut("bl") || cut("br") ? notch : undefined,
        paddingLeft: cut("tl") || cut("bl") ? notch : undefined,
      };

  const showOutline = Boolean(stroke) && size.w > notch * 2 && size.h > notch * 2;
  const outlineD = showOutline
    ? chamferPath({
        w: size.w - strokeWidth,
        h: size.h - strokeWidth,
        cut: notch,
        radius,
        corners,
      })
    : "";

  const outline = outlineD ? (
    <svg
      aria-hidden="true"
      width={size.w}
      height={size.h}
      viewBox={`0 0 ${size.w} ${size.h}`}
      style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
    >
      <path
        d={outlineD}
        transform={`translate(${inset} ${inset})`}
        fill="none"
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeDasharray={dashed ? "6 5" : undefined}
      />
    </svg>
  ) : null;

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      {fill && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: fill, clipPath }} />
      )}
      {!strokeOnTop && outline}
      <div
        style={{
          position: "relative",
          height: "100%",
          boxSizing: "border-box",
          clipPath: clipContent ? clipPath : undefined,
          ...contentPad,
        }}
      >
        {children}
      </div>
      {strokeOnTop && outline}
    </div>
  );
}
