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
  const [saveError, setSaveError] = useState<string | null>(null);

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
    setSaveError(null);
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
      // The weekend RSVP is already recorded. A failure here is never fatal, so
      // say so in place and let them retry or move on.
      setSaveError("Those event answers did not save. Your weekend answer is safe, and you can set these later on your record.");
      setBusy(false);
      return;
    }
    onDone();
  };

  return (
    <div>
      <p style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        Each piece of the weekend wants its own answer. A no is just as useful as a yes.
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
                <EventAnswerToggle
                  eventTitle={e.title}
                  state={state}
                  onStateChange={(next) => setState(e.id, next)}
                  partySize={party}
                  onPartySizeChange={(size) => setPartySizes((prev) => ({ ...prev, [e.id]: size }))}
                />
              </div>

            </div>
          );
        })}
      </div>

      {saveError && (
        <p role="alert" className="mt-4" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {saveError}
        </p>
      )}

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
