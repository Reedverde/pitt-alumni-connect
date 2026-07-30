import { PARTY_SIZE_MAX, PARTY_SIZE_MIN } from "@/lib/rsvp-types";

const stepButton: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 7,
  border: "1px solid var(--steel-ink)",
  background: "transparent",
  color: "var(--steel-ink)",
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 17,
  fontWeight: 700,
  lineHeight: 1,
};

/** Heads including the person themselves. Answered by default at 1, so it
 *  costs nobody any effort and never blocks the flow. */
export function PartySizeStepper({
  value,
  onChange,
  busy = false,
}: {
  value: number;
  onChange: (next: number) => void;
  busy?: boolean;
}) {
  const set = (next: number) =>
    onChange(Math.min(PARTY_SIZE_MAX, Math.max(PARTY_SIZE_MIN, next)));

  return (
    <div className="mt-4">
      <p id="party-size-label" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        How many of you, including yourself?
      </p>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          aria-label="One fewer"
          style={{ ...stepButton, opacity: value <= PARTY_SIZE_MIN || busy ? 0.4 : 1 }}
          disabled={value <= PARTY_SIZE_MIN || busy}
          onClick={() => set(value - 1)}
        >
          –
        </button>
        <output
          aria-live="polite"
          aria-labelledby="party-size-label"
          style={{
            fontFamily: '"Space Mono", monospace',
            fontSize: 20,
            color: "var(--sabah-black)",
            minWidth: 32,
            textAlign: "center",
          }}
        >
          {value}
        </output>
        <button
          type="button"
          aria-label="One more"
          style={{ ...stepButton, opacity: value >= PARTY_SIZE_MAX || busy ? 0.4 : 1 }}
          disabled={value >= PARTY_SIZE_MAX || busy}
          onClick={() => set(value + 1)}
        >
          +
        </button>
      </div>
    </div>
  );
}
