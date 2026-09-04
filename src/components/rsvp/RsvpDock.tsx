import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useRouterState } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { NotchedBox } from "@/components/media/NotchedBox";
import { EventAnswerToggle, type TriState } from "@/components/events/EventAnswerToggle";
import { getMyRsvpDock, type DockEvent } from "@/lib/rsvp-dock.functions";
import { setMyEventAnswer, setMyRsvp } from "@/lib/account.functions";
import { STATUS_LABELS, RSVP_STATUSES, type RsvpStatus } from "@/lib/rsvp-types";
import { useSessionPerson } from "@/lib/useSessionPerson";
import { safeGet, safeSet } from "@/lib/safe-storage";

/** Routes that are deliberately without site chrome, are already the full card,
 *  or are organizer only. The dock stays out of all of them. */
const HIDDEN = [/^\/qr/, /^\/rsvp/, /^\/auth/, /^\/me/, /^\/admin/];

const OPEN_KEY = "pcu.rsvpdock.open";

function readOpen(eventYear: number): boolean {
  const raw = safeGet("session", OPEN_KEY);
  return raw === `${eventYear}`;
}

function writeOpen(eventYear: number, open: boolean) {
  safeSet("session", OPEN_KEY, open ? `${eventYear}` : "");
}

function eventWhen(row: DockEvent): string {
  if (!row.starts_at) return row.is_placeholder ? "Being planned" : "Time to come";
  return new Date(row.starts_at).toLocaleString(undefined, {
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/**
 * The floating answer card.
 *
 * It owns no data of its own: it reads and writes exactly the records the
 * Schedule cards, /me and the organizer totals read, so the four can never
 * disagree. Master RSVP is a plain three way answer with no headcount; heads
 * are asked per event, and only once that event is a yes.
 */
export function RsvpDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hidden = HIDDEN.some((re) => re.test(pathname));
  if (hidden) return null;
  return <Dock />;
}

function Dock() {
  const { signedIn } = useSessionPerson();
  const queryClient = useQueryClient();
  const load = useServerFn(getMyRsvpDock);
  const putRsvp = useServerFn(setMyRsvp);
  const putEvent = useServerFn(setMyEventAnswer);

  const dock = useQuery({
    queryKey: ["rsvp-dock"],
    queryFn: () => load({}),
    enabled: signedIn,
    staleTime: 30_000,
  });

  const [open, setOpen] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const panelId = useId();
  const toggleRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const restored = useRef(false);

  const data = dock.data ?? null;
  const eventYear = data?.eventYear ?? null;

  // Remembered for this browser session only, and tied to the edition, so a
  // new year never inherits last year's open card.
  useEffect(() => {
    if (restored.current || eventYear == null) return;
    restored.current = true;
    setOpen(readOpen(eventYear));
  }, [eventYear]);

  const setOpenPersisted = useCallback(
    (next: boolean) => {
      setOpen(next);
      if (eventYear != null) writeOpen(eventYear, next);
      if (!next) window.setTimeout(() => toggleRef.current?.focus(), 0);
    },
    [eventYear],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpenPersisted(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpenPersisted]);

  const refresh = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["rsvp-dock"] }),
      queryClient.invalidateQueries({ queryKey: ["nav-identity"] }),
      queryClient.invalidateQueries({ queryKey: ["my-event-answers"] }),
      queryClient.invalidateQueries({ queryKey: ["board"] }),
    ]);
  }, [queryClient]);

  const master = useMutation({
    mutationFn: async (status: RsvpStatus) => {
      if (!data?.personId) throw new Error("no person");
      // partySize is deliberately omitted: the master answer no longer carries
      // heads, and any value already on record is left exactly as it is.
      await putRsvp({ data: { personId: data.personId, status } });
    },
    onSuccess: async () => {
      setNote(null);
      await refresh();
    },
    onError: () => setNote("That did not save. Try again in a moment."),
  });

  // Signed out: an invitation only. Never a status, never a name.
  if (!signedIn) return <SignedOutDock />;
  if (!data || !data.personId) return null;

  const statusWords = data.status ? STATUS_LABELS[data.status].toUpperCase() : "NO RESPONSE YET";

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 md:inset-x-auto md:right-6 md:bottom-6 md:left-auto md:justify-end md:px-0 md:pb-0"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto w-full max-w-[420px]">
        {open ? (
          <Panel
            id={panelId}
            innerRef={panelRef}
            title={`${data.eventYear} Alumni Weekend RSVP`}
            onMinimise={() => setOpenPersisted(false)}
          >
            <p className="label-caps mt-1" style={{ color: "var(--sterling)" }}>
              Master RSVP
            </p>
            <p
              className="mt-1 flex items-center gap-2"
              style={{ fontFamily: "var(--font-mono)", fontSize: 14, color: "var(--steel-ink)" }}
            >
              {data.status === "going" && (
                <span
                  aria-hidden="true"
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: 999,
                    background: "var(--pitt-gold)",
                    display: "inline-block",
                  }}
                />
              )}
              YOUR ANSWER: {statusWords}
            </p>

            {data.editable ? (
              <div className="mt-3 grid grid-cols-3 gap-2">
                {RSVP_STATUSES.map((s) => {
                  const selected = data.status === s;
                  const gold = selected && s === "going";
                  return (
                    <button
                      key={s}
                      type="button"
                      aria-pressed={selected}
                      disabled={master.isPending}
                      onClick={() => master.mutate(s)}
                      className="label-caps"
                      style={{
                        minHeight: 44,
                        borderRadius: 7,
                        padding: "0 8px",
                        cursor: master.isPending ? "default" : "pointer",
                        background: gold
                          ? "var(--pitt-gold)"
                          : selected
                            ? "var(--pitt-royal)"
                            : "var(--pure-white)",
                        color: gold
                          ? "var(--sabah-black)"
                          : selected
                            ? "var(--pure-white)"
                            : "var(--steel-ink)",
                        border: `1px solid ${selected ? "transparent" : "var(--chalk)"}`,
                        fontWeight: selected ? 700 : 400,
                      }}
                    >
                      {STATUS_LABELS[s]}
                    </button>
                  );
                })}
              </div>
            ) : (
              <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
                That weekend has ended, so this card is now a record. The next edition gets its own.
              </p>
            )}

            {note && (
              <p className="mt-2" role="status" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
                {note}
              </p>
            )}

            {data.events.length > 0 && (
              <div className="mt-5 pt-4" style={{ borderTop: "1px solid var(--concrete)" }}>
                <p className="label-caps" style={{ color: "var(--sterling)" }}>
                  Individual events
                </p>
                <ul className="mt-1 flex flex-col">
                  {data.events.map((row) => (
                    <li
                      key={row.id}
                      className="py-3"
                      style={{ borderBottom: "1px solid var(--concrete)" }}
                    >
                      <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>{row.title}</p>
                      <p className="label-caps mt-0.5" style={{ color: "var(--sterling)" }}>
                        {[eventWhen(row), row.location].filter(Boolean).join(" · ")}
                      </p>
                      <div className="mt-2">
                        {data.editable ? (
                          <DockEventRow
                            row={row}
                            onSave={async (state, size) => {
                              const result = await putEvent({
                                data: { eventId: row.id, state, partySize: size },
                              });
                              await refresh();
                              return { promotedToGoing: Boolean(result.promotedToGoing) };
                            }}
                          />
                        ) : (
                          <span className="label-caps" style={{ color: "var(--steel-ink)" }}>
                            {row.answer === "yes"
                              ? `Yes${row.party_size > 1 ? ` · ${row.party_size} heads` : ""}`
                              : row.answer === "no"
                                ? "No"
                                : "No choice made"}
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </Panel>
        ) : (
          <Collapsed
            buttonRef={toggleRef}
            controls={panelId}
            year={data.eventYear}
            statusWords={statusWords}
            going={data.status === "going"}
            onOpen={() => setOpenPersisted(true)}
          />
        )}
      </div>
    </div>
  );
}

/** The shared silhouette: a strong cut on the top right with softened
 *  vertices, and the separation shadow carried on a plate behind the content
 *  so type is never blurred by the filter. */
function Shell({
  children,
  className,
  notch = 26,
}: {
  children: React.ReactNode;
  className?: string;
  notch?: number;
}) {
  return (
    <div className={className} style={{ position: "relative" }}>
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          filter: "drop-shadow(0 14px 30px rgba(11,11,12,0.24))",
        }}
      >
        <NotchedBox
          corners={["tr"]}
          notch={notch}
          fill="var(--pure-white)"
          stroke="var(--chalk)"
          style={{ height: "100%" }}
        />
      </div>
      <div style={{ position: "relative" }}>{children}</div>
    </div>
  );
}

function Collapsed({
  buttonRef,
  controls,
  year,
  statusWords,
  going,
  onOpen,
}: {
  buttonRef: React.RefObject<HTMLButtonElement | null>;
  controls: string;
  year: number;
  statusWords: string;
  going: boolean;
  onOpen: () => void;
}) {
  return (
    <Shell notch={22}>
      <button
        ref={buttonRef}
        type="button"
        aria-expanded={false}
        aria-controls={controls}
        onClick={onOpen}
        className="flex w-full items-center gap-4 text-left"
        style={{
          background: "transparent",
          border: "none",
          minHeight: 64,
          padding: "12px 16px 12px 18px",
          cursor: "pointer",
        }}
      >
        <span className="min-w-0 flex-1">
          <span
            className="display-30 block"
            style={{ fontSize: 19, color: "var(--sabah-black)" }}
          >
            {year} RSVP
          </span>
          <span className="label-caps mt-0.5 block" style={{ color: "var(--sterling)" }}>
            Master RSVP
          </span>
          <span
            className="mt-0.5 flex items-center gap-2"
            style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "var(--steel-ink)" }}
          >
            {going && (
              <span
                aria-hidden="true"
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: 999,
                  background: "var(--pitt-gold)",
                  display: "inline-block",
                }}
              />
            )}
            {statusWords}
          </span>
        </span>
        <span
          className="label-caps shrink-0"
          style={{
            background: "var(--pitt-royal)",
            color: "var(--pure-white)",
            borderRadius: 7,
            padding: "11px 14px",
          }}
        >
          Update
        </span>
      </button>
    </Shell>
  );
}

