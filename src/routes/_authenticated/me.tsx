import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  addMyEmail,
  addMeAsPerson,
  amIPreapproved,
  claimPersonAsMe,
  confirmMyProfile,
  correctMyProfile,
  getMyProfile,
  getPendingVerifications,
  removeMyEmail,
  removeStint,
  reportMemorial,
  saveStint,
  setMyEventAnswer,
  setMyRsvp,
  setPrimaryEmail,
  suggestNewPerson,
  updateMyProfile,
  vouchForPerson,
  type MyEventAnswer,
  type MyProfile,
} from "@/lib/account.functions";
import { EventAnswerToggle, type TriState } from "@/components/events/EventAnswerToggle";
import { searchPeople } from "@/lib/rsvp.functions";
import { personDisplayName as matchName, type PersonMatch } from "@/lib/rsvp-types";
import { STATUS_LABELS, personDisplayName, type RsvpStatus } from "@/lib/rsvp-types";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import {
  emailStateLabel,
  profileReviewSentence,
  type ProfileReviewSummary,
} from "@/lib/profile-review";
import { isStructurallyValidEmail } from "@/lib/email-typos";
import {
  EmailSuggestion,
  FieldLabel,
  Notice,
  fieldStyle,
  primaryButton,
  secondaryButton,
} from "@/components/claim/ui";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { NotchedBox } from "@/components/media/NotchedBox";
import { consumeSignInConfirmed } from "@/lib/event-intent";

/** The attendance page is a normal page of the site: header, content, footer.
 *  Signing out must never be the only way off it. */
function Chrome({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--field-white)" }} className="flex min-h-screen flex-col">
      <SiteNav />
      {children}
      <SiteFooter />
    </div>
  );
}

const DIVISIONS = [
  { code: "MENS_A", label: "En Sabah Nur" },
  { code: "MENS_B", label: "Sabah B / BITT / Pressure" },
  { code: "WOMENS_A", label: "Pansy / Danger" },
  { code: "WOMENS_B", label: "Danger B" },
];

const CURRENT_YEAR = new Date().getFullYear();

