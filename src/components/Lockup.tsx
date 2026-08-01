/** The approved umbrella lockup: the ESN seal ring, a 10px gap, then the
 *  wordmark. Umbrella level only, no team name and no division mark. The
 *  shield PNG belongs to the footer and is deliberately not used here. */
export function Lockup({ size = 44 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ gap: 10 }}>
      <span
        aria-hidden="true"
        className="inline-flex shrink-0 items-center justify-center rounded-full"
        style={{
          width: size,
          height: size,
          border: "1.5px solid var(--sabah-black)",
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 800,
          fontSize: Math.round(size * 0.28),
          letterSpacing: "-0.02em",
          lineHeight: 1,
          color: "var(--sabah-black)",
        }}
      >
        PCU
      </span>
      <span
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 800,
          fontSize: 20,
          letterSpacing: "-0.02em",
          textTransform: "uppercase",
          color: "var(--pitt-royal)",
        }}
      >
        Pitt Club Ultimate
      </span>
    </div>
  );
}
