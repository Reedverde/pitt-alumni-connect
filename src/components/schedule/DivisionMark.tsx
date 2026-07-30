import sabahTeamLogo from "@/assets/sabah-team-logo.png.asset.json";
import bittLogo from "@/assets/bitt-logo.png.asset.json";

const MARKS: Record<string, { url: string; alt: string }> = {
  MENS_A: { url: sabahTeamLogo.url, alt: "En Sabah Nur" },
  WOMENS_A: { url: sabahTeamLogo.url, alt: "Danger" },
  MENS_B: { url: bittLogo.url, alt: "BITT" },
  WOMENS_B: { url: bittLogo.url, alt: "Danger B" },
};

/** Small program mark shown beside a division lane: A programs get the Sabah
 *  team logo, B programs get the BITT logo. */
export function DivisionMark({ code, size = 26 }: { code: string; size?: number }) {
  const mark = MARKS[code];
  if (!mark) return null;
  return (
    <img
      src={mark.url}
      alt={mark.alt}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 object-contain"
      style={{ width: size, height: size }}
    />
  );
}