export const Route = createFileRoute("/_authenticated/me")({
  head: () => ({
    meta: [
      { title: "Your record — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "Update your name, city, emails, the years you played, and your answer for the next alumni weekend.",
      },
      { property: "og:title", content: "Your record — Pitt Club Ultimate Alumni" },
      { property: "og:description", content: "Update your alumni record and your weekend answer." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MePage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="py-8" style={{ borderTop: "1px solid var(--chalk)" }}>
      <h2 className="label-caps mb-4" style={{ color: "var(--sterling)" }}>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Signed in and verified, but we do not yet know which name is theirs. Never
 *  a dead end and never an account step: the link already made the account. */
function NoRecordPanel({ onDone }: { onDone: () => void }) {
  const runSearch = useServerFn(searchPeople);
  const runClaim = useServerFn(claimPersonAsMe);
  const runAdd = useServerFn(addMeAsPerson);
  const askPreapproved = useServerFn(amIPreapproved);

  const [mode, setMode] = useState<"choose" | "find" | "add">("choose");
  const [preapproved, setPreapproved] = useState(false);
  const [query, setQuery] = useState("");
  const [matches, setMatches] = useState<PersonMatch[]>([]);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void askPreapproved()
      .then((r) => setPreapproved(r.preapproved))
      .catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (mode !== "find" || query.trim().length < 2) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      try {
        const results = await runSearch({ data: { q: query } });
        if (!cancelled) setMatches(results);
      } catch {
        /* a failed lookup is not an error state here */
      }
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, mode, runSearch]);

  const attach = async (personId: string) => {
    setBusy(true);
    setError(null);
    try {
      await runClaim({ data: { personId } });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  };

  const addMe = async () => {
    setBusy(true);
    setError(null);
    try {
      const year = Number.parseInt(gradYear, 10);
      await runAdd({
        data: {
          firstName,
          lastName: lastName || null,
          gradYear: Number.isFinite(year) ? year : null,
        },
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work. Try again.");
      setBusy(false);
    }
  };

  return (
    <div>
      <SlashEyebrow>You are in</SlashEyebrow>
      <h1 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
        WHICH NAME IS YOURS?
      </h1>
      <Notice>
        {preapproved
          ? "You are in. We just do not know which name on the board is yours."
          : "Your email is verified. We just do not know which name on the board is yours."}
      </Notice>

      {error && (
        <p className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {error}
        </p>
      )}

      {mode === "choose" && (
        <div className="mt-6 flex flex-wrap gap-2">
          <button type="button" style={primaryButton} onClick={() => setMode("find")}>
            Find my name on the board
          </button>
          <button type="button" style={secondaryButton} onClick={() => setMode("add")}>
            I'm not on here, add me
          </button>
        </div>
      )}

      {mode === "find" && (
        <div className="mt-6">
          <FieldLabel htmlFor="me-find">Your name</FieldLabel>
          <input
            id="me-find"
            style={fieldStyle}
            value={query}
            autoComplete="name"
            placeholder="Start typing"
            onChange={(e) => setQuery(e.target.value)}
          />
          <ul className="mt-4 flex flex-col gap-2">
            {matches.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void attach(m.id)}
                  className="flex w-full items-baseline justify-between gap-3 text-left"
                  style={{
                    border: "1px solid var(--chalk)",
                    borderRadius: 7,
                    padding: "11px 13px",
                    background: "var(--pure-white)",
                  }}
                >
                  <span style={{ fontSize: 15, color: "var(--steel-ink)" }}>{matchName(m)}</span>
                  <span className="label-caps" style={{ color: "var(--sterling)", whiteSpace: "nowrap" }}>
                    {[m.team_label, m.years_label].filter(Boolean).join(" · ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" style={secondaryButton} onClick={() => setMode("choose")}>
              Back
            </button>
            <button
              type="button"
              style={secondaryButton}
              onClick={() => {
                const parts = query.trim().split(" ");
                setFirstName(parts[0] ?? "");
                setLastName(parts.slice(1).join(" "));
                setMode("add");
              }}
            >
              I'm not on here, add me
            </button>
          </div>
        </div>
      )}

      {mode === "add" && (
        <form
          className="mt-6"
          onSubmit={(e) => {
            e.preventDefault();
            void addMe();
          }}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <FieldLabel htmlFor="me-first">First name</FieldLabel>
              <input
                id="me-first"
                style={fieldStyle}
                required
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
              />
            </div>
            <div>
              <FieldLabel htmlFor="me-last">Last name</FieldLabel>
              <input
                id="me-last"
                style={fieldStyle}
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
              />
            </div>
          </div>
          <div className="mt-3 max-w-[200px]">
            <FieldLabel htmlFor="me-year">Class year (optional)</FieldLabel>
            <input
              id="me-year"
              inputMode="numeric"
              style={fieldStyle}
              value={gradYear}
              onChange={(e) => setGradYear(e.target.value)}
            />
          </div>
          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" style={secondaryButton} onClick={() => setMode("choose")}>
              Back
            </button>
            <button type="submit" style={{ ...primaryButton, opacity: busy ? 0.6 : 1 }} disabled={busy}>
              {busy ? "Saving…" : "Add me"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function MePage() {
  const navigate = useNavigate();
  const loadProfile = useServerFn(getMyProfile);
  const saveProfile = useServerFn(updateMyProfile);
  const confirmProfile = useServerFn(confirmMyProfile);
  const correctProfile = useServerFn(correctMyProfile);
  const addEmail = useServerFn(addMyEmail);
  const dropEmail = useServerFn(removeMyEmail);
  const makePrimary = useServerFn(setPrimaryEmail);
  const putStint = useServerFn(saveStint);
  const dropStint = useServerFn(removeStint);
  const putRsvp = useServerFn(setMyRsvp);
  const putEventAnswer = useServerFn(setMyEventAnswer);
  const loadPending = useServerFn(getPendingVerifications);
  const vouch = useServerFn(vouchForPerson);
  const suggest = useServerFn(suggestNewPerson);
  const memorial = useServerFn(reportMemorial);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof getPendingVerifications>>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Set once, on arrival from an email sign-in link that carried no more
  // specific unfinished action. It survives the identity-attach step, so a
  // brand new record still lands on the question straight afterwards.
  const [justConfirmed, setJustConfirmed] = useState(false);
  const rsvpHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const handedOff = useRef(false);

  const refresh = async () => {
    const next = await loadProfile();
    setProfile(next);
    if (next.person) setPending(await loadPending({ data: { personId: next.person.id } }));
  };

  // Read once and remembered: the flag is one-time, and a double-invoked
  // mount must not consume it and then conclude it was never there.
  const confirmedRef = useRef<boolean | null>(null);
  useEffect(() => {
    if (confirmedRef.current === null) confirmedRef.current = consumeSignInConfirmed();
    if (confirmedRef.current) setJustConfirmed(true);
  }, []);

  // The profile arrives asynchronously, so the handoff waits for the data
  // rather than for a hash. Anyone who has already answered is left alone.
  const needsAnswer = Boolean(
    profile?.person && !profile.rsvp && profile.rsvpEditable,
  );
  useEffect(() => {
    if (!justConfirmed || handedOff.current || !profile) return;
    if (!profile.person) return;
    if (!needsAnswer) {
      setJustConfirmed(false);
      return;
    }
    const node = rsvpHeadingRef.current;
    if (!node) return;
    handedOff.current = true;
    node.scrollIntoView({ block: "start", behavior: "smooth" });
    node.focus({ preventScroll: true });

  }, [justConfirmed, needsAnswer, profile]);

  useEffect(() => {
    void refresh().catch(() => setError("Couldn't load your record."));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const run = async (fn: () => Promise<unknown>, message: string) => {
    setError(null);
    try {
      await fn();
      setStatus(message);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't save.");
    }
  };

  if (!profile) {
    return (
      <Chrome>
        <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16">
          <p style={{ color: "var(--sterling)" }}>{error ?? "Loading your record…"}</p>
        </main>
      </Chrome>
    );
  }

  const person = profile.person;

  if (!person) {
    return (
      <Chrome>
        <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16">
          <NoRecordPanel onDone={() => void refresh()} />
        </main>
      </Chrome>
    );
  }

  // The team names people actually used win over the database's neutral
  // labels; the table only supplies programs this project has not named.
  const divisions = [
    ...DIVISIONS,
    ...profile.divisions.filter((d) => !DIVISIONS.some((known) => known.code === d.code)),
  ];
  const divisionLabel = (code: string) =>
    divisions.find((d) => d.code === code)?.label ?? code;
  const editionYear = profile.edition?.event_year ?? CURRENT_YEAR;
  const annualTitle = `${editionYear} Alumni Weekend RSVP`;
  const answerLabel = profile.rsvp ? STATUS_LABELS[profile.rsvp as RsvpStatus] : "No response";

  return (
    <Chrome>
    <main id="main" className="mx-auto w-full max-w-[720px] flex-1 px-5 py-12">
      <SlashEyebrow>Your record</SlashEyebrow>
      <h1 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
        {personDisplayName(person).toUpperCase()}
      </h1>
      <p className="mt-2">
        <Link
          to="/"
          hash={`person-${person.id}`}
          style={{ fontFamily: '"Space Grotesk", sans-serif', fontSize: 13, color: "var(--sterling)" }}
        >
          See your chip on the board
        </Link>
      </p>

      {/* The annual answer is reachable in one click, so nobody has to scroll
          past every permanent field to change their mind about October. */}
      <p
        className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1"
        style={{ fontSize: 14, color: "var(--steel-ink)" }}
      >
        <span className="label-caps" style={{ color: "var(--sterling)" }}>
          {editionYear}
        </span>
        <span style={{ fontFamily: '"Space Mono", monospace' }}>{answerLabel.toUpperCase()}</span>
        <a href="#annual" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {profile.rsvpEditable ? (profile.rsvp ? "Change it" : "Answer now") : "See the card"}
        </a>
      </p>

      {status && (
        <p role="status" className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
          {status}
        </p>
      )}
      {error && (
        <p role="alert" className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {error}
        </p>
      )}

      {/* ------------------------------------------------ permanent record */}
      <div className="mt-10">
        <h2 className="display-30" style={{ fontSize: 26, color: "var(--sabah-black)" }}>
          My alumni profile
        </h2>
        <p className="mt-2" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          This part is permanent. It stays true whatever you decide about any one weekend.
        </p>
      </div>

      <ProfileReviewCard
        review={profile.review}
        onConfirm={() => run(() => confirmProfile({}), "Thanks. Marked as confirmed by you.")}
        onCorrect={(note) =>
          run(
            () => correctProfile({ data: { note } }),
            "Sent to the organizers. It stays unconfirmed until they apply it.",
          )
        }
      />

      <Section title="Name and city">
        <ProfileForm
          person={person}
          onSave={(values) =>
            run(() => saveProfile({ data: { personId: person.id, ...values } }), "Record updated.")
          }
        />
      </Section>

      <Section title="Emails">
        <ul className="flex flex-col gap-2">
          {profile.emails.map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3"
              style={{ border: "1px solid var(--chalk)", borderRadius: 7, padding: "11px 13px" }}
            >
              <label className="flex items-center gap-3" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                <input
                  type="radio"
                  name="primary-email"
                  checked={row.is_primary}
                  onChange={() =>
                    run(
                      () => makePrimary({ data: { personId: person.id, id: row.id } }),
                      "Primary address updated.",
                    )
                  }
                />
                {row.email}
              </label>
              <span className="flex items-center gap-3">
                {row.is_primary && (
                  <span className="label-caps" style={{ color: "var(--sterling)" }}>
                    Primary
                  </span>
                )}
                <span
                  className="label-caps"
                  style={{ color: row.verified ? "var(--pitt-royal)" : "var(--sterling)" }}
                  title={
                    row.verified
                      ? "A sign in link sent here was opened."
                      : "This address is on the record. Nobody has proved they can read it."
                  }
                >
                  {emailStateLabel({ onFile: true, verified: row.verified })}
                </span>
                {!row.is_primary && (
                  <button
                    type="button"
                    className="label-caps"
                    style={{ color: "var(--pitt-royal)" }}
                    onClick={() => run(() => dropEmail({ data: { id: row.id } }), "Address removed.")}
                  >
                    Remove
                  </button>
                )}
              </span>
            </li>
          ))}
        </ul>
        <AddEmailForm
          onAdd={(value) =>
            run(() => addEmail({ data: { personId: person.id, email: value } }), "Address added.")
          }
        />
        <Notice>Your address is never shown on the board.</Notice>
      </Section>

      <Section title="Program and years you played">
        <ul className="flex flex-col gap-2">
          {profile.stints.map((s) => {
            const locked = s.year === CURRENT_YEAR;
            return (
              <li
                key={s.id}
                className="flex items-center justify-between gap-3"
                style={{ border: "1px solid var(--chalk)", borderRadius: 7, padding: "11px 13px" }}
              >
                <span style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                  {divisionLabel(s.division)}{" "}
                  <span style={{ fontFamily: '"Space Mono", monospace' }}>
                    {s.year ?? "year unknown"}
                  </span>
                  {s.role === "coach" || s.role === "assistant_coach" ? (
                    <span className="label-caps" style={{ marginLeft: 8, color: "var(--sterling)" }}>
                      {s.role === "coach" ? "Coach" : "Assistant coach"}
                    </span>
                  ) : null}
                </span>
                {locked ? (
                  <span className="label-caps" style={{ color: "var(--sterling)" }}>
                    Current season
                  </span>
                ) : (
                  <button
                    type="button"
                    className="label-caps"
                    style={{ color: "var(--pitt-royal)" }}
                    onClick={() => run(() => dropStint({ data: { id: s.id } }), "Season removed.")}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
          {profile.stints.length === 0 && (
            <li style={{ fontSize: 15, color: "var(--sterling)" }}>
              No seasons on file yet. Add the years you played and the board places you by your last
              one.
            </li>
          )}
        </ul>
        <AddStintForm
          divisions={divisions}
          onAdd={(division, year) =>
            run(
              () => putStint({ data: { personId: person.id, division, role: "player", year } }),
              "Season added.",
            )
          }
        />
        <Notice>The current season is set by the captains, so it can't be edited here.</Notice>
      </Section>

      <Section title="Who can see what">
        <VisibilityToggles
          person={person}
          onChange={(values) =>
            run(
              () =>
                saveProfile({
                  data: {
                    personId: person.id,
                    first_name: person.first_name,
                    last_name: person.last_name,
                    played_as: person.played_as,
                    current_city: person.current_city,
                    ...values,
                  },
                }),
              "Visibility updated.",
            )
          }
        />
      </Section>

      {/* ---------------------------------------------------- annual card */}
      <div id="annual" className="mt-14" style={{ scrollMarginTop: 90 }}>
        <h2
          ref={rsvpHeadingRef}
          tabIndex={-1}
          className="display-30 outline-none"
          style={{ fontSize: 26, color: "var(--sabah-black)" }}
        >
          {annualTitle}
        </h2>
        {justConfirmed && needsAnswer && (
          <p className="mt-2" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            You&apos;re confirmed. One quick question: are you coming?
          </p>
        )}
        <p className="mt-2" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          One card for one weekend. A new one appears when the organizers roll the edition forward,
          and this one becomes history.
        </p>
      </div>

      <AnnualCard
        title={annualTitle}
        edition={profile.edition}
        answer={profile.rsvp}
        editable={profile.rsvpEditable}
        editableUntil={profile.rsvpEditableUntil}
        events={profile.events}
        onAnswer={(s) => {
          setJustConfirmed(false);
          return run(
            () =>
              putRsvp({
                data: {
                  personId: person.id,
                  status: s,
                },
              }),
            "Answer saved.",
          );
        }}
        onEventAnswer={async (eventId, state, size) => {
          const result = await putEventAnswer({
            data: { eventId, state, partySize: size },
          });
          await refresh();
          return { promotedToGoing: Boolean(result.promotedToGoing) };
        }}
      />

      {profile.history.length > 0 && (
        <Section title="Earlier years">
          <ul className="flex flex-col">
            {profile.history.map((row) => (
              <li
                key={row.event_year}
                className="flex flex-wrap items-baseline justify-between gap-3 py-2"
                style={{ borderBottom: "1px solid var(--concrete)" }}
              >
                <span style={{ fontFamily: '"Space Mono", monospace', color: "var(--steel-ink)" }}>
                  {row.event_year}
                </span>
                <span className="label-caps" style={{ color: "var(--sterling)" }}>
                  {STATUS_LABELS[row.status]}
                  {row.status === "going" && row.party_size > 1 ? ` · ${row.party_size} heads` : ""}
                </span>
              </li>
            ))}
          </ul>
          <Notice>Past answers are part of the record and are not editable.</Notice>
        </Section>
      )}

      {pending.length > 0 && (
        <Section title="Do you know them?">
          <Notice>
            These names were suggested by someone who played around your years. One vouch puts them on the
            board.
          </Notice>
          <ul className="mt-4 flex flex-col gap-2">
            {pending.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3"
                style={{ border: "1px solid var(--chalk)", borderRadius: 7, padding: "11px 13px" }}
              >
                <span style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                  {personDisplayName(p)}
                  <span className="label-caps ml-3" style={{ color: "var(--sterling)" }}>
                    {[p.team_label, p.grad_year].filter(Boolean).join(" · ")}
                  </span>
                </span>
                <button
                  type="button"
                  style={secondaryButton}
                  onClick={() =>
                    run(
                      () => vouch({ data: { suggestionId: p.id, personId: person.id } }),
                      "Thanks — they're on the board.",
                    )
                  }
                >
                  I played with them
                </button>
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title="Suggest a name we're missing">
        <SuggestForm
          divisions={divisions}
          onSubmit={(values) =>
            run(
              () => suggest({ data: { submittedBy: person.id, ...values } }),
              "Sent. Someone from those years will confirm it.",
            )
          }
        />
      </Section>

      <Section title="Let us know quietly">
        <MemorialForm
          onSubmit={(note) =>
            run(
              () => memorial({ data: { submittedBy: person.id, personId: person.id, note } }),
              "Thank you. We've paused emails and an organizer will follow up privately.",
            )
          }
        />
      </Section>

      <Section title="">
        <button
          type="button"
          style={secondaryButton}
          onClick={async () => {
            // Global scope revokes the refresh token server side, so the
            // ninety day sliding session cannot be resumed from this device.
            await supabase.auth.signOut({ scope: "global" });
            navigate({ to: "/" });
          }}
        >
          Sign out
        </button>
      </Section>
    </main>
    </Chrome>
  );
}

function formatDeadline(iso: string | null) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

function eventWhen(row: MyEventAnswer) {
  if (row.time_tbd || !row.starts_at) return "Time to come";
  const d = new Date(row.starts_at);
  if (Number.isNaN(d.getTime())) return "Time to come";
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** One weekend, one card. The overall answer sits at the top of it, the events
 *  underneath. An event nobody answered says so plainly: Phase 5 replaces the
 *  read only chip with the three position control, and neither one may turn
 *  silence into a no. */
function AnnualCard({
  title,
  edition,
  answer,
  editable,
  editableUntil,
  events,
  onAnswer,
  onEventAnswer,
}: {
  title: string;
  edition: MyProfile["edition"];
  answer: RsvpStatus | null;
  editable: boolean;
  editableUntil: string | null;
  events: MyEventAnswer[];
  onAnswer: (status: RsvpStatus) => void;
  onEventAnswer: (
    eventId: string,
    state: TriState,
    partySize: number,
  ) => Promise<{ promotedToGoing: boolean }>;
}) {
  const closed = formatDeadline(editableUntil);

  return (
    <NotchedBox
      corners={["tl"]}
      notch={28}
      stroke="var(--chalk)"
      fill="var(--pure-white)"
      className="mt-6"
      style={{ padding: 4 }}
    >
      <div className="px-5 pb-6 pt-2 md:px-7">
        <h3 className="label-caps" style={{ color: "var(--sterling)" }}>
          {edition?.title ?? title}
        </h3>

        {/* The answer is stated in words, not carried by the filled button
            alone. Never gold: gold means attending on a board chip. Heads are
            asked per event now, so the overall answer carries no number. */}
        <p
          className="mt-3"
          style={{ fontFamily: '"Space Mono", monospace', fontSize: 15, color: "var(--steel-ink)" }}
        >
          {answer
            ? `Your answer: ${STATUS_LABELS[answer].toUpperCase()}`
            : "NO RESPONSE YET"}
        </p>

        {editable ? (
          <>
            <div className="mt-4 grid gap-2 md:grid-cols-3">
              {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={answer === s}
                  style={{ ...(answer === s ? primaryButton : secondaryButton), width: "100%" }}
                  onClick={() => onAnswer(s)}
                >
                  {STATUS_LABELS[s]}
                </button>
              ))}
            </div>
            {answer === "going" && (
              <p className="mt-3" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
                Bringing people? Say how many on each event below, so the organizers count the
                right number for the right meal.
              </p>
            )}
          </>

        ) : (
          <p className="mt-4" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            {closed
              ? `That weekend ended on ${closed}, so this card is now read only.`
              : "That weekend has ended, so this card is now read only."}{" "}
            Nothing is lost: your answer stays part of your record, and the next edition gets its own
            card.
          </p>
        )}

        {events.length > 0 && (
          <div className="mt-6" style={{ borderTop: "1px solid var(--concrete)" }}>
            <p className="label-caps mt-4" style={{ color: "var(--sterling)" }}>
              Events that ask
            </p>
            <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
              Each answer saves on its own. Leaving one in the middle means you have not chosen
              yet, and that is not the same as a no.
              {answer !== "going" && editable
                ? " Saying yes to any of these also marks you as going for the weekend, and the card above will say so."
                : ""}
            </p>
            <ul className="mt-3 flex flex-col">
              {events.map((row) => (
                <li
                  key={row.id}
                  className="py-4"
                  style={{ borderBottom: "1px solid var(--concrete)" }}
                >
                  <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                    {row.title}
                    {row.is_placeholder ? (
                      <span className="label-caps ml-3" style={{ color: "var(--sterling)" }}>
                        Being planned
                      </span>
                    ) : null}
                  </p>
                  <p className="label-caps mt-0.5" style={{ color: "var(--sterling)" }}>
                    {[eventWhen(row), row.location].filter(Boolean).join(" · ")}
                  </p>
                  <div className="mt-3">
                    {editable ? (
                      <EventAnswerRow row={row} onSave={onEventAnswer} />
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

      </div>
    </NotchedBox>
  );
}


/** One event row inside the annual card. Saves on change and says so in place:
 *  the toast is a courtesy, not the feedback. Party size is kept only while the
 *  answer is yes, so a change away from yes can never leave planned heads
 *  behind in the organizers' counts. */
function EventAnswerRow({
  row,
  onSave,
}: {
  row: MyEventAnswer;
  onSave: (
    eventId: string,
    state: TriState,
    partySize: number,
  ) => Promise<{ promotedToGoing: boolean }>;
}) {
  const initial: TriState = row.answer ?? "unanswered";
  const [state, setState] = useState<TriState>(initial);
  const [party, setParty] = useState(row.party_size);
  const [phase, setPhase] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [promoted, setPromoted] = useState(false);

  useEffect(() => {
    setState(row.answer ?? "unanswered");
    setParty(row.party_size);
  }, [row.answer, row.party_size]);

  const commit = async (next: TriState, heads: number) => {
    setState(next);
    setParty(next === "yes" ? heads : 1);
    setPhase("saving");
    try {
      const result = await onSave(row.id, next, next === "yes" ? heads : 1);
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
        onStateChange={(next) => void commit(next, party)}
        partySize={party}
        onPartySizeChange={(next) => void commit("yes", next)}
        describedBy={`event-status-${row.id}`}
      />
      <p
        id={`event-status-${row.id}`}
        role="status"
        className="mt-2"
        style={{
          fontSize: 13,
          color: phase === "error" ? "var(--pitt-royal)" : "var(--sterling)",
          minHeight: 18,
        }}
      >
        {phase === "saving"
          ? "Saving…"
          : phase === "error"
            ? "That didn't save. Try that answer again."
            : phase === "saved"
              ? promoted
                ? "Saved. Saying yes here also set your weekend answer to going."
                : "Saved."
              : ""}
      </p>
    </div>
  );
}

function ProfileForm({
  person,
  onSave,
}: {
  person: NonNullable<MyProfile["person"]>;
  onSave: (values: {
    first_name: string;
    last_name: string | null;
    played_as: string | null;
    current_city: string | null;
    show_on_board: boolean;
    share_email: boolean;
    open_to_network: boolean;
  }) => void;
}) {
  const [first, setFirst] = useState(person.first_name);
  const [last, setLast] = useState(person.last_name ?? "");
  const [playedAs, setPlayedAs] = useState(person.played_as ?? "");
  const [city, setCity] = useState(person.current_city ?? "");

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        onSave({
          first_name: first,
          last_name: last || null,
          played_as: playedAs || null,
          current_city: city || null,
          show_on_board: person.show_on_board,
          share_email: person.share_email,
          open_to_network: person.open_to_network,
        });
      }}
    >
      <div>
        <FieldLabel htmlFor="me-first">First name</FieldLabel>
        <input id="me-first" style={fieldStyle} value={first} onChange={(e) => setFirst(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="me-last">Last name</FieldLabel>
        <input id="me-last" style={fieldStyle} value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="me-nick">Played as</FieldLabel>
        <input
          id="me-nick"
          style={fieldStyle}
          value={playedAs}
          onChange={(e) => setPlayedAs(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel htmlFor="me-city">City now</FieldLabel>
        <input id="me-city" style={fieldStyle} value={city} onChange={(e) => setCity(e.target.value)} />
      </div>
      <div className="md:col-span-2">
        <button type="submit" style={primaryButton}>
          Save
        </button>
      </div>
    </form>
  );
}

function AddEmailForm({ onAdd }: { onAdd: (email: string) => void }) {
  const [value, setValue] = useState("");
  return (
    <form
      className="mt-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!isStructurallyValidEmail(value)) return;
        onAdd(value);
        setValue("");
      }}
    >
      <div className="flex flex-wrap gap-2">
        <input
          aria-label="Add another email"
          type="email"
          placeholder="another@address.com"
          style={{ ...fieldStyle, flex: "1 1 220px", width: "auto" }}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button type="submit" style={secondaryButton}>
          Add email
        </button>
      </div>
      <EmailSuggestion value={value} onAccept={setValue} />
    </form>
  );
}

function AddStintForm({
  divisions,
  onAdd,
}: {
  divisions: { code: string; label: string }[];
  onAdd: (division: string, year: number) => void;
}) {
  const [division, setDivision] = useState(divisions[0]?.code ?? DIVISIONS[0].code);
  const [year, setYear] = useState("");

  return (
    <form
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        const parsed = Number(year);
        if (!parsed) return;
        onAdd(division, parsed);
        setYear("");
      }}
    >
      <select
        aria-label="Program"
        style={{ ...fieldStyle, flex: "1 1 220px", width: "auto" }}
        value={division}
        onChange={(e) => setDivision(e.target.value)}
      >
        {divisions.map((d) => (
          <option key={d.code} value={d.code}>
            {d.label}
          </option>
        ))}
      </select>
      <input
        aria-label="Year"
        inputMode="numeric"
        placeholder="2014"
        style={{ ...fieldStyle, flex: "0 1 120px", width: "auto" }}
        value={year}
        onChange={(e) => setYear(e.target.value)}
      />
      <button type="submit" style={secondaryButton}>
        Add season
      </button>
    </form>
  );
}

function VisibilityToggles({
  person,
  onChange,
}: {
  person: NonNullable<MyProfile["person"]>;
  onChange: (values: { show_on_board: boolean; share_email: boolean; open_to_network: boolean }) => void;
}) {
  const rows = [
    { key: "show_on_board" as const, label: "Show my name on the public board" },
    { key: "share_email" as const, label: "Let an organizer pass my email on if a teammate asks" },
    { key: "open_to_network" as const, label: "I'm open to hearing from alumni about work" },
  ];
  return (
    <ul className="flex flex-col gap-3">
      {rows.map((row) => (
        <li key={row.key}>
          <label className="flex items-center gap-3" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
            <input
              type="checkbox"
              checked={person[row.key]}
              onChange={(e) =>
                onChange({
                  show_on_board: person.show_on_board,
                  share_email: person.share_email,
                  open_to_network: person.open_to_network,
                  [row.key]: e.target.checked,
                })
              }
            />
            {row.label}
          </label>
        </li>
      ))}
    </ul>
  );
}

function SuggestForm({
  divisions,
  onSubmit,
}: {
  divisions: { code: string; label: string }[];
  onSubmit: (values: {
    first_name: string;
    last_name: string | null;
    played_as: string | null;
    grad_year: number | null;
    division: string | null;
    note: string | null;
  }) => void;
}) {
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [gradYear, setGradYear] = useState("");
  const [division, setDivision] = useState(divisions[0]?.code ?? DIVISIONS[0].code);

  return (
    <form
      className="grid gap-4 md:grid-cols-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!first.trim()) return;
        onSubmit({
          first_name: first,
          last_name: last || null,
          played_as: null,
          grad_year: Number(gradYear) || null,
          division,
          note: null,
        });
        setFirst("");
        setLast("");
        setGradYear("");
      }}
    >
      <div>
        <FieldLabel htmlFor="sg-first">First name</FieldLabel>
        <input id="sg-first" style={fieldStyle} value={first} onChange={(e) => setFirst(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="sg-last">Last name</FieldLabel>
        <input id="sg-last" style={fieldStyle} value={last} onChange={(e) => setLast(e.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor="sg-year">Class year</FieldLabel>
        <input
          id="sg-year"
          inputMode="numeric"
          style={fieldStyle}
          value={gradYear}
          onChange={(e) => setGradYear(e.target.value)}
        />
      </div>
      <div>
        <FieldLabel htmlFor="sg-div">Program</FieldLabel>
        <select id="sg-div" style={fieldStyle} value={division} onChange={(e) => setDivision(e.target.value)}>
          {divisions.map((d) => (
            <option key={d.code} value={d.code}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      <div className="md:col-span-2">
        <button type="submit" style={secondaryButton}>
          Send suggestion
        </button>
      </div>
    </form>
  );
}

function MemorialForm({ onSubmit }: { onSubmit: (note: string) => void }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (!open) {
    return (
      <button type="button" style={secondaryButton} onClick={() => setOpen(true)}>
        Report a passing
      </button>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!note.trim()) return;
        onSubmit(note);
        setNote("");
        setOpen(false);
      }}
    >
      <Notice>
        This goes privately to an organizer, never to the board. We'll stop all emails to that person right
        away.
      </Notice>
      <textarea
        aria-label="What you'd like us to know"
        rows={4}
        style={{ ...fieldStyle, marginTop: 12 }}
        value={note}
        onChange={(e) => setNote(e.target.value)}
      />
      <div className="mt-4 flex gap-2">
        <button type="button" style={secondaryButton} onClick={() => setOpen(false)}>
          Cancel
        </button>
        <button type="submit" style={primaryButton}>
          Send privately
        </button>
      </div>
    </form>
  );
}