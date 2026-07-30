export function Seal({
  children,
  size = 44,
  tone = "royal",
}: {
  children: React.ReactNode;
  size?: number;
  tone?: "royal" | "black" | "chalk";
}) {
  const ring =
    tone === "black" ? "var(--sabah-black)" : tone === "chalk" ? "var(--chalk)" : "var(--pitt-royal)";
  // A four-character seal (a year ending in 00, shown in full) is scaled down
  // so it still fits inside the circle.
  const long = typeof children === "string" && children.length >= 4;
  const base = size >= 64 ? 20 : size >= 44 ? 13 : 11;
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${ring}`,
        color: ring,
        fontFamily: '"Space Mono", monospace',
        fontSize: long ? Math.round(base * 0.72) : base,
        letterSpacing: long ? "-0.03em" : undefined,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
