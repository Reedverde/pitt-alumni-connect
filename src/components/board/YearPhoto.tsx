import { NotchedBox } from "@/components/media/NotchedBox";
import { NOTCH_SM, type NotchCorner } from "@/components/media/notch";
import type { BoardPhoto } from "@/lib/board.functions";
import { photoUrl } from "@/lib/photo-slots";

const DUOTONE = "grayscale(1) contrast(0.95) sepia(0.3) hue-rotate(185deg) saturate(2.4)";

/** Cut corners alternate down the page so the rail reads composed, not stamped. */
const CORNER_CYCLE: NotchCorner[][] = [["tl"], ["br"], ["tl", "br"]];

export function cornersForRow(index: number) {
  return CORNER_CYCLE[index % CORNER_CYCLE.length];
}

const img = {
  position: "absolute" as const,
  inset: 0,
  width: "100%",
  height: "100%",
  objectFit: "cover" as const,
  filter: DUOTONE,
};

/**
 * The photograph beside a year row. Nothing renders when a year has no
 * photograph: thirty dashed frames down the board would read as unfinished.
 */
export function YearPhoto({
  photo,
  year,
  corners,
}: {
  photo: BoardPhoto;
  year: number;
  corners: NotchCorner[];
}) {
  const alt = (photo.alt ?? "").trim() || `Pitt Ultimate, ${year}`;
  return (
    <>
      {/* Phone: a small thumbnail inline with the seal, so the chips stay first. */}
      <NotchedBox
        corners={corners}
        notch={10}
        clipContent
        className="ml-auto shrink-0 md:hidden"
        style={{ width: 56, height: 56 }}
      >
        <img
          src={photoUrl(photo.storage_path)}
          alt={alt}
          width={photo.width ?? undefined}
          height={photo.height ?? undefined}
          loading="lazy"
          decoding="async"
          style={img}
        />
      </NotchedBox>

      <figure className="hidden md:block" style={{ margin: 0, width: "100%" }}>
        <NotchedBox clipContent corners={corners} notch={NOTCH_SM} style={{ width: "100%", aspectRatio: "4 / 3" }}>
          <img
            src={photoUrl(photo.storage_path)}
            alt={alt}
            width={photo.width ?? undefined}
            height={photo.height ?? undefined}
            loading="lazy"
            decoding="async"
            style={img}
          />
        </NotchedBox>
        <figcaption
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 11,
            color: "var(--sterling)",
            marginTop: 6,
          }}
        >
          {year}
        </figcaption>
      </figure>
    </>
  );
}
