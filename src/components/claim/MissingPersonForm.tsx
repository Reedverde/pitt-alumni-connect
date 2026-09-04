import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { listDivisions, searchPeople, submitMissingPerson } from "@/lib/rsvp.functions";
import { personDisplayName, type PersonMatch } from "@/lib/rsvp-types";
import { isStructurallyValidEmail } from "@/lib/email-typos";
import { readRsvpSource } from "@/lib/rsvp-src";
import { EmailSuggestion, FieldLabel, Notice, fieldStyle, primaryButton, secondaryButton } from "./ui";

const NOT_SURE = "not_sure";

const quietRow: React.CSSProperties = {
  border: "1px solid var(--chalk)",
  borderRadius: 7,
  padding: "11px 13px",
  background: "var(--pure-white)",
};

function yearOrNull(value: string) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1970 || n > 2100) return null;
  return Math.round(n);
}

/** The path for someone whose name is not on the board. It collects enough for
 *  an organizer to place them without writing back, offers Not sure wherever a
 *  historical detail may simply be unknown, and shows likely duplicates before
 *  anything is sent. */
export function MissingPersonForm({
  prefillName,
  onPickExisting,
  onSubmitted,
  onBack,
}: {
  prefillName?: string;
  onPickExisting: (match: PersonMatch) => void;
  onSubmitted: () => void;
  onBack: () => void;
}) {
  const runSearch = useServerFn(searchPeople);
  const runSubmit = useServerFn(submitMissingPerson);
  const { data: divisions } = useQuery({
    queryKey: ["divisions"],
    queryFn: () => listDivisions(),
    staleTime: 60 * 60 * 1000,
  });

  const seed = (prefillName ?? "").trim().split(" ");
  const [firstName, setFirstName] = useState(seed[0] ?? "");
  const [lastName, setLastName] = useState(seed.slice(1).join(" "));
  const [playedAs, setPlayedAs] = useState("");
  const [division, setDivision] = useState<string>(NOT_SURE);
  const [startYear, setStartYear] = useState("");
  const [endYear, setEndYear] = useState("");
  const [yearsUnsure, setYearsUnsure] = useState(false);
  const [gradYear, setGradYear] = useState("");
  const [email, setEmail] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupes, setDupes] = useState<PersonMatch[]>([]);

  const fullName = [firstName, lastName].filter(Boolean).join(" ").trim();

  // Likely duplicates are looked up while they type, so the choice to pick an
  // existing record comes before the submission, not after.
  useEffect(() => {
    if (fullName.length < 3) {
      setDupes([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await runSearch({ data: { q: fullName } });
        if (!cancelled) setDupes(results.slice(0, 4));
      } catch {
        if (!cancelled) setDupes([]);
      }
    }, 350);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [fullName, runSearch]);

  const submit = async () => {
    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }
    if (!isStructurallyValidEmail(email)) {
      setError("That address doesn't look complete. Check for a missing @ or a typo.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await runSubmit({
        data: {
          firstName,
          lastName,
          playedAs: playedAs.trim() || null,
          division: division === NOT_SURE ? null : division,
          startYear: yearsUnsure ? null : yearOrNull(startYear),
          endYear: yearsUnsure ? null : yearOrNull(endYear),
          yearsUnsure,
          gradYear: yearOrNull(gradYear),
          email,
          note: note.trim() || null,
          src: readRsvpSource(),
          origin: window.location.origin,
        },
      });
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Try again.");
      setBusy(false);
    }
  };

  return (
    <form
      className="mt-6"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
        Tell us what you can. Anything you are not sure about can stay blank, the organizers will
        place you from the rest.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div>
          <FieldLabel htmlFor="mp-first">First name</FieldLabel>
          <input
            id="mp-first"
            style={fieldStyle}
            autoComplete="given-name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
          />
        </div>
        <div>
          <FieldLabel htmlFor="mp-last">Last name</FieldLabel>
          <input
            id="mp-last"
            style={fieldStyle}
            autoComplete="family-name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
          />
        </div>
      </div>

      <div className="mt-3">
        <FieldLabel htmlFor="mp-played">Played as, if people knew you by something else</FieldLabel>
        <input
          id="mp-played"
          style={fieldStyle}
          placeholder="Optional"
          value={playedAs}
          onChange={(e) => setPlayedAs(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <FieldLabel htmlFor="mp-division">Program</FieldLabel>
        <select
          id="mp-division"
          style={fieldStyle}
          value={division}
          onChange={(e) => setDivision(e.target.value)}
        >
          {(divisions ?? []).map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
          <option value={NOT_SURE}>Not sure</option>
        </select>
      </div>

      <fieldset className="mt-4" style={{ border: "none", padding: 0, margin: 0 }}>
        <legend className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
          Years you played
        </legend>
        <div className="grid gap-3 md:grid-cols-2">
          <div>
            <FieldLabel htmlFor="mp-start">First year</FieldLabel>
            <input
              id="mp-start"
              inputMode="numeric"
              placeholder="e.g. 2009"
              style={{ ...fieldStyle, opacity: yearsUnsure ? 0.5 : 1 }}
              disabled={yearsUnsure}
              value={startYear}
              onChange={(e) => setStartYear(e.target.value)}
            />
          </div>
          <div>
            <FieldLabel htmlFor="mp-end">Last year</FieldLabel>
            <input
              id="mp-end"
              inputMode="numeric"
              placeholder="e.g. 2012"
              style={{ ...fieldStyle, opacity: yearsUnsure ? 0.5 : 1 }}
              disabled={yearsUnsure}
              value={endYear}
              onChange={(e) => setEndYear(e.target.value)}
            />
          </div>
        </div>
        <label
          className="mt-2 flex items-center gap-2"
          style={{ fontSize: 14, color: "var(--steel-ink)" }}
        >
          <input
            type="checkbox"
            checked={yearsUnsure}
            onChange={(e) => setYearsUnsure(e.target.checked)}
          />
          Not sure which years
        </label>
      </fieldset>

      <div className="mt-3">
        <FieldLabel htmlFor="mp-grad">Graduation year</FieldLabel>
        <input
          id="mp-grad"
          inputMode="numeric"
          placeholder="Optional"
          style={fieldStyle}
          value={gradYear}
          onChange={(e) => setGradYear(e.target.value)}
        />
      </div>

      <div className="mt-3">
        <FieldLabel htmlFor="mp-email">Email</FieldLabel>
        <input
          id="mp-email"
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          style={fieldStyle}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <EmailSuggestion value={email} onAccept={setEmail} />
      </div>

      <div className="mt-3">
        <FieldLabel htmlFor="mp-note">Anything else that would help place you</FieldLabel>
        <textarea
          id="mp-note"
          style={{ ...fieldStyle, minHeight: 80 }}
          placeholder="Optional. Captains, teammates, the year you remember best."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />
      </div>

      {dupes.length > 0 && (
        <div className="mt-5">
          <p className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            We may already have you
          </p>
          <ul className="flex flex-col gap-2">
            {dupes.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => onPickExisting(m)}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                  style={quietRow}
                >
                  <span style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                    {personDisplayName(m)}
                  </span>
                  <span
                    className="label-caps"
                    style={{ color: "var(--sterling)", whiteSpace: "nowrap" }}
                  >
                    {[m.team_label, m.years_label].filter(Boolean).join(" · ") || "This is me"}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
            Pick one of these to claim it instead of asking for a new record.
          </p>
        </div>
      )}

      <Notice>
        This goes to the organizers, not onto the board. We will send you a sign in link now, and
        your name appears once someone has placed you.
      </Notice>

      {error && (
        <p className="mt-3" role="alert" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap gap-2">
        <button type="button" style={secondaryButton} onClick={onBack}>
          Back
        </button>
        <button type="submit" style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }} disabled={busy}>
          {busy ? "Sending…" : "Send to the organizers"}
        </button>
      </div>
    </form>
  );
}
