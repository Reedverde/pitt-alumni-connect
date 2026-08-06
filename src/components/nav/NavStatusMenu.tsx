import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { setMyRsvp } from "@/lib/account.functions";
import { RSVP_STATUSES, STATUS_LABELS, type RsvpStatus } from "@/lib/rsvp-types";
import { useSessionPerson } from "@/lib/useSessionPerson";

/**
 * The signed-in reader's own answer, stated in words and changeable, sitting in
 * the nav beside their name. The 6px dot on "going" is the only gold here.
 */
export function NavStatusMenu() {
  const { signedIn, personId, rsvpStatus } = useSessionPerson();
  const queryClient = useQueryClient();
  const put = useServerFn(setMyRsvp);
  const [pending, setPending] = useState<RsvpStatus | null>(null);
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!signedIn || !personId) return null;

  const current = (pending ?? rsvpStatus) as RsvpStatus | null;

  const choose = async (status: RsvpStatus) => {
    setOpen(false);
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
    <div ref={wrap} className="relative flex items-center gap-2">
      <span className="label-caps hidden sm:inline" style={{ color: "var(--sterling)" }}>
        Your 2026 status
      </span>
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label="Your 2026 status"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-[7px] px-2.5 py-1.5"
        style={{
          background: current ? "var(--pitt-royal)" : "transparent",
          border: `1px solid ${current ? "var(--pitt-royal)" : "var(--steel-ink)"}`,
          color: current ? "var(--pure-white)" : "var(--steel-ink)",
          fontFamily: '"Space Grotesk", system-ui, sans-serif',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: "0.08em",
          textTransform: "uppercase",
          whiteSpace: "nowrap",
        }}
      >
        {current === "going" && (
          <span
            aria-hidden="true"
            className="inline-block shrink-0 rounded-full"
            style={{ width: 6, height: 6, background: "var(--pitt-gold)" }}
          />
        )}
        {current ? STATUS_LABELS[current] : "No answer yet"}
        <svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true">
          <path d="M1.5 3.5 5 7l3.5-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute right-0 top-full z-50 mt-1 min-w-[180px] rounded-[7px] p-1"
          style={{
            background: "var(--pure-white)",
            border: "1px solid var(--chalk)",
            boxShadow: "0 8px 24px rgba(11,11,12,0.12)",
          }}
        >
          {RSVP_STATUSES.map((status) => {
            const on = current === status;
            return (
              <button
                key={status}
                type="button"
                role="option"
                aria-selected={on}
                onClick={() => void choose(status)}
                className="flex w-full items-center gap-2 rounded-[5px] px-2.5 py-2 text-left"
                style={{
                  background: on ? "var(--concrete)" : "transparent",
                  color: "var(--steel-ink)",
                  fontFamily: '"Space Grotesk", system-ui, sans-serif',
                  fontSize: 12,
                  fontWeight: 600,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                }}
              >
                <span
                  aria-hidden="true"
                  className="inline-block shrink-0 rounded-full"
                  style={{
                    width: 6,
                    height: 6,
                    background: status === "going" ? "var(--pitt-gold)" : "transparent",
                  }}
                />
                {STATUS_LABELS[status]}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
