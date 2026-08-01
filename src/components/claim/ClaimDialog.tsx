import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { searchPeople, submitRsvp } from "@/lib/rsvp.functions";
import { PartySizeStepper } from "./PartySizeStepper";
import {
  personDisplayName,
  STATUS_LABELS,
  type PersonMatch,
  type RsvpStatus,
} from "@/lib/rsvp-types";
import { readRsvpSource } from "@/lib/rsvp-src";
import { useEditionEyebrow } from "@/lib/useEdition";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimStamp } from "./ClaimStamp";
import { FieldLabel, Notice, fieldStyle, primaryButton, secondaryButton } from "./ui";

export type ClaimTarget = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  board_year: number | null;
  team_label: string | null;
};

type Step = "name" | "status" | "email" | "stamp" | "requested";

/** Quiet text link. Never a button, never gold, never equal weight. */
const quietLink: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--sterling)",
  background: "none",
  border: "none",
  padding: 0,
  textDecoration: "none",
};

export function ClaimDialog({
  open,
  target,
  onClose,
  onClaimed,
}: {
  open: boolean;
  target: ClaimTarget | null;
  onClose: () => void;
  onClaimed: () => void;
}) {
  const eyebrow = useEditionEyebrow();
  const runSearch = useServerFn(searchPeople);
  const runSubmit = useServerFn(submitRsvp);

  const [step, setStep] = useState<Step>("name");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimTarget | null>(null);
  const [addingNew, setAddingNew] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [stamp, setStamp] = useState<{ year: number | null; team: string | null } | null>(null);
  const [claimedPersonId, setClaimedPersonId] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setEmail("");
    setStatus(null);
    setPartySize(1);
    setStamp(null);
    setClaimedPersonId(null);
    if (target) {
      setSelected(target);
      setAddingNew(false);
      setStep("status");
    } else {
      setSelected(null);
      setAddingNew(false);
      setQuery("");
      setMatches([]);
      setStep("name");
    }
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

  useEffect(() => {
    if (step !== "name" || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(async () => {
      try {
        const results = await runSearch({ data: { q: query } });
        if (!cancelled) setMatches(results);
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, step, runSearch]);

  if (!open) return null;

  const pick = (match: PersonMatch) => {
    setSelected({
      id: match.id,
      first_name: match.first_name,
      last_name: match.last_name,
      played_as: match.played_as,
      board_year: match.board_year,
      team_label: match.team_label,
    });
    setAddingNew(false);
    setStep("status");
  };

  const pickNew = () => {
    const parts = query.trim().split(" ");
    setFirstName(parts[0] ?? "");
    setLastName(parts.slice(1).join(" "));
    setSelected(null);
    setAddingNew(true);
    setStep("status");
  };

  const submit = async () => {
    if (!status) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runSubmit({
        data: {
          personId: selected?.id ?? null,
          firstName: addingNew ? firstName : null,
          lastName: addingNew ? lastName : null,
          status,
          partySize: status === "going" ? partySize : 1,
          email,
          src: readRsvpSource(),
          origin: window.location.origin,
        },
      });
      if (result.outcome === "review_requested") {
        setStep("requested");
        return;
      }
      if (result.outcome === "sign_in_required") {
        setError(
          "This name is already claimed by a verified account. Sign in with the address on that account to change the answer.",
        );
        setBusy(false);
        return;
      }
      if (!result.ok || result.written !== true || !result.rsvp) {
        setError("We could not save your answer. Nothing was recorded, please try again.");
        setBusy(false);
        return;
      }
      setClaimedPersonId(selected?.id ?? null);
      setStamp({
        year: result.person?.board_year ?? selected?.board_year ?? null,
        team: result.person?.team_label ?? selected?.team_label ?? null,
      });
      setStep("stamp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const heading =
    step === "name" ? "Find your name" : step === "status" ? "Are you coming?" : "Where do we reach you?";

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
        {step === "requested" ? (
          <div>
            <SlashEyebrow>{eyebrow}</SlashEyebrow>
            <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
              Sent to the organizers
            </h2>
            <p className="mt-4" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
              We could not find your name on the board yet, so your request went to the organizers
              for review. You will hear back once it is added.
            </p>
            <div className="mt-6">
              <button type="button" style={primaryButton} onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : step === "stamp" && stamp ? (
          <div className="flex flex-col items-center">
            <ClaimStamp
              year={stamp.year}
              teamLabel={stamp.team}
              onDone={() => {
                onClaimed();
                onClose();
              }}
            />
            <p className="text-center" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
              You're on the board. Check your email to finish signing in.
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <SlashEyebrow>{eyebrow}</SlashEyebrow>
                <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
                  {heading}
                </h2>
              </div>
              <button type="button" onClick={onClose} className="label-caps" style={{ color: "var(--sterling)" }}>
                Close
              </button>
            </div>

            {step === "name" && (
              <div className="mt-6">
                <FieldLabel htmlFor="claim-name">Your name</FieldLabel>
                <input
                  id="claim-name"
                  style={fieldStyle}
                  value={query}
                  autoComplete="name"
                  placeholder="Start typing"
                  onChange={(e) => setQuery(e.target.value)}
                />
                {query.trim().length >= 2 && (
                  <div className="mt-5">
                    <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
                      {searching ? "Looking…" : matches.length ? "Did you mean…" : "No match yet"}
                    </p>
                    <ul className="flex flex-col gap-2">
                      {matches.map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => pick(m)}
                            className="flex w-full items-baseline justify-between gap-3 text-left"
                            style={{
                              border: "1px solid var(--chalk)",
                              borderRadius: 7,
                              padding: "11px 13px",
                              background: "var(--pure-white)",
                            }}
                          >
                            <span style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                              {personDisplayName(m)}
                            </span>
                            <span
                              className="label-caps"
                              style={{ color: "var(--sterling)", whiteSpace: "nowrap" }}
                            >
                              {[m.team_label, m.years_label].filter(Boolean).join(" · ")}
                            </span>
                          </button>
                        </li>
                      ))}
                      <li>
                        <button type="button" onClick={pickNew} style={{ ...secondaryButton, width: "100%" }}>
                          None of these, add me
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            )}

            {step === "status" && (
              <div className="mt-6">
                <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                  {selected ? personDisplayName(selected) : [firstName, lastName].filter(Boolean).join(" ")}
                </p>
                {addingNew && (
                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <FieldLabel htmlFor="claim-first">First name</FieldLabel>
                      <input
                        id="claim-first"
                        style={fieldStyle}
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="claim-last">Last name</FieldLabel>
                      <input
                        id="claim-last"
                        style={fieldStyle}
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <div ref={statusGroupRef} className="mt-5 grid gap-2 md:grid-cols-3">
                  {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => {
                    const on = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => {
                          setStatus(s);
                          if (s !== "going") setPartySize(1);
                        }}
                        style={{
                          ...(on ? primaryButton : secondaryButton),
                          width: "100%",
                        }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
                {status === "going" && (
                  <PartySizeStepper value={partySize} onChange={setPartySize} />
                )}
                <div className="mt-6 flex gap-2">
                  {!target && (
                    <button type="button" style={secondaryButton} onClick={() => setStep("name")}>
                      Back
                    </button>
                  )}
                  <button
                    type="button"
                    style={{ ...primaryButton, opacity: status ? 1 : 0.5 }}
                    aria-disabled={!status}
                    onClick={() => {
                      if (!status) {
                        statusGroupRef.current?.querySelector<HTMLElement>("button")?.focus();
                        return;
                      }
                      setStep("email");
                    }}
                  >
                    Continue
                  </button>
                </div>
              </div>
            )}

            {step === "email" && (
              <form
                className="mt-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submit();
                }}
              >
                <FieldLabel htmlFor="claim-email">Email</FieldLabel>
                <input
                  id="claim-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  required
                  style={fieldStyle}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
                <Notice>
                  We'll send you a sign-in link so you can update your record later. No password, ever.
                </Notice>
                {error && (
                  <p className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-6 flex gap-2">
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={() => setStep("status")}
                  >
                    Back
                  </button>
                  <button type="submit" style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }} disabled={busy}>
                    {busy ? "Saving…" : "Save my answer"}
                  </button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}