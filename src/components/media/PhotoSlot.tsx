import type { CSSProperties } from "react";

type PhotoSlotProps = {
  /** What photograph belongs in this seat, e.g. "SIDELINE, 2013 NATIONALS". */
  label: string;
  /** Aspect ratio as width/height, e.g. "16 / 9" or "3 / 1". */
  ratio?: string;
  /** When set, the real photograph renders and the dashed frame disappears. */
  src?: string;
  /** Required alt text whenever src is set. */
  alt?: string;
  className?: string;
};

const DUOTONE = "grayscale(1) contrast(0.95) sepia(0.3) hue-rotate(185deg) saturate(2.4)";

export function PhotoSlot({ label, ratio = "16 / 9", src, alt, className }: PhotoSlotProps) {
  const frame: CSSProperties = { aspectRatio: ratio, width: "100%", borderRadius: 18 };

  if (src) {
    return (
      <figure className={className} style={{ margin: 0 }}>
        <img
          src={src}
          alt={alt ?? label}
          loading="lazy"
          decoding="async"
          style={{ ...frame, display: "block", objectFit: "cover", filter: DUOTONE }}
        />
      </figure>
    );
  }

  return (
    <div
      aria-hidden="true"
      className={className}
      style={{
        ...frame,
        border: "1.5px dashed var(--chalk)",
        background: "var(--concrete)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        padding: 16,
        textAlign: "center",
      }}
    >
      <span
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 11,
          textTransform: "uppercase",
          letterSpacing: "0.08em",
          color: "var(--sterling)",
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontFamily: '"Space Grotesk", sans-serif',
          fontSize: 11,
          color: "var(--sterling)",
        }}
      >
        Photo coming
      </span>
    </div>
  );
}
