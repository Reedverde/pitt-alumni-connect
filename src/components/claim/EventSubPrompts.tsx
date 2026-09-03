import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getPromptEvents, submitEventRsvps, type PromptEventDto } from "@/lib/event-rsvp.functions";
import { primaryButton, secondaryButton } from "./ui";

const choice = (active: boolean): React.CSSProperties => ({
  fontFamily: '"Space Grotesk", sans-serif',
  fontSize: 13,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  borderRadius: 7,
  padding: "9px 16px",
  border: `1px solid ${active ? "var(--pitt-royal)" : "var(--chalk)"}`,
  background: active ? "var(--pitt-royal)" : "transparent",
  color: active ? "var(--pure-white)" : "var(--steel-ink)",
});

/** Shown only to someone who just said they are going. Two small questions,
 *  both skippable: the weekend answer is already saved and must never be made
 *  to feel conditional on these. */
export function EventSubPrompts({
  personId,
  onDone,
}: {
  personId: string;
  onDone: () => void;
}) {
  const loadEvents = useServerFn(getPromptEvents);
  const save = useServerFn(submitEventRsvps);

  const [events, setEvents] = useState<PromptEventDto[] | null>(null);
  const [answers, setAnswers] = useState<Record<string, "yes" | "no">>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadEvents({})
      .then((rows) => {
        if (!cancelled) setEvents(rows);
      })
      .catch(() => {
        if (!cancelled) setEvents([]);
      });
    return () => {
      cancelled = true;
    };
  }, [loadEvents]);

  useEffect(() => {
    // Nothing to ask about: do not hold the flow open on an empty panel.
    if (events && events.length === 0) onDone();
  }, [events, onDone]);

  if (!events || events.length === 0) return null;

  const answeredCount = Object.keys(answers).length;

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          personId,
          answers: Object.entries(answers).map(([eventId, status]) => ({
            eventId,
            status,
            partySize: 1,
          })),
        },
      });
    } catch {
      // The weekend RSVP is already recorded. A failure here is never fatal and
      // the drip prompt will ask again.
    }
    onDone();
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        Two of the weekend's pieces need their own headcount. A no is just as useful as a yes.
      </p>

      <div className="mt-5 flex flex-col gap-5">
        {events.map((e) => (
          <div key={e.id}>
            <p style={{ fontSize: 15, color: "var(--sabah-black)", fontWeight: 600 }}>{e.title}</p>
            {e.location ? (
              <p className="mt-0.5" style={{ fontSize: 13, color: "var(--sterling)" }}>
                {e.location}
              </p>
            ) : null}
            <div className="mt-2 flex gap-2">
              <button
                type="button"
                style={choice(answers[e.id] === "yes")}
                onClick={() => setAnswers((prev) => ({ ...prev, [e.id]: "yes" }))}
              >
                Yes
              </button>
              <button
                type="button"
                style={choice(answers[e.id] === "no")}
                onClick={() => setAnswers((prev) => ({ ...prev, [e.id]: "no" }))}
              >
                No
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-6 flex items-center gap-3">
        <button
          type="button"
          style={{ ...primaryButton, opacity: busy || answeredCount === 0 ? 0.5 : 1 }}
          disabled={busy || answeredCount === 0}
          onClick={submit}
        >
          Save answers
        </button>
        <button type="button" style={secondaryButton} disabled={busy} onClick={onDone}>
          Skip for now
        </button>
      </div>
    </div>
  );
}
