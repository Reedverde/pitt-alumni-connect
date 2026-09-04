import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import {
  claimProfile,
  listDivisions,
  searchPeople,
  submitRosterCorrection,
  submitRsvp,
} from "@/lib/rsvp.functions";
import { PartySizeStepper } from "./PartySizeStepper";
import { personDisplayName, STATUS_LABELS, type PersonMatch, type RsvpStatus } from "@/lib/rsvp-types";
import type { ClaimPerson } from "@/lib/claim-types";
import { readRsvpSource } from "@/lib/rsvp-src";
import { useEditionEyebrow } from "@/lib/useEdition";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { ClaimStamp } from "./ClaimStamp";
import { EventSubPrompts } from "./EventSubPrompts";
import { MissingPersonForm } from "./MissingPersonForm";
import { isStructurallyValidEmail } from "@/lib/email-typos";
import { EmailSuggestion, FieldLabel, Notice, fieldStyle, primaryButton, secondaryButton } from "./ui";

export type ClaimTarget = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  board_year: number | null;
  team_label: string | null;
};

/** Claiming your permanent record and answering this year's invitation are two
 *  separate acts. Everything up to "facts" is the claim. The RSVP that follows
 *  is offered, never required: stopping short leaves the year unanswered, and
 *  the organizers' no response count says exactly that. */
type Step =
  | "name"
  | "confirm"
  | "email"
  | "facts"
  | "rsvp"
  | "events"
  | "stamp"
  | "missing"
  | "requested";

/** Quiet text link. Never a button, never gold, never equal weight. */
const quietLink: React.CSSProperties = {
  fontFamily: "var(--font-sans)",
  fontSize: 13,
  fontWeight: 400,
  color: "var(--sterling)",
  background: "none",
  border: "none",
  padding: 0,
  textDecoration: "underline",
  cursor: "pointer",
};

const matchRow: React.CSSProperties = {
  border: "1px solid var(--chalk)",
  borderRadius: 7,
  padding: "11px 13px",
  background: "var(--pure-white)",
};

function factLine(label: string, value: string | null) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1">
      <span className="label-caps" style={{ color: "var(--sterling)" }}>
        {label}
      </span>
      <span style={{ fontSize: 15, color: "var(--steel-ink)", textAlign: "right" }}>
        {value ?? "Not on file"}
      </span>
    </div>
  );
}

