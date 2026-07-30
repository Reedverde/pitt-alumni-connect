import { useEffect, useState } from "react";

/** Shown once after a successful claim: a 120px circle with a 2px Pitt Gold
 *  ring, CLAIMED and the grad year arced around it, team badge centered. */
export function ClaimStamp({
  year,
  teamLabel,
  onDone,
}: {
  year: number | null;
  teamLabel: string | null;
  onDone: () => void;
}) {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    const timer = window.setTimeout(onDone, 1400);
    return () => window.clearTimeout(timer);
  }, [onDone]);

  const arcTop = `CLAIMED`;
  const arcBottom = year ? String(year) : "";

  return (
    <div
      role="status"
      className="flex flex-col items-center justify-center py-6"
      style={{
        animation: reduced ? undefined : "claimStampIn 200ms ease-out both",
      }}
    >
      <svg width={120} height={120} viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <path id="claim-arc-top" d="M 18,60 A 42,42 0 0 1 102,60" fill="none" />
          <path id="claim-arc-bottom" d="M 102,60 A 42,42 0 0 1 18,60" fill="none" />
        </defs>
        <circle cx="60" cy="60" r="58" fill="none" stroke="var(--pitt-gold)" strokeWidth="2" />
        <text
          fill="var(--sabah-black)"
          style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 11, letterSpacing: "0.14em" }}
        >
          <textPath href="#claim-arc-top" startOffset="50%" textAnchor="middle">
            {arcTop}
          </textPath>
        </text>
        <text
          fill="var(--sabah-black)"
          style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 11, letterSpacing: "0.14em" }}
        >
          <textPath href="#claim-arc-bottom" startOffset="50%" textAnchor="middle">
            {arcBottom}
          </textPath>
        </text>
        <text
          x="60"
          y="66"
          textAnchor="middle"
          fill="var(--sabah-black)"
          style={{ fontFamily: '"Archivo", sans-serif', fontWeight: 800, fontSize: 16 }}
        >
          {teamLabel ?? ""}
        </text>
      </svg>
      <span className="sr-only">Claimed{year ? `, ${year}` : ""}</span>
    </div>
  );
}