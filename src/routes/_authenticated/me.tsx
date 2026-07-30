import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  addMyEmail,
  getMyProfile,
  getPendingVerifications,
  removeMyEmail,
  removeStint,
  reportMemorial,
  saveStint,
  setMyRsvp,
  setPrimaryEmail,
  suggestNewPerson,
  updateMyProfile,
  vouchForPerson,
  type MyProfile,
} from "@/lib/account.functions";
import { STATUS_LABELS, personDisplayName, type RsvpStatus } from "@/lib/rsvp-types";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { FieldLabel, Notice, fieldStyle, primaryButton, secondaryButton } from "@/components/claim/ui";

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
      <main className="mx-auto max-w-[720px] px-5 py-16">
        <p style={{ color: "var(--sterling)" }}>{error ?? "Loading your record…"}</p>
      </main>
    );
  }

  const person = profile.person;

  if (!person) {
    return (
      <main className="mx-auto max-w-[720px] px-5 py-16">
        <h1 className="display-30" style={{ color: "var(--sabah-black)" }}>
          WE CAN'T FIND YOUR RECORD
        </h1>
        <Notice>
          This address isn't attached to anyone on the board yet. Head back and claim your name — it takes a
          few seconds.
        </Notice>
        <div className="mt-6">
          <button type="button" style={primaryButton} onClick={() => navigate({ to: "/" })}>
            Go to the board
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[720px] px-5 py-12">
      <SlashEyebrow>Your record</SlashEyebrow>
      <h1 className="display-30 mt-3" style={{ color: "var(--sabah-black)" }}>
        {personDisplayName(person).toUpperCase()}
      </h1>
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

      {profile.rsvp === null && (
        <div
          className="mt-6 p-5"
          style={{ border: "1px solid var(--chalk)", borderRadius: 7, background: "var(--field-white)" }}
        >
          <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>Are you coming in October?</p>
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => (
              <button
                key={s}
                type="button"
                style={{ ...secondaryButton, width: "100%" }}
                onClick={() =>
                  run(() => putRsvp({ data: { personId: person.id, status: s } }), "Answer saved.")
                }
              >
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
        </div>
      )}

      <Section title={profile.edition?.title ?? "Alumni Weekend"}>
        <div className="grid gap-2 md:grid-cols-3">
          {(["going", "maybe", "not_this_year"] as RsvpStatus[]).map((s) => (
            <button
              key={s}
              type="button"
              style={{ ...(profile.rsvp === s ? primaryButton : secondaryButton), width: "100%" }}
              onClick={() => run(() => putRsvp({ data: { personId: person.id, status: s } }), "Answer saved.")}
            >
              {STATUS_LABELS[s]}
            </button>
          ))}
        </div>
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
                  <span style={{ fontFamily: '"Space Mono", monospace' }}>{s.year}</span>
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
            await supabase.auth.signOut();
            navigate({ to: "/" });
          }}
        >
          Sign out
        </button>
      </Section>
    </main>
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
      className="mt-3 flex flex-wrap gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!value.trim()) return;
        onAdd(value);
        setValue("");
      }}
    >
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