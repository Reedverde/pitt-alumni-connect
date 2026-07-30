import type { CSSProperties, ReactNode } from "react";

export const primaryButton: CSSProperties = {
  background: "var(--pitt-royal)",
  color: "var(--pure-white)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 7,
  padding: "11px 18px",
  border: "1px solid transparent",
};

export const secondaryButton: CSSProperties = {
  background: "transparent",
  color: "var(--steel-ink)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 7,
  padding: "11px 18px",
  border: "1px solid var(--steel-ink)",
};

export const fieldStyle: CSSProperties = {
  width: "100%",
  borderRadius: 7,
  border: "1px solid var(--chalk)",
  background: "var(--pure-white)",
  color: "var(--steel-ink)",
  padding: "11px 13px",
  fontSize: 15,
};

export function FieldLabel({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="label-caps mb-2 block" style={{ color: "var(--sterling)" }}>
      {children}
    </label>
  );
}

export function Notice({ children }: { children: ReactNode }) {
  return (
    <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
      {children}
    </p>
  );
}