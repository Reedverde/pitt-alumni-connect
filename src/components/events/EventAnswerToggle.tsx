import { useRef } from "react";

/** Genuine three states. Unanswered is its own value, never a silent default. */
export type TriState = "unanswered" | "yes" | "no";

export const VALUE_STATE: TriState[] = ["no", "unanswered", "yes"];
export const SLIDER_VALUE: Record<TriState, number> = { no: 0, unanswered: 1, yes: 2 };
export const STATE_WORDS: Record<TriState, string> = {
  no: "No, not attending this event",
  unanswered: "No choice made yet",
  yes: "Yes, attending this event",
};

const SEGMENTS: { state: TriState; short: string }[] = [
  { state: "no", short: "No" },
  { state: "unanswered", short: "No choice" },
  { state: "yes", short: "Yes" },
];

function thumbFill(state: TriState) {
  if (state === "yes") return "var(--answer-yes)";
  if (state === "no") return "var(--answer-no)";
  return "var(--pure-white)";
}

function thumbText(state: TriState) {
  return state === "unanswered" ? "var(--steel-ink)" : "var(--pure-white)";
}

/**
 * The one three position control for a per event answer. Controlled: it saves
 * nothing and knows nothing about a person. The centre position is a real
 * unanswered value and is never written as a no. Gold never appears here:
 * gold means attending on the board and nothing else, so yes is green.
 */
export function EventAnswerToggle({
  eventTitle,
  state,
  onStateChange,
  partySize,
  onPartySizeChange,
  disabled = false,
  describedBy,
}: {
  eventTitle: string;
  state: TriState;
  onStateChange: (next: TriState) => void;
  partySize: number;
  onPartySizeChange: (next: number) => void;
  disabled?: boolean;
  describedBy?: string;
}) {
  const groupRef = useRef<HTMLDivElement | null>(null);
  const index = SLIDER_VALUE[state];

  const move = (next: number) => {
    const clamped = Math.min(2, Math.max(0, next));
    const value = VALUE_STATE[clamped] ?? "unanswered";
    if (value !== state) onStateChange(value);
    const el = groupRef.current?.querySelectorAll<HTMLButtonElement>("[role='radio']")[clamped];
    el?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      move(index + 1);
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      move(index - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      move(0);
    } else if (e.key === "End") {
      e.preventDefault();
      move(2);
    }
  };

  return (
    <div style={{ opacity: disabled ? 0.6 : 1 }}>
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label={`${eventTitle}: are you coming?`}
        aria-describedby={describedBy}
        onKeyDown={onKeyDown}
        className="relative select-none"
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(3, 1fr)",
          background: "var(--concrete)",
          border: "1px solid var(--chalk)",
          borderRadius: 999,
          padding: 3,
          maxWidth: 360,
          touchAction: "manipulation",
        }}
      >
        {/* The moving thumb. One element, so the selection visibly travels. */}
        <span
          aria-hidden="true"
          className="tri-thumb pointer-events-none absolute"
          style={{
            top: 3,
            bottom: 3,
            left: 3,
            width: "calc((100% - 6px) / 3)",
            transform: `translateX(${index * 100}%)`,
            background: thumbFill(state),
            border: state === "unanswered" ? "1px solid var(--chalk)" : "1px solid transparent",
            borderRadius: 999,
          }}
        />
        {SEGMENTS.map((seg, i) => {
          const selected = seg.state === state;
          return (
            <button
              key={seg.state}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={STATE_WORDS[seg.state]}
              tabIndex={selected ? 0 : -1}
              disabled={disabled}
              onClick={() => !disabled && onStateChange(seg.state)}
              className="label-caps relative"
              style={{
                background: "transparent",
                border: "none",
                borderRadius: 999,
                minHeight: 40,
                padding: "0 6px",
                cursor: disabled ? "default" : "pointer",
                color: selected ? thumbText(seg.state) : "var(--sterling)",
                fontWeight: selected ? 700 : 400,
                zIndex: 1,
                gridColumn: i + 1,
              }}
            >
              {seg.short}
            </button>
          );
        })}
      </div>

      <p className="sr-only" aria-live="polite">
        {eventTitle}: {STATE_WORDS[state]}
      </p>

      {state === "yes" && (
        <div className="mt-3 flex flex-wrap items-center gap-3">
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
        width: 44,
        height: 44,
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
