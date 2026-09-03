import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { getPromptEvents, submitEventRsvps, type PromptEventDto } from "@/lib/event-rsvp.functions";
import { EventAnswerToggle, type TriState } from "@/components/events/EventAnswerToggle";
import { primaryButton, secondaryButton } from "./ui";


/**
 * Shown only to someone who just said they are going. Each event gets a real
 * three position slider: No, unanswered (center, the default), Yes. Gold is
 * reserved for the Yes position because gold means attending and nothing
 * else. Both questions are skippable: the weekend answer is already saved and
 * must never be made to feel conditional on these.
 */
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
  const [answers, setAnswers] = useState<Record<string, TriState>>({});
  const [partySizes, setPartySizes] = useState<Record<string, number>>({});
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

  const answeredCount = Object.values(answers).filter((a) => a !== "unanswered").length;

  const setState = (eventId: string, next: TriState) => {
    setAnswers((prev) => ({ ...prev, [eventId]: next }));
    if (next !== "yes") setPartySizes((prev) => ({ ...prev, [eventId]: 1 }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      await save({
        data: {
          personId,
          answers: Object.entries(answers)
            .filter((entry): entry is [string, "yes" | "no"] => entry[1] !== "unanswered")
            .map(([eventId, status]) => ({
              eventId,
              status,
              partySize: status === "yes" ? (partySizes[eventId] ?? 1) : 1,
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

      <div className="mt-5 flex flex-col gap-6">
        {events.map((e) => {
          const state = answers[e.id] ?? "unanswered";
          const party = partySizes[e.id] ?? 1;
          return (
            <div key={e.id}>
              <p style={{ fontSize: 15, color: "var(--sabah-black)", fontWeight: 600 }}>{e.title}</p>
              {e.location ? (
                <p className="mt-0.5" style={{ fontSize: 13, color: "var(--sterling)" }}>
                  {e.location}
                </p>
              ) : null}

              <div className="mt-3">
                <input
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={SLIDER_VALUE[state]}
                  aria-label={`${e.title}: ${STATE_WORDS[state]}`}
                  aria-valuetext={STATE_WORDS[state]}
                  onChange={(ev) => setState(e.id, VALUE_STATE[Number(ev.target.value)] ?? "unanswered")}
                  style={{
                    width: "100%",
                    height: 28,
                    cursor: "pointer",
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
                  <span style={{ color: state === "no" ? "var(--steel-ink)" : "var(--sterling)", fontWeight: state === "no" ? 700 : 400 }}>
                    No
                  </span>
                  <span style={{ color: "var(--sterling)", fontWeight: state === "unanswered" ? 700 : 400 }}>
                    {state === "unanswered" ? "No answer yet" : "Not answered"}
                  </span>
                  <span style={{ color: state === "yes" ? "var(--sabah-black)" : "var(--sterling)", fontWeight: state === "yes" ? 700 : 400 }}>
                    Yes
                  </span>
                </div>
              </div>

              {state === "yes" && (
                <div className="mt-3 flex items-center gap-3">
                  <span className="label-caps" style={{ color: "var(--sterling)" }}>
                    Including you, how many?
                  </span>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Fewer people for ${e.title}`}
                      disabled={party <= 1}
                      onClick={() => setPartySizes((prev) => ({ ...prev, [e.id]: Math.max(1, party - 1) }))}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        border: "1px solid var(--chalk)",
                        background: "var(--pure-white)",
                        color: "var(--steel-ink)",
                        fontSize: 15,
                        lineHeight: 1,
                        cursor: party <= 1 ? "default" : "pointer",
                        opacity: party <= 1 ? 0.4 : 1,
                      }}
                    >
                      −
                    </button>
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
                      {party}
                    </span>
                    <button
                      type="button"
                      aria-label={`More people for ${e.title}`}
                      disabled={party >= 10}
                      onClick={() => setPartySizes((prev) => ({ ...prev, [e.id]: Math.min(10, party + 1) }))}
                      style={{
                        width: 28,
                        height: 28,
                        borderRadius: 7,
                        border: "1px solid var(--chalk)",
                        background: "var(--pure-white)",
                        color: "var(--steel-ink)",
                        fontSize: 15,
                        lineHeight: 1,
                        cursor: party >= 10 ? "default" : "pointer",
                        opacity: party >= 10 ? 0.4 : 1,
                      }}
                    >
                      +
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
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
