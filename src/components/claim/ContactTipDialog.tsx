import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { suggestContactTip } from "@/lib/account.functions";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { FieldLabel, fieldStyle, primaryButton } from "./ui";

export type ContactTipTarget = {
  id: string;
  first_name: string;
  last_name: string | null;
};

/** Collects a way to reach someone with no contact info on file. It never
 *  displays an address: tips only go one direction, into the review queue. */
export function ContactTipDialog({
  open,
  target,
  onClose,
}: {
  open: boolean;
  target: ContactTipTarget | null;
  onClose: () => void;
}) {
  const submit = useServerFn(suggestContactTip);
  const [contact, setContact] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setContact("");
    setNote("");
    setError(null);
    setBusy(false);
    setDone(false);
  }, [open, target]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    panelRef.current?.querySelector<HTMLElement>("input,button")?.focus();
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || !target) return null;

  const fullName = [target.first_name, target.last_name].filter(Boolean).join(" ");
  const heading = `Help us reach ${target.first_name}`;

  const send = async () => {
    setBusy(true);
    setError(null);
    try {
      await submit({
        data: { personId: target.id, contactValue: contact, contextNote: note },
      });
      setDone(true);
      window.setTimeout(onClose, 1400);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't send that.");
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center overflow-y-auto p-0 md:items-center md:p-6"
      style={{ background: "rgba(11,11,12,0.45)" }}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={heading}
        className="w-full max-w-[520px] p-6 md:p-8"
        style={{ background: "var(--pure-white)", border: "1px solid var(--chalk)", borderRadius: 7 }}
      >
        <SlashEyebrow>No contact info</SlashEyebrow>
        <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
          {heading}
        </h2>

        {done ? (
          <p className="mt-4" style={{ fontSize: 15, color: "var(--steel-ink)" }} aria-live="polite">
            Thanks — we'll follow up.
          </p>
        ) : (
          <>
            <p className="mt-3" style={{ fontSize: 13, color: "var(--sterling)" }}>
              We have no way to reach {fullName}. Anything you send goes to the organizers only.
            </p>

            <div className="mt-5">
              <FieldLabel htmlFor="contact-tip-value">
                Email or phone number for {fullName}
              </FieldLabel>
              <input
                id="contact-tip-value"
                value={contact}
                maxLength={200}
                placeholder="email or phone"
                onChange={(e) => setContact(e.target.value)}
                style={fieldStyle}
              />
            </div>

            <div className="mt-4">
              <FieldLabel htmlFor="contact-tip-note">How do you know them?</FieldLabel>
              <input
                id="contact-tip-note"
                value={note}
                maxLength={200}
                placeholder="e.g. we played together in 2013"
                onChange={(e) => setNote(e.target.value)}
                style={fieldStyle}
              />
            </div>

            {error && (
              <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
                {error}
              </p>
            )}

            <div className="mt-6 flex items-center gap-4">
              <button
                type="button"
                style={{ ...primaryButton, opacity: busy || contact.trim().length < 3 ? 0.5 : 1 }}
                disabled={busy || contact.trim().length < 3}
                onClick={() => void send()}
              >
                Submit tip
              </button>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: "none",
                  border: "none",
                  padding: 0,
                  fontFamily: '"Space Grotesk", sans-serif',
                  fontSize: 13,
                  color: "var(--sterling)",
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
