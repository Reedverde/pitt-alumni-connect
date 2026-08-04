import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  addMyEmail,
  addMeAsPerson,
  amIPreapproved,
  claimPersonAsMe,
  getMyProfile,
  getPendingVerifications,
  removeMyEmail,
  removeStint,
  reportMemorial,
  saveStint,
  setMyRsvp,
  setMyPartySize,
  setPrimaryEmail,
  suggestNewPerson,
  updateMyProfile,
  vouchForPerson,
  type MyProfile,
} from "@/lib/account.functions";
import { PartySizeStepper } from "@/components/claim/PartySizeStepper";
import { searchPeople } from "@/lib/rsvp.functions";
import { personDisplayName as matchName, type PersonMatch } from "@/lib/rsvp-types";
import { STATUS_LABELS, personDisplayName, type RsvpStatus } from "@/lib/rsvp-types";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
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
  const addEmail = useServerFn(addMyEmail);
  const dropEmail = useServerFn(removeMyEmail);
  const makePrimary = useServerFn(setPrimaryEmail);
  const putStint = useServerFn(saveStint);
  const dropStint = useServerFn(removeStint);
  const putRsvp = useServerFn(setMyRsvp);
  const putPartySize = useServerFn(setMyPartySize);
  const loadPending = useServerFn(getPendingVerifications);
  const vouch = useServerFn(vouchForPerson);
  const suggest = useServerFn(suggestNewPerson);
  const memorial = useServerFn(reportMemorial);

  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [pending, setPending] = useState<Awaited<ReturnType<typeof getPendingVerifications>>>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    const next = await loadProfile();
    setProfile(next);
    if (next.person) setPending(await loadPending({ data: { personId: next.person.id } }));
  };

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
        <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16">
          <p style={{ color: "var(--sterling)" }}>{error ?? "Loading your record…"}</p>
        </main>
      </Chrome>
    );
  }

  const person = profile.person;

  if (!person) {
    return (
      <Chrome>
        <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-16">
          <NoRecordPanel onDone={() => void refresh()} />
        </main>
      </Chrome>
    );
  }

  return (
    <Chrome>
    <main className="mx-auto w-full max-w-[720px] flex-1 px-5 py-12">
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
      {status && (
        <p role="status" className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
          {status}
        </p>
      )}
      {error && (
        <p className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {error}
        </p>
      )}

      <Section title={profile.edition?.title ?? "Alumni Weekend"}>
        {/* The answer is stated in words, not carried by the filled button
            alone. Never gold: gold means attending on a board chip. */}
        {profile.rsvp === null ? (
          <p className="mb-3" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
            Are you coming in October?
          </p>
        ) : (
          <p
            className="label-caps mb-3"
            style={{ fontFamily: '"Space Mono", monospace', color: "var(--steel-ink)" }}
          >
            Your answer: {STATUS_LABELS[profile.rsvp as RsvpStatus].toUpperCase()}
          </p>
        )}
        <div className="grid gap-2 md:grid-cols-3">
          {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              aria-pressed={profile.rsvp === s}
              style={{ ...(profile.rsvp === s ? primaryButton : secondaryButton), width: "100%" }}
              onClick={() =>
                run(
                  () =>
                    putRsvp({
                      data: {
                        personId: person.id,
                        status: s,
                        partySize: s === "going" ? profile.rsvpPartySize : 1,
                      },
                    }),
                  "Answer saved.",
                )
              }
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
        {profile.rsvp === "going" && (
          <PartySizeStepper
            value={profile.rsvpPartySize}
            onChange={(next) =>
              run(() => putPartySize({ data: { partySize: next } }), "Party size updated.")
            }
          />
        )}
        {profile.attended.length > 0 && (
          <p className="mt-3" style={{ fontSize: 13, color: "var(--sterling)" }}>
            You came in {profile.attended.join(", ")}.
          </p>
        )}
      </Section>

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
                <span className="label-caps" style={{ color: "var(--sterling)" }}>
                  {row.verified ? "Verified" : "Unverified"}
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
      </Section>

      <Section title="Years you played">
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
                  {DIVISIONS.find((d) => d.code === s.division)?.label ?? s.division}{" "}
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
        </ul>
        <AddStintForm
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

function AddStintForm({ onAdd }: { onAdd: (division: string, year: number) => void }) {
  const [division, setDivision] = useState(DIVISIONS[0].code);
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
        {DIVISIONS.map((d) => (
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
  onSubmit,
}: {
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
  const [division, setDivision] = useState(DIVISIONS[0].code);

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
          {DIVISIONS.map((d) => (
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