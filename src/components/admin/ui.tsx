import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";

import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { primaryButton, secondaryButton } from "@/components/claim/ui";

export const hairline = "1px solid var(--chalk)";

export const mono: CSSProperties = {
  fontFamily: '"Space Mono", ui-monospace, monospace',
  fontSize: 13,
  color: "var(--steel-ink)",
};

export const cellStyle: CSSProperties = {
  borderTop: hairline,
  padding: "8px 10px",
  fontSize: 13,
  color: "var(--steel-ink)",
  verticalAlign: "top",
  textAlign: "left",
};

export const headStyle: CSSProperties = {
  padding: "8px 10px",
  fontFamily: '"Space Grotesk", system-ui, sans-serif',
  fontSize: 11,
  fontWeight: 700,
  letterSpacing: "0.08em",
  textTransform: "uppercase",
  color: "var(--sterling)",
  textAlign: "left",
  whiteSpace: "nowrap",
};

export const inputStyle: CSSProperties = {
  border: hairline,
  borderRadius: 5,
  background: "var(--pure-white)",
  color: "var(--steel-ink)",
  padding: "6px 8px",
  fontSize: 13,
  width: "100%",
};

export { primaryButton, secondaryButton };

export function Section({
  eyebrow,
  title,
  children,
  aside,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  aside?: ReactNode;
}) {
  return (
    <section className="mb-16" style={{ borderTop: "2px solid var(--steel-ink)", paddingTop: 18 }}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <SlashEyebrow>{eyebrow}</SlashEyebrow>
          <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
            {title}
          </h2>
        </div>
        {aside}
      </div>
      {children}
    </section>
  );
}

export function Num({ children }: { children: ReactNode }) {
  return <span style={mono}>{children}</span>;
}

export function Empty({ children }: { children: ReactNode }) {
  return (
    <p style={{ fontSize: 13, color: "var(--sterling)", borderTop: hairline, paddingTop: 12 }}>
      {children}
    </p>
  );
}

/** Destructive actions ask for typed confirmation instead of a red button. */
export function TypedConfirm({
  phrase,
  label,
  onConfirm,
  busy,
}: {
  phrase: string;
  label: string;
  onConfirm: () => void;
  busy?: boolean;
}) {
  const [value, setValue] = useState("");
  const ready = value.trim().toUpperCase() === phrase.toUpperCase();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="label-caps" style={{ color: "var(--sterling)" }}>
        Type {phrase}
      </label>
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        style={{ ...inputStyle, width: 160 }}
        aria-label={`Type ${phrase} to confirm`}
      />
      <button
        type="button"
        disabled={!ready || busy}
        onClick={() => {
          onConfirm();
          setValue("");
        }}
        style={{ ...secondaryButton, opacity: ready && !busy ? 1 : 0.4 }}
      >
        {label}
      </button>
    </div>
  );
}
