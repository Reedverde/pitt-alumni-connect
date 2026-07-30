import { useEffect, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";

import { NOTCH_SM, notchClipPath, notchPoints, type NotchCorner } from "./notch";

type NotchedBoxProps = {
  corners?: NotchCorner[];
  notch?: number;
  /** Outline colour. Omit for no outline. */
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
  /** Background fill, clipped to the notched shape. */
  fill?: string;
  /**
   * Clip the children to the notched shape. Needed for images, which would
   * otherwise keep square corners and hide the notch. Off by default: on a
   * text tile the diagonal cuts into the first glyph of the top-left line.
   */
  clipContent?: boolean;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * A container with 45-degree corner cuts. The outline is an SVG polygon, not a
 * CSS border, because clip-path would eat the border along the diagonal.
 */
export function NotchedBox({
  corners = ["tl"],
  notch = NOTCH_SM,
  stroke,
  strokeWidth = 1.5,
  dashed = false,
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

  const clipPath = notchClipPath(notch, corners);
  const inset = strokeWidth / 2;
  const showOutline = Boolean(stroke) && size.w > notch * 2 && size.h > notch * 2;
  const points = showOutline
    ? notchPoints(size.w - strokeWidth, size.h - strokeWidth, notch, corners)
        .map(([x, y]) => `${x + inset},${y + inset}`)
        .join(" ")
    : "";

  return (
    <div ref={ref} className={className} style={{ position: "relative", ...style }}>
      {fill && (
        <div aria-hidden="true" style={{ position: "absolute", inset: 0, background: fill, clipPath }} />
      )}
      {showOutline && (
        <svg
          aria-hidden="true"
          width={size.w}
          height={size.h}
          viewBox={`0 0 ${size.w} ${size.h}`}
          style={{ position: "absolute", inset: 0, pointerEvents: "none", overflow: "visible" }}
        >
          <polygon
            points={points}
            fill="none"
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeDasharray={dashed ? "6 5" : undefined}
          />
        </svg>
      )}
      <div style={{ position: "relative", height: "100%", clipPath: clipContent ? clipPath : undefined }}>
        {children}
      </div>
    </div>
  );
}