export function ClaimDialog({
  open,
  target,
  prefillName,
  onClose,
  onClaimed,
}: {
  open: boolean;
  target: ClaimTarget | null;
  /** Seeds the search box, e.g. what they typed into the board search. */
  prefillName?: string;
  onClose: () => void;
  onClaimed: (personId: string | null) => void;
}) {
  const eyebrow = useEditionEyebrow();
  const runSearch = useServerFn(searchPeople);
  const runClaim = useServerFn(claimProfile);
  const runCorrection = useServerFn(submitRosterCorrection);
  const runSubmit = useServerFn(submitRsvp);
  const { data: divisions } = useQuery({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
    staleTime: 60 * 60 * 1000,
    enabled: open,
  });

  const [step, setStep] = useState<Step>("name");
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<ClaimTarget | null>(null);
  const [claimed, setClaimed] = useState<ClaimPerson | null>(null);
  const [status, setStatus] = useState<RsvpStatus | null>(null);
  const [answered, setAnswered] = useState<RsvpStatus | null>(null);
  const [partySize, setPartySize] = useState(1);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [fixGradYear, setFixGradYear] = useState("");
  const [fixPlayedAs, setFixPlayedAs] = useState("");
  const [fixDivision, setFixDivision] = useState("");
  const [fixNote, setFixNote] = useState("");
  const panelRef = useRef<HTMLDivElement>(null);
  const statusGroupRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setBusy(false);
    setEmail("");
    setStatus(null);
    setAnswered(null);
    setPartySize(1);
    setClaimed(null);
    setCorrecting(false);
    setFixGradYear("");
    setFixPlayedAs("");
    setFixDivision("");
    setFixNote("");
    if (target) {
      setSelected(target);
      setStep("confirm");
    } else {
      setSelected(null);
      setQuery(prefillName?.trim() ?? "");
      setMatches([]);
      setStep("name");
    }
    // prefillName is read at open time only, on purpose.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setError(null);
    setStep("confirm");
  };

  const finish = () => {
    onClaimed(claimed?.id ?? selected?.id ?? null);
    onClose();
  };

  /** Attaches the address and sends the sign in link. No attendance answer is
   *  written here, on purpose. */
  const submitClaim = async () => {
    if (!selected) return;
    if (!isStructurallyValidEmail(email)) {
      setError("That address doesn't look complete. Check for a missing @ or a typo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const result = await runClaim({
        data: {
          personId: selected.id,
          email,
          src: readRsvpSource(),
          origin: window.location.origin,
        },
      });
      if (!result.ok || !result.person) {
        setError(
          "This name is already claimed by a verified account. Sign in with the address on that account to make changes.",
        );
        setBusy(false);
        return;
      }
      setClaimed(result.person);
      setFixGradYear(result.person.grad_year ? String(result.person.grad_year) : "");
      setFixDivision(result.person.division ?? "");
      setBusy(false);
      setStep("facts");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const sendCorrection = async () => {
    if (!claimed) return;
    setBusy(true);
    setError(null);
    try {
      await runCorrection({
        data: {
          personId: claimed.id,
          gradYear: fixGradYear ? Number(fixGradYear) : null,
          playedAs: fixPlayedAs.trim() || null,
          division: fixDivision || null,
          note: fixNote.trim() || null,
          source: "claim_roster_facts",
        },
      });

      setBusy(false);
      setCorrecting(false);
      setStep("rsvp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const submitAnswer = async () => {
    if (!status || !claimed) return;
    setBusy(true);
    setError(null);
    try {
      const result = await runSubmit({
        data: {
          personId: claimed.id,
          status,
          partySize: status === "going" ? partySize : 1,
          email,
          src: readRsvpSource(),
          origin: window.location.origin,
          // The claim step already mailed this address its sign in link.
          skipConfirmationEmail: true,
        },
      });
      if (!result.ok || result.written !== true) {
        setError("We could not save your answer. Nothing was recorded, please try again.");
        setBusy(false);
        return;
      }
      setAnswered(status);
      setBusy(false);
      setStep(status === "going" ? "events" : "stamp");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  const heading =
    step === "name"
      ? "Find your name"
      : step === "confirm"
        ? "Is this you?"
        : step === "email"
          ? "Where do we reach you?"
          : step === "facts"
            ? "Does this look right?"
            : step === "missing"
              ? "Add your name"
              : "Are you coming?";

  const selectedName = selected ? personDisplayName(selected) : "";
  const closeButton = (
    <button type="button" onClick={onClose} className="label-caps" style={{ color: "var(--sterling)" }}>
      Close
    </button>
  );

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
              Your details went to the organizers for review. Check your email for a sign in link.
              Your name goes on the board once someone has placed you, and you can say whether you
              are coming any time after that.
            </p>
            <div className="mt-6">
              <button type="button" style={primaryButton} onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : step === "events" && claimed ? (
          <div>
            <SlashEyebrow>{eyebrow}</SlashEyebrow>
            <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
              You're in. Two quick things.
            </h2>
            <div className="mt-4">
              <EventSubPrompts personId={claimed.id} onDone={() => setStep("stamp")} />
            </div>
          </div>
        ) : step === "stamp" && claimed ? (
          <div className="flex flex-col items-center">
            <ClaimStamp year={claimed.board_year} teamLabel={claimed.team_label} onDone={finish} />
            <p className="text-center" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
              {answered
                ? "Your name is yours and your answer is saved. Check your email to finish signing in."
                : "Your name is yours. Check your email to finish signing in."}
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
              {closeButton}
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
                <div className="mt-5">
                  {query.trim().length >= 2 && (
                    <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
                      {searching
                        ? "Looking…"
                        : matches.some((m) => (m.tier ?? 0) < 2)
                          ? "Did you mean…"
                          : "No match yet"}
                    </p>
                  )}
                  <ul className="flex flex-col gap-2">
                    {matches
                      .filter((m) => (m.tier ?? 0) < 2)
                      .map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => pick(m)}
                            className="flex w-full items-baseline justify-between gap-3 text-left"
                            style={matchRow}
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
                    {!searching && matches.some((m) => (m.tier ?? 0) === 2) && (
                      <li>
                        {/* Close spellings are offered, never preselected. */}
                        <p className="label-caps mb-1 mt-2" style={{ color: "var(--sterling)" }}>
                          Did you mean one of these?
                        </p>
                      </li>
                    )}
                    {matches
                      .filter((m) => (m.tier ?? 0) === 2)
                      .map((m) => (
                        <li key={m.id}>
                          <button
                            type="button"
                            onClick={() => pick(m)}
                            className="flex w-full items-baseline justify-between gap-3 text-left"
                            style={matchRow}
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
                      <button
                        type="button"
                        onClick={() => setStep("missing")}
                        style={{ ...secondaryButton, width: "100%" }}
                      >
                        I'm not on here, add me
                      </button>
                    </li>
                  </ul>
                </div>
              </div>
            )}

            {step === "missing" && (
              <MissingPersonForm
                prefillName={query || prefillName}
                onPickExisting={pick}
                onSubmitted={() => setStep("requested")}
                onBack={() => setStep("name")}
              />
            )}

            {step === "confirm" && selected && (
              <div className="mt-6">
                <p className="display-30" style={{ fontSize: 22, color: "var(--sabah-black)" }}>
                  {selectedName}
                </p>
                <p className="mt-1" style={{ fontSize: 14, color: "var(--sterling)" }}>
                  {[selected.team_label, selected.board_year ? String(selected.board_year) : null]
                    .filter(Boolean)
                    .join(" · ") || "On the board"}
                </p>
                <Notice>
                  Claiming your name is yours to keep. Saying whether you are coming is a separate
                  question, and it comes next.
                </Notice>
                <div className="mt-6 flex flex-wrap gap-2">
                  <button type="button" style={primaryButton} onClick={() => setStep("email")}>
                    Yes, this is me
                  </button>
                  <button
                    type="button"
                    style={secondaryButton}
                    onClick={() => {
                      setSelected(null);
                      setStep("name");
                    }}
                  >
                    Not me
                  </button>
                </div>
              </div>
            )}

            {step === "email" && (
              <form
                className="mt-6"
                onSubmit={(e) => {
                  e.preventDefault();
                  void submitClaim();
                }}
              >
                <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>{selectedName}</p>
                <div className="mt-4">
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
                </div>
                <EmailSuggestion value={email} onAccept={setEmail} />
                <Notice>
                  We'll send a sign in link so you can update your record later. No password, ever,
                  and your address is never shown on the board.
                </Notice>
                {error && (
                  <p className="mt-3" role="alert" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-6 flex gap-2">
                  <button type="button" style={secondaryButton} onClick={() => setStep("confirm")}>
                    Back
                  </button>
                  <button
                    type="submit"
                    style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}
                    disabled={busy}
                  >
                    {busy ? "Claiming…" : "Claim my name"}
                  </button>
                </div>
              </form>
            )}

            {step === "facts" && claimed && (
              <div className="mt-6">
                <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                  This is what the roster says about you. Fixing it is optional.
                </p>
                <div className="mt-4" style={{ borderTop: "1px solid var(--concrete)" }}>
                  {factLine("Program", claimed.division_label ?? claimed.team_label)}
                  {factLine("Years", claimed.years_label)}
                  {factLine("Class of", claimed.grad_year ? String(claimed.grad_year) : null)}
                  {factLine("Played as", claimed.played_as)}
                </div>

                {correcting && (
                  <div className="mt-5 grid gap-3">
                    <div>
                      <FieldLabel htmlFor="fix-division">Program</FieldLabel>
                      <select
                        id="fix-division"
                        style={fieldStyle}
                        value={fixDivision}
                        onChange={(e) => setFixDivision(e.target.value)}
                      >
                        <option value="">Not sure</option>
                        {(divisions ?? []).map((d) => (
                          <option key={d.code} value={d.code}>
                            {d.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <FieldLabel htmlFor="fix-grad">Graduation year</FieldLabel>
                      <input
                        id="fix-grad"
                        inputMode="numeric"
                        style={fieldStyle}
                        value={fixGradYear}
                        onChange={(e) => setFixGradYear(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="fix-played">Played as</FieldLabel>
                      <input
                        id="fix-played"
                        style={fieldStyle}
                        placeholder="Optional"
                        value={fixPlayedAs}
                        onChange={(e) => setFixPlayedAs(e.target.value)}
                      />
                    </div>
                    <div>
                      <FieldLabel htmlFor="fix-note">Anything else</FieldLabel>
                      <textarea
                        id="fix-note"
                        style={{ ...fieldStyle, minHeight: 72 }}
                        placeholder="Optional. Years, team, whatever is off."
                        value={fixNote}
                        onChange={(e) => setFixNote(e.target.value)}
                      />
                    </div>
                    <p style={{ fontSize: 13, color: "var(--sterling)" }}>
                      Corrections go to the organizers for review.
                    </p>
                  </div>
                )}

                {error && (
                  <p className="mt-3" role="alert" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
                    {error}
                  </p>
                )}

                <div className="mt-6 flex flex-wrap items-center gap-3">
                  {correcting ? (
                    <>
                      <button
                        type="button"
                        style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }}
                        disabled={busy}
                        onClick={() => void sendCorrection()}
                      >
                        {busy ? "Sending…" : "Send correction"}
                      </button>
                      <button type="button" style={quietLink} onClick={() => setCorrecting(false)}>
                        Never mind
                      </button>
                    </>
                  ) : (
                    <>
                      <button type="button" style={primaryButton} onClick={() => setStep("rsvp")}>
                        Looks right
                      </button>
                      <button type="button" style={quietLink} onClick={() => setCorrecting(true)}>
                        Something is off
                      </button>
                    </>
                  )}
                </div>
              </div>
            )}

            {step === "rsvp" && claimed && (
              <div className="mt-6">
                <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                  Your name is claimed. This last part is about October, and you can answer later if
                  you would rather wait.
                </p>
                <div ref={statusGroupRef} className="mt-5 grid gap-2 md:grid-cols-3">
                  {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => {
                    const on = status === s;
                    return (
                      <button
                        key={s}
                        type="button"
                        aria-pressed={on}
                        onClick={() => {
                          setStatus(s);
                          if (s !== "going") setPartySize(1);
                        }}
                        style={{ ...(on ? primaryButton : secondaryButton), width: "100%" }}
                      >
                        {STATUS_LABELS[s]}
                      </button>
                    );
                  })}
                </div>
                {status === "going" && <PartySizeStepper value={partySize} onChange={setPartySize} />}
                {error && (
                  <p className="mt-3" role="alert" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
                    {error}
                  </p>
                )}
                <div className="mt-6 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    style={{ ...primaryButton, opacity: status && !busy ? 1 : 0.5 }}
                    aria-disabled={!status || busy}
                    onClick={() => {
                      if (!status) {
                        statusGroupRef.current?.querySelector<HTMLElement>("button")?.focus();
                        return;
                      }
                      void submitAnswer();
                    }}
                  >
                    {busy ? "Saving…" : "Save my answer"}
                  </button>
                  <button type="button" style={quietLink} onClick={() => setStep("stamp")}>
                    I'll answer later
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
