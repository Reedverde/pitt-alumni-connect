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
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        border: `1.5px solid ${ring}`,
        color: ring,
        fontFamily: '"Space Mono", monospace',
        fontSize: size >= 64 ? 20 : size >= 44 ? 13 : 11,
        fontWeight: 700,
      }}
    >
      {children}
    </span>
  );
}