function Panel({
  id,
  innerRef,
  title,
  onMinimise,
  children,
}: {
  id: string;
  innerRef: React.RefObject<HTMLDivElement | null>;
  title: string;
  onMinimise: () => void;
  children: React.ReactNode;
}) {
  return (
    <Shell>
      <section
        id={id}
        ref={innerRef}
        aria-label={title}
        className="overflow-y-auto overscroll-contain px-5 pb-5 pt-4"
        style={{ maxHeight: "min(70vh, 560px)" }}
      >
        <div className="flex items-start gap-3">
          <h2
            className="display-30 min-w-0 flex-1"
            style={{ fontSize: 21, color: "var(--sabah-black)" }}
          >
            {title}
          </h2>
          <button
            type="button"
            aria-label="Minimise the RSVP card"
            onClick={onMinimise}
            style={{
              width: 44,
              height: 44,
              marginTop: -6,
              marginRight: 18,
              borderRadius: 999,
              border: "1px solid var(--chalk)",
              background: "var(--pure-white)",
              color: "var(--steel-ink)",
              lineHeight: 1,
              cursor: "pointer",
            }}
          >
            −
          </button>
        </div>
        {children}
      </section>
    </Shell>
  );
}

/** One event, saved on its own, with its own quiet saved or error state. */
function DockEventRow({
  row,
  onSave,
}: {
  row: DockEvent;
  onSave: (state: TriState, partySize: number) => Promise<{ promotedToGoing: boolean }>;
}) {
  const [state, setState] = useState<TriState>(row.answer ?? "unanswered");
  const [party, setParty] = useState(row.party_size);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [promoted, setPromoted] = useState(false);

  useEffect(() => {
    setState(row.answer ?? "unanswered");
    setParty(row.party_size);
  }, [row.answer, row.party_size]);

  const commit = async (next: TriState, size: number) => {
    setState(next);
    setParty(size);
    setPhase("saving");
    try {
      const result = await onSave(next, size);
      setPromoted(result.promotedToGoing);
      setPhase("saved");
    } catch {
      setPhase("error");
    }
  };

  return (
    <div>
      <EventAnswerToggle
        eventTitle={row.title}
        state={state}
        onStateChange={(next) => void commit(next, next === "yes" ? party : 1)}
        partySize={party}
        onPartySizeChange={(size) => void commit("yes", size)}
        disabled={phase === "saving"}
      />
      <p className="label-caps mt-2" role="status" style={{ color: "var(--sterling)" }}>
        {phase === "saving"
          ? "Saving…"
          : phase === "error"
            ? "That did not save. Try again."
            : phase === "saved"
              ? promoted
                ? "Saved. You are now going for the weekend."
                : "Saved"
              : ""}
      </p>
    </div>
  );
}

/** No status, no name, no private anything: an invitation into the usual
 *  sign in and claim flow. */
function SignedOutDock() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 flex justify-center px-3 pb-3 md:inset-x-auto md:right-6 md:bottom-6 md:left-auto md:justify-end md:px-0 md:pb-0"
      style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
    >
      <div className="pointer-events-auto w-full max-w-[340px]">
        <Shell notch={22}>
          <a
            href={`/auth?next=${encodeURIComponent(pathname)}`}
            className="flex w-full items-center gap-4"
            style={{ minHeight: 64, padding: "12px 16px 12px 18px", textDecoration: "none" }}
          >
            <span className="min-w-0 flex-1">
              <span className="display-30 block" style={{ fontSize: 18, color: "var(--sabah-black)" }}>
                RSVP for the weekend
              </span>
              <span className="label-caps mt-0.5 block" style={{ color: "var(--sterling)" }}>
                Find your name to answer
              </span>
            </span>
            <span
              className="label-caps shrink-0"
              style={{
                background: "var(--pitt-royal)",
                color: "var(--pure-white)",
                borderRadius: 7,
                padding: "11px 14px",
              }}
            >
              Start
            </span>
          </a>
        </Shell>
      </div>
    </div>
  );
}
