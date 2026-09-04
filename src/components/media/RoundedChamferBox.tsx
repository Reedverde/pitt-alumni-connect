import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from "react";

import { NOTCH_ALL, type NotchCorner } from "@/components/media/notch";
import { CHAMFER, chamferPath, type ChamferPoint, type ChamferTier } from "@/components/media/chamfer";

export type RoundedChamferGeometry = {
  /** Token tier. Prefer this over literal cut/radius pairs. */
  tier?: ChamferTier;
  /** Escape hatches, only when a composition genuinely needs off-scale geometry. */
  cut?: number;
  radius?: number;
  corners?: NotchCorner[];
  /** Custom silhouette in fractions of the box, for non-uniform angled shapes. */
  points?: ChamferPoint[];
};

type RoundedChamferBoxProps = RoundedChamferGeometry & {
  /** Reserved box ratio, e.g. "4 / 3". Prevents layout shift. */
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * The single geometry primitive behind every angled surface: it measures its
 * own box, builds a rounded-vertex polygon path from the chamfer tokens, and
 * clips its children with it. Plain border-radius cannot express this, since
 * it rounds a rectangle rather than a polygon.
 *
 * Images use RoundedChamferPhoto, colour planes use RoundedChamferField. Both
 * are thin wrappers over this, so the two never drift apart.
 */
export function RoundedChamferBox({
  tier = "md",
  cut,
  radius,
  corners = NOTCH_ALL,
  points,
  ratio,
  className,
  style,
  children,
}: RoundedChamferBoxProps) {
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

  const token = CHAMFER[tier];
  const path = chamferPath({
    w: size.w,
    h: size.h,
    cut: cut ?? token.cut,
    radius: radius ?? token.radius,
    corners,
    points,
  });

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: "relative", width: "100%", aspectRatio: ratio, ...style }}
    >
      {path && (
        <svg aria-hidden="true" width={0} height={0} style={{ position: "absolute" }}>
          <defs>
            <clipPath id={clipId} clipPathUnits="userSpaceOnUse">
              <path d={path} />
            </clipPath>
          </defs>
        </svg>
      )}
      <div
        style={{
          position: "absolute",
          inset: 0,
          clipPath: path ? `url(#${clipId})` : undefined,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * A flat colour plane cut on the same tokenized angles as the photography, so
 * decorative geometry never reads sharper than the images beside it.
 */
export function RoundedChamferField({
  fill,
  opacity,
  ...geometry
}: RoundedChamferBoxProps & { fill: string; opacity?: number }) {
  const { style, ...rest } = geometry;
  return (
    <RoundedChamferBox {...rest} style={{ ...style, opacity }}>
      <div style={{ position: "absolute", inset: 0, background: fill }} />
    </RoundedChamferBox>
  );
}
