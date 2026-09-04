import type { CSSProperties } from "react";

import { NotchedBox } from "./NotchedBox";
import { photoUrl, usePhotoSlots } from "@/lib/photo-slots";
import { NOTCH_ALL, NOTCH_LG, type NotchCorner } from "./notch";

type PhotoSlotProps = {
  /** What photograph belongs in this seat, e.g. "SIDELINE, 2013 NATIONALS". */
  label: string;
  /** Zero-padded index numeral, e.g. "01". */
  index?: string;
  /** Aspect ratio as width/height, e.g. "16 / 9" or "3 / 4". */
  ratio?: string;
  /** Which corners are cut. Photographs default to all four. */
  corners?: NotchCorner[];
  notch?: number;
  /** Reads photo_slots for this key. Empty slot keeps the dashed state. */
  slotKey?: string;
  /** When set, the real photograph renders and the dashed frame disappears. */
  src?: string;
  /** Required alt text whenever src is set. */
  alt?: string;
  /** The one slot above the fold. Everything else lazy loads. */
  eager?: boolean;
  /** Retained for compatibility. Every photograph is full colour now. */
  fullColor?: boolean;
  /** Outline colour drawn on top of the photograph, e.g. "var(--pure-white)". */
  outline?: string;
  outlineWidth?: number;
  /** Hide the caption/scrim overlay: for display photographs like the hero. */
  bare?: boolean;
  /** Rounded corners instead of notches, e.g. "24px 24px 0 0". */
  radius?: string;
  className?: string;
};

/** Photographs render in their own colours. Kept as an empty string so the
 *  fullColor prop stays a no op for callers that still pass it. */

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
  corners = NOTCH_ALL,
  notch = NOTCH_LG,
  slotKey,
  src,
  alt,
  eager = false,
  fullColor = false,
  outline,
  outlineWidth = 3,
  bare = false,
  radius,
  className,
}: PhotoSlotProps) {
  const { data: slots } = usePhotoSlots();
  const assigned = slotKey ? (slots?.[slotKey] ?? null) : null;

  const frame: CSSProperties = { aspectRatio: ratio, width: "100%" };
  const resolvedSrc = src ?? (assigned ? photoUrl(assigned.storage_path) : undefined);
  // Never an empty alt on a content image: the slot label is the fallback.
  const resolvedAlt = (alt ?? assigned?.alt ?? "").trim() || label;

  if (resolvedSrc) {
    if (radius) {
      return (
        <figure
          className={className}
          style={{
            margin: 0,
            ...frame,
            position: "relative",
            borderRadius: radius,
            overflow: "hidden",
            border: outline ? `${outlineWidth}px solid ${outline}` : undefined,
            boxSizing: "border-box",
          }}
        >
          <img
            src={resolvedSrc}
            alt={resolvedAlt}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
        </figure>
      );
    }
    return (
      <figure className={className} style={{ margin: 0 }}>
        <NotchedBox
          clipContent
          strokeOnTop
          corners={corners}
          notch={notch}
          stroke={outline}
          strokeWidth={outlineWidth}
          style={frame}
        >
          <img
            src={resolvedSrc}
            alt={resolvedAlt}
            width={assigned?.width ?? undefined}
            height={assigned?.height ?? undefined}
            loading={eager ? "eager" : "lazy"}
            fetchPriority={eager ? "high" : undefined}
            decoding="async"
            style={{
              position: "absolute",
              inset: 0,
              width: "100%",
              height: "100%",
              objectFit: "cover",
            }}
          />
          {!bare && (
          <div
            style={{
              position: "absolute",
              inset: 0,
              padding: 14,
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              color: "var(--pure-white)",
              // A scrim so the label stays legible over a busy photograph.
              background:
                "linear-gradient(180deg, rgba(11,11,12,0.45) 0%, rgba(11,11,12,0) 32%, rgba(11,11,12,0) 68%, rgba(11,11,12,0.45) 100%)",
            }}
          >
            <span style={labelStyle}>{label} →</span>
            <span style={{ ...numeralStyle, alignSelf: "flex-end" }}>{index}</span>
          </div>
          )}
        </NotchedBox>
      </figure>
    );
  }

  // No photograph assigned yet: render nothing. A dashed grey plane with a
  // caption reads as a broken image to a reader and left whole sections of
  // the site looking unfinished. The slot reappears the moment an organizer
  // assigns a picture to it.
  return null;
}

/** A dashed notched card that holds a short statement instead of a photograph. */
export function StatementCard({
  children,
  index = "00",
  ratio = "1 / 1",
  corners = NOTCH_ALL,
  slotKey,
  className,
}: {
  children: string;
  index?: string;
  ratio?: string;
  corners?: NotchCorner[];
  slotKey?: string;
  className?: string;
}) {
  const { data: slots } = usePhotoSlots();
  const assigned = slotKey ? (slots?.[slotKey] ?? null) : null;

  if (assigned) {
    return (
      <PhotoSlot
        className={className}
        label={children}
        index={index}
        ratio={ratio}
        corners={corners}
        slotKey={slotKey}
      />
    );
  }

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
