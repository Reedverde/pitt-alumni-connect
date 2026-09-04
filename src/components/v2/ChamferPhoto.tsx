import type { CSSProperties } from "react";

import { NotchedBox } from "@/components/media/NotchedBox";
import type { NotchCorner } from "@/components/media/notch";

type ChamferPhotoProps = {
  src: string;
  alt: string;
  /** Reserved box, e.g. "16 / 9" or "3 / 4". Prevents layout shift. */
  ratio?: string;
  corners?: NotchCorner[];
  /** Deliberately larger than the board notch: the cuts are the point here. */
  notch?: number;
  /** Only the hero photograph loads eagerly. */
  eager?: boolean;
  /** Optional object-position for deliberate crops, e.g. "center 55%". */
  position?: string;
  outline?: string;
  outlineWidth?: number;
  className?: string;
  style?: CSSProperties;
};

/**
 * A photograph cut with deep 45 degree chamfers. Same geometry engine as the
 * board, pushed much harder: the notch is a hero-scale bevel, and the corner
 * set alternates from module to module so the grid never reads as cards.
 * Photographs always render in their original colour: no duotone, no tint,
 * no grade. Legibility is handled by composition, not by recolouring.
 */
export function ChamferPhoto({
  src,
  alt,
  ratio = "16 / 9",
  corners = ["tl", "br"],
  notch = 64,
  eager = false,
  position,
  outline,
  outlineWidth = 2,
  className,
  style,
}: ChamferPhotoProps) {
  return (
    <figure className={className} style={{ margin: 0, ...style }}>
      <NotchedBox
        clipContent
        strokeOnTop
        corners={corners}
        notch={notch}
        stroke={outline}
        strokeWidth={outlineWidth}
        style={{ width: "100%", aspectRatio: ratio }}
      >
        <img
          src={src}
          alt={alt}
          loading={eager ? "eager" : "lazy"}
          fetchPriority={eager ? "high" : undefined}
          decoding="async"
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            objectPosition: position,
          }}
        />
      </NotchedBox>
    </figure>
  );
}

/** A flat colour field cut on the same angle, used to continue a photo edge. */
export function ChamferField({
  fill,
  corners = ["tl", "br"],
  notch = 64,
  ratio,
  className,
  style,
  children,
}: {
  fill: string;
  corners?: NotchCorner[];
  notch?: number;
  ratio?: string;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
}) {
  return (
    <NotchedBox
      corners={corners}
      notch={notch}
      fill={fill}
      className={className}
      style={{ width: "100%", aspectRatio: ratio, ...style }}
    >
      {children}
    </NotchedBox>
  );
}
