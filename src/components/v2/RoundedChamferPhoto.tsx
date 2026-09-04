import type { CSSProperties } from "react";

import { RoundedChamferBox, type RoundedChamferGeometry } from "@/components/media/RoundedChamferBox";

type RoundedChamferPhotoProps = RoundedChamferGeometry & {
  src: string;
  alt: string;
  /** Reserved box, e.g. "4 / 3". Prevents layout shift. */
  ratio?: string;
  position?: string;
  /** Only the page's LCP photograph should load eagerly. */
  eager?: boolean;
  className?: string;
  style?: CSSProperties;
};

/**
 * A photograph with bold angled chamfers whose vertices are all rounded.
 * Geometry comes from the shared chamfer tokens (see components/media/chamfer),
 * so pick a tier rather than inventing a cut/radius pair.
 */
export function RoundedChamferPhoto({
  src,
  alt,
  ratio = "4 / 3",
  position,
  eager = false,
  className,
  style,
  ...geometry
}: RoundedChamferPhotoProps) {
  return (
    <figure className={className} style={{ margin: 0, ...style }}>
      <RoundedChamferBox {...geometry} ratio={ratio}>
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
      </RoundedChamferBox>
    </figure>
  );
}
