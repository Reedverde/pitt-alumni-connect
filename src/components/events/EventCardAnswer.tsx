import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";

import { EventAnswerToggle, type TriState } from "@/components/events/EventAnswerToggle";
import { primaryButton, secondaryButton } from "@/components/claim/ui";
import {
  getMyEventAnswers,
  getPromptEvents,
  submitEventRsvps,
} from "@/lib/event-rsvp.functions";
import { setMyRsvp } from "@/lib/account.functions";
import { clearEventIntent, readEventIntent, saveEventIntent } from "@/lib/event-intent";
import { useSessionPerson } from "@/lib/useSessionPerson";

const WEEKEND_WORD: Record<string, string> = {
  maybe: "maybe",
  not_this_year: "not this year",
};

/**
 * The per event answer, rendered on the card itself. Only the two prompt
 * events (BBQ, Alumni Game) ever show one. Everyone sees it: a signed out tap
 * is held through the sign-in round trip and applied on return.
 */
export function EventCardAnswer({ eventId, eventTitle }: { eventId: string; eventTitle: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { signedIn, personId, rsvpStatus } = useSessionPerson();

  const loadPrompts = useServerFn(getPromptEvents);
  const loadMine = useServerFn(getMyEventAnswers);
  const save = useServerFn(submitEventRsvps);
  const setWeekend = useServerFn(setMyRsvp);

  const prompts = useQuery({
    queryKey: ["prompt-events"],
    queryFn: () => loadPrompts({}),
    staleTime: 5 * 60_000,
  });

  const mine = useQuery({
    queryKey: ["my-event-answers", personId],
    queryFn: () => loadMine({}),
    enabled: Boolean(signedIn && personId),
    staleTime: 30_000,
  });

  const [local, setLocal] = useState<TriState | null>(null);
  const [localParty, setLocalParty] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [confirmFor, setConfirmFor] = useState<{ partySize: number } | null>(null);
  const resumed = useRef(false);

  const saved = mine.data?.find((a) => a.eventId === eventId) ?? null;
  const state: TriState = local ?? (saved ? saved.status : "unanswered");
  const partySize = localParty ?? saved?.partySize ?? 1;

  const isPromptEvent = (prompts.data ?? []).some((e) => e.id === eventId);

  const writeAnswer = useCallback(
    async (status: "yes" | "no", size: number) => {
      if (!personId) return;
      setBusy(true);
      try {
        const result = await save({
          data: { personId, answers: [{ eventId, status, partySize: size }] },
        });
        if (!result?.ok) {
          setNote("That did not save. Try again in a moment.");
          setLocal(saved ? saved.status : "unanswered");
        } else {
          setNote(null);
          await queryClient.invalidateQueries({ queryKey: ["my-event-answers", personId] });
        }
      } catch {
        setNote("That did not save. Try again in a moment.");
        setLocal(saved ? saved.status : "unanswered");
      }
      setBusy(false);
    },
    [eventId, personId, queryClient, save, saved],
  );

  const apply = useCallback(
    (next: TriState, size: number) => {
      setLocal(next);
      setLocalParty(size);
      if (next === "unanswered") return;

      if (!signedIn) {
        saveEventIntent({
          eventId,
          status: next,
          partySize: size,
          returnTo: `${window.location.pathname}${window.location.search}`,
        });
        void navigate({ to: "/auth" });
        return;
      }
      if (!personId) {
        setNote("We could not match your sign-in to a name on the board yet.");
        return;
      }
      // Saying yes to a piece of the weekend while marked maybe or not this
      // year is a contradiction. Ask before changing the weekend answer.
      if (next === "yes" && rsvpStatus !== "going") {
        setConfirmFor({ partySize: size });
        return;
      }
      void writeAnswer(next, size);
    },
    [eventId, navigate, personId, rsvpStatus, signedIn, writeAnswer],
  );

  // A tap made before signing in, applied once on return.
  useEffect(() => {
    if (resumed.current || !signedIn || !personId || mine.isLoading) return;
    const intent = readEventIntent();
    if (!intent || intent.eventId !== eventId) return;
    resumed.current = true;
    clearEventIntent();
    apply(intent.status, intent.partySize);
  }, [apply, eventId, mine.isLoading, personId, signedIn]);

  if (!isPromptEvent) return null;

  const confirmUpgrade = async () => {
    const size = confirmFor?.partySize ?? 1;
    setConfirmFor(null);
    setBusy(true);
    try {
      await setWeekend({ data: { personId: personId as string, status: "going" } });
      await queryClient.invalidateQueries({ queryKey: ["nav-identity"] });
    } catch {
      setNote("We could not update your weekend answer. Nothing changed.");
      setLocal(saved ? saved.status : "unanswered");
      setBusy(false);
      return;
    }
    setBusy(false);
    await writeAnswer("yes", size);
  };

  const declineUpgrade = () => {
    setConfirmFor(null);
    setLocal(saved ? saved.status : "unanswered");
    setLocalParty(saved?.partySize ?? 1);
  };

  return (
    <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--chalk)" }}>
      <p className="label-caps" style={{ color: "var(--sterling)" }}>
        Are you in for this one?
      </p>
      <div className="mt-2 max-w-[420px]">
        <EventAnswerToggle
          eventTitle={eventTitle}
          state={state}
          onStateChange={(next) => apply(next, partySize)}
          partySize={partySize}
          onPartySizeChange={(size) => {
            setLocalParty(size);
            if (state === "yes" && signedIn && personId && rsvpStatus === "going") {
              void writeAnswer("yes", size);
            }
          }}
          disabled={busy}
        />
      </div>
      {note && (
        <p className="mt-2" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {note}
        </p>
      )}

      {confirmFor && (
        <UpgradeConfirm
          weekendWord={WEEKEND_WORD[rsvpStatus ?? ""] ?? "not coming"}
          onConfirm={() => void confirmUpgrade()}
          onCancel={declineUpgrade}
        />
      )}
    </div>
  );
}

/** Small local confirm. Same overlay treatment as the claim dialog, nothing
 *  imported from it, so neither can drift the other. */
function UpgradeConfirm({
  weekendWord,
  onConfirm,
  onCancel,
}: {
  weekendWord: string;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 md:items-center md:p-6"
      style={{ background: "rgba(11,11,12,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Update your weekend answer"
        className="w-full max-w-[420px] p-6"
        style={{ background: "var(--pure-white)", border: "1px solid var(--chalk)", borderRadius: 7 }}
      >
        <h2 className="display-30" style={{ color: "var(--sabah-black)" }}>
          UPDATE TO GOING?
        </h2>
        <p className="mt-3" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          You are marked {weekendWord} for the weekend. Update to going?
        </p>
        <div className="mt-6 flex items-center gap-3">
          <button type="button" style={primaryButton} onClick={onConfirm}>
            Yes, I am going
          </button>
          <button type="button" style={secondaryButton} onClick={onCancel}>
            Leave it as is
          </button>
        </div>
      </div>
    </div>
  );
}
