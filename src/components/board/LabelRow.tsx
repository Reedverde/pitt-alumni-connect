/** Section utility bar: uppercase label with an arrow, plus a right-aligned phrase. */
export function LabelRow({ label, right }: { label: string; right?: string }) {
  return (
    <div
      className="flex items-baseline justify-between gap-6"
      style={{ color: "var(--sterling)" }}
    >
      <span className="label-caps">{label} →</span>
      {right && <span className="label-caps" style={{ textAlign: "right" }}>{right}</span>}
    </div>
  );
}