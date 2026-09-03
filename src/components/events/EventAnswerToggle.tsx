/** Genuine three states. Unanswered is its own value, never a silent default. */
export type TriState = "unanswered" | "yes" | "no";

export const SLIDER_VALUE: Record<TriState, number> = { no: 0, unanswered: 1, yes: 2 };
export const VALUE_STATE: TriState[] = ["no", "unanswered", "yes"];
export const STATE_WORDS: Record<TriState, string> = {
  no: "No, not attending this event",
  unanswered: "No answer yet",
  yes: "Yes, attending this event",
};

/**
 * The one three position control for a per event answer. Controlled: it saves
 * nothing and knows nothing about a person. Gold appears only in the Yes
 * position, because gold means attending and nothing else.
 */
export function EventAnswerToggle({
  eventTitle,
  state,
  onStateChange,
  partySize,
  onPartySizeChange,
  disabled = false,
}: {
  eventTitle: string;
  state: TriState;
  onStateChange: (next: TriState) => void;
  partySize: number;
  onPartySizeChange: (next: number) => void;
  disabled?: boolean;
}) {
  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }}>
      <input
        type="range"
        min={0}
        max={2}
        step={1}
        disabled={disabled}
        value={SLIDER_VALUE[state]}
        aria-label={`${eventTitle}: ${STATE_WORDS[state]}`}
        aria-valuetext={STATE_WORDS[state]}
        onChange={(ev) => onStateChange(VALUE_STATE[Number(ev.target.value)] ?? "unanswered")}
        style={{
          width: "100%",
          height: 28,
          cursor: disabled ? "default" : "pointer",
          accentColor:
            state === "yes"
              ? "var(--pitt-gold)"
              : state === "no"
                ? "var(--steel-ink)"
                : "var(--chalk)",
        }}
      />
      <div
        className="label-caps flex items-baseline justify-between"
        aria-hidden="true"
        style={{ marginTop: 2 }}
      >
        <span
          style={{
            color: state === "no" ? "var(--steel-ink)" : "var(--sterling)",
            fontWeight: state === "no" ? 700 : 400,
          }}
        >
          No
        </span>
        <span style={{ color: "var(--sterling)", fontWeight: state === "unanswered" ? 700 : 400 }}>
          {state === "unanswered" ? "No answer yet" : "Not answered"}
        </span>
        <span
          style={{
            color: state === "yes" ? "var(--sabah-black)" : "var(--sterling)",
            fontWeight: state === "yes" ? 700 : 400,
          }}
        >
          Yes
        </span>
      </div>

      {state === "yes" && (
        <div className="mt-3 flex items-center gap-3">
          <span className="label-caps" style={{ color: "var(--sterling)" }}>
            Including you, how many?
          </span>
          <div className="flex items-center gap-2">
            <StepButton
              label={`Fewer people for ${eventTitle}`}
              disabled={disabled || partySize <= 1}
              onClick={() => onPartySizeChange(Math.max(1, partySize - 1))}
            >
              −
            </StepButton>
            <span
              aria-live="polite"
              style={{
                fontFamily: "var(--font-mono)",
                fontSize: 15,
                color: "var(--sabah-black)",
                minWidth: 20,
                textAlign: "center",
              }}
            >
              {partySize}
            </span>
            <StepButton
              label={`More people for ${eventTitle}`}
              disabled={disabled || partySize >= 10}
              onClick={() => onPartySizeChange(Math.min(10, partySize + 1))}
            >
              +
            </StepButton>
          </div>
        </div>
      )}
    </div>
  );
}

function StepButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 28,
        height: 28,
        borderRadius: 7,
        border: "1px solid var(--chalk)",
        background: "var(--pure-white)",
        color: "var(--steel-ink)",
        fontSize: 15,
        lineHeight: 1,
        cursor: disabled ? "default" : "pointer",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  );
}
