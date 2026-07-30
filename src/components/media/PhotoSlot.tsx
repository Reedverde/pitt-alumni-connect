import type { CSSProperties } from "react";

import { NotchedBox } from "./NotchedBox";
import { NOTCH_LG, type NotchCorner } from "./notch";

type PhotoSlotProps = {
  /** What photograph belongs in this seat, e.g. "SIDELINE, 2013 NATIONALS". */
  label: string;
  /** Zero-padded index numeral, e.g. "01". */
  index?: string;
  /** Aspect ratio as width/height, e.g. "16 / 9" or "3 / 4". */
  ratio?: string;
  /** Which corners are cut. Never all four. */
  corners?: NotchCorner[];
  notch?: number;
  /** When set, the real photograph renders and the dashed frame disappears. */
  src?: string;
  /** Required alt text whenever src is set. */
  alt?: string;
  className?: string;
};

const DUOTONE = "grayscale(1) contrast(0.95) sepia(0.3) hue-rotate(185deg) saturate(2.4)";

const labelStyle: CSSProperties = {
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 11,
  fontWeight: 500,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
};

const numeralStyle: CSSProperties = {
  fontFamily: '"Space Mono", monospace',
  fontSize: 11,
  letterSpacing: "0.04em",
};

export function PhotoSlot({
  label,
  index = "01",
  ratio = "16 / 9",
  corners = ["tl"],
  notch = NOTCH_LG,
  src,
  alt,
  className,
}: PhotoSlotProps) {
  const frame: CSSProperties = { aspectRatio: ratio, width: "100%" };

  if (src) {
    return (
      <figure className={className} style={{ margin: 0 }}>
        <NotchedBox corners={corners} notch={notch} style={frame}>
          <img
            src={src}
            alt={alt ?? label}
            loading="lazy"
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
              filter: DUOTONE,
            }}
          />
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "var(--pure-white)",
            }}
          >
            <span style={labelStyle}>{label} →</span>
            <span style={{ ...numeralStyle, alignSelf: "flex-end" }}>{index}</span>
          </div>
        </NotchedBox>
      </figure>
    );
  }

  return (
    <NotchedBox
      className={className}
      corners={corners}
      notch={notch}
      stroke="var(--chalk)"
      dashed
      fill="var(--concrete)"
      style={frame}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 14,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          color: "var(--sterling)",
        }}
      >
        <span style={labelStyle}>{label} →</span>
        <span style={{ ...numeralStyle, alignSelf: "flex-end" }}>{index}</span>
      </div>
    </NotchedBox>
  );
}

/** A dashed notched card that holds a short statement instead of a photograph. */
export function StatementCard({
  children,
  index = "00",
  ratio = "1 / 1",
  corners = ["br"],
  className,
}: {
  children: string;
  index?: string;
  ratio?: string;
  corners?: NotchCorner[];
  className?: string;
}) {
  return (
    <NotchedBox
      className={className}
      corners={corners}
      notch={NOTCH_LG}
      stroke="var(--chalk)"
      dashed
      style={{ aspectRatio: ratio, width: "100%" }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          padding: 16,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
        }}
      >
        <p style={{ ...labelStyle, color: "var(--sabah-black)", lineHeight: 1.6, margin: 0 }}>
          {children}
        </p>
        <span style={{ ...numeralStyle, color: "var(--sterling)", alignSelf: "flex-end" }}>{index}</span>
      </div>
    </NotchedBox>
  );
}
