export function SlashEyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="flex items-center" style={{ color: "var(--sterling)" }}>
      <span
        aria-hidden="true"
        style={{ color: "var(--pitt-royal)", fontSize: 13, fontWeight: 700, marginRight: 12 }}
      >
        //
      </span>
      <span className="label-caps">{children}</span>
    </p>
  );
}
