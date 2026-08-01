import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { setMyRsvp } from "@/lib/account.functions";
import { RSVP_STATUSES, STATUS_LABELS, type RsvpStatus } from "@/lib/rsvp-types";
import { useSessionPerson } from "@/lib/useSessionPerson";

/**
 * The signed-in reader's own answer, stated and changeable, directly above the
 * counter bar. Concrete fill only: the single 6px dot is the only gold here.
 */
export function StatusBar() {
  const { signedIn, personId, rsvpStatus } = useSessionPerson();
  const queryClient = useQueryClient();
  const put = useServerFn(setMyRsvp);
  const [pending, setPending] = useState<RsvpStatus | null>(null);

  if (!signedIn || !personId) return null;

  const current = (pending ?? rsvpStatus) as RsvpStatus | null;

  const choose = async (status: RsvpStatus) => {
    if (status === current) return;
    setPending(status);
    try {
      await put({ data: { personId, status } });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["nav-identity"] }),
        queryClient.invalidateQueries({ queryKey: ["board"] }),
      ]);
    } finally {
      setPending(null);
    }
  };

  return (
    <div
      style={{ background: "var(--concrete)", borderBottom: "1px solid var(--chalk)" }}
    >
      <div className="mx-auto flex w-full max-w-[1320px] flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
        <span className="label-caps" style={{ color: "var(--sterling)" }}>
          Your status
        </span>
        <span
          className="inline-flex items-center gap-1.5"
          style={{ color: "var(--pitt-royal)", fontSize: 13, fontWeight: 600 }}
        >
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
            <path
              d="M2 6.4 4.6 9 10 3.2"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="square"
            />
          </svg>
          Claimed
        </span>
        <span className="flex flex-wrap items-center gap-2">
          {RSVP_STATUSES.map((status) => {
            const on = current === status;
            return (
              <button
                key={status}
                type="button"
                aria-pressed={on}
                onClick={() => void choose(status)}
                className="inline-flex items-center gap-1.5 rounded-[7px] px-3 py-2"
                style={{
                  background: on ? "var(--pitt-royal)" : "transparent",
                  border: on ? "1px solid var(--pitt-royal)" : "1px solid var(--steel-ink)",
                  color: on ? "var(--pure-white)" : "var(--steel-ink)",
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                {status === "going" && on && (
                  <span
                    aria-hidden="true"
                    className="inline-block shrink-0 rounded-full"
                    style={{ width: 6, height: 6, background: "var(--pitt-gold)" }}
                  />
                )}
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </span>
      </div>
    </div>
  );
}