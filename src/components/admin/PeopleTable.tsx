import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useMemo, useState } from "react";
import { toast } from "sonner";

import {
  adminAddStint,
  adminDeleteStint,
  adminPersonStints,
  adminUpdatePerson,
  getAdminPeople,
} from "@/lib/admin.functions";
import type { AdminPerson } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

const DIVISIONS = ["MENS_A", "MENS_B", "WOMENS_A", "WOMENS_B"];
const ROLES = ["player", "captain", "coach", "assistant_coach", "manager"] as const;
const SIDELINE_ROLES = new Set(["coach", "assistant_coach", "manager"]);
const roleLabel = (role: string) => role.replace(/_/g, " ");

/** Roles live here, on the season, never on the person. A sideline role may
 *  carry no year at all: we do not invent one. */
function StintEditor({ personId }: { personId: string }) {
  const queryClient = useQueryClient();
  const list = useServerFn(adminPersonStints);
  const add = useServerFn(adminAddStint);
  const drop = useServerFn(adminDeleteStint);
  const [draft, setDraft] = useState({ division: "MENS_A", role: "player", year: "" });
  const [busy, setBusy] = useState(false);

  const { data: stints = [] } = useQuery({
    queryKey: ["admin-stints", personId],
    queryFn: () => list({ data: { personId } }),
  });
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["admin-stints", personId] });
    queryClient.invalidateQueries({ queryKey: ["admin-people"] });
  };

  const save = async () => {
    setBusy(true);
    try {
      await add({
        data: {
          personId,
          division: draft.division,
          role: draft.role,
          year: draft.year.trim() === "" ? null : Number(draft.year),
        },
      });
      setDraft((d) => ({ ...d, year: "" }));
      toast.success("Season added and logged.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't add that season.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await drop({ data: { id } });
      toast.success("Season removed and logged.");
      refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't remove that season.");
    }
  };

  return (
    <div className="mt-4" style={{ borderTop: hairline, paddingTop: 14 }}>
      <p className="label-caps" style={{ color: "var(--sterling)" }}>
        Seasons and roles
      </p>
      {stints.length === 0 ? (
        <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
          No seasons on record.
        </p>
      ) : (
        <ul className="mt-2 flex flex-wrap gap-2">
          {stints.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2"
              style={{ border: hairline, borderRadius: 6, padding: "5px 9px", fontSize: 13 }}
            >
              <span style={{ fontFamily: '"Space Mono", monospace' }}>{s.year ?? "year unknown"}</span>
              <span style={{ color: "var(--sterling)" }}>{s.division}</span>
              <span className="label-caps">{roleLabel(s.role)}</span>
              <button
                type="button"
                className="label-caps"
                style={{ color: "var(--pitt-royal)" }}
                onClick={() => remove(s.id)}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <select
          value={draft.division}
          onChange={(e) => setDraft((d) => ({ ...d, division: e.target.value }))}
          style={{ ...inputStyle, width: 150 }}
        >
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
        <select
          value={draft.role}
          onChange={(e) => setDraft((d) => ({ ...d, role: e.target.value }))}
          style={{ ...inputStyle, width: 160 }}
        >
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {roleLabel(r)}
            </option>
          ))}
        </select>
        <input
          value={draft.year}
          onChange={(e) => setDraft((d) => ({ ...d, year: e.target.value }))}
          placeholder={SIDELINE_ROLES.has(draft.role) ? "year (optional)" : "year"}
          inputMode="numeric"
          style={{ ...inputStyle, width: 130 }}
        />
        <button type="button" style={secondaryButton} disabled={busy} onClick={save}>
          Add season
        </button>
      </div>
      <p className="mt-1" style={{ fontSize: 12, color: "var(--sterling)" }}>
        A coach or assistant coach may be recorded with no year. A playing season must name one, and
        the current season stays closed.
      </p>
    </div>
  );
}

/** Only flags that are actually set get ink. Four half-empty columns became one. */
function FlagChips({ person }: { person: AdminPerson }) {
  const chips = [
    person.is_anchor ? "anchor" : null,
    person.needs_review ? "review" : null,
    person.show_on_board ? null : "hidden",
    person.deceased ? "memorial" : null,
  ].filter(Boolean) as string[];
  if (chips.length === 0)
    return <span style={{ color: "var(--chalk)" }}>—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {chips.map((c) => (
        <span
          key={c}
          className="label-caps"
          style={{
            fontSize: 10,
            border: hairline,
            borderRadius: 3,
            padding: "1px 5px",
            color: "var(--steel-ink)",
            whiteSpace: "nowrap",
          }}
        >
          {c}
        </span>
      ))}
    </span>
  );
}
function EditRow({ person, onSaved }: { person: AdminPerson; onSaved: () => void }) {
  const update = useServerFn(adminUpdatePerson);
  const [form, setForm] = useState({
    first_name: person.first_name,
    last_name: person.last_name ?? "",
    played_as: person.played_as ?? "",
    current_city: person.current_city ?? "",
    grad_year: person.grad_year?.toString() ?? "",
    seed_division: person.seed_division ?? "",
    deceased_note: person.deceased_note ?? "",
    show_on_board: person.show_on_board,
    needs_review: person.needs_review,
    is_anchor: person.is_anchor,
  });
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form, value: string | boolean) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    setBusy(true);
    try {
      await update({
        data: {
          personId: person.id,
          patch: {
            ...form,
            grad_year: form.grad_year === "" ? null : Number(form.grad_year),
            last_name: form.last_name || null,
            played_as: form.played_as || null,
            current_city: form.current_city || null,
            seed_division: form.seed_division || null,
          },
        },
      });
      toast.success("Saved and logged.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const field = (key: keyof typeof form, label: string) => (
    <div>
      <label className="label-caps block" style={{ color: "var(--sterling)" }}>
        {label}
      </label>
      <input
        value={String(form[key] ?? "")}
        onChange={(e) => set(key, e.target.value)}
        style={{ ...inputStyle, marginTop: 5 }}
      />
    </div>
  );

  return (
    <tr>
      <td colSpan={10} style={{ ...cellStyle, background: "var(--concrete)" }}>
        <div className="grid gap-3 sm:grid-cols-3">
          {field("first_name", "First name")}
          {field("last_name", "Last name")}
          {field("played_as", "Played as")}
          {field("current_city", "City")}
          {field("grad_year", "Grad year")}
          <div>
            <label className="label-caps block" style={{ color: "var(--sterling)" }}>
              Seed division
            </label>
            <select
              value={form.seed_division}
              onChange={(e) => set("seed_division", e.target.value)}
              style={{ ...inputStyle, marginTop: 5 }}
            >
              <option value="">—</option>
              {DIVISIONS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-5">
          {(
            [
              ["is_anchor", "Anchor"],
              ["needs_review", "Needs review"],
              ["show_on_board", "Visible on the board"],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={Boolean(form[key])}
                onChange={(e) => set(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>
        <p className="mt-1" style={{ fontSize: 12, color: "var(--sterling)" }}>
          Clearing “visible on the board” is an admin hide: it overrides whatever the member set,
          for when a family asks.
        </p>

        <div className="mt-3">
          <label className="label-caps block" style={{ color: "var(--sterling)" }}>
            Memorial note (admin only, never leaves this page)
          </label>
          <textarea
            value={form.deceased_note}
            onChange={(e) => set("deceased_note", e.target.value)}
            rows={2}
            style={{ ...inputStyle, marginTop: 5 }}
          />
        </div>

        <div className="mt-4">
          <button type="button" style={primaryButton} disabled={busy} onClick={save}>
            Save record
          </button>
        </div>

        <div className="mt-5">
          <p className="label-caps" style={{ color: "var(--sterling)" }}>
            Event answers
          </p>
          {person.event_answers.length === 0 ? (
            <p className="mt-1" style={{ fontSize: 13, color: "var(--sterling)" }}>
              {person.state === "going"
                ? "Going, but has not answered on the BBQ or the Alumni Game yet."
                : "Not asked. Event answers are only requested from people who are going."}
            </p>
          ) : (
            <ul className="mt-1 flex flex-wrap gap-4">
              {person.event_answers.map((a) => (
                <li key={a.event_id} style={{ fontSize: 13, color: "var(--steel-ink)" }}>
                  {a.label}:{" "}
                  <strong>{a.status === "yes" ? "Yes" : "No"}</strong>
                  {a.status === "yes" && a.party_size > 1 ? ` (${a.party_size} heads)` : ""}
                </li>
              ))}
            </ul>
          )}
        </div>

        <StintEditor personId={person.id} />

      </td>
    </tr>
  );
}


/** Admin only. @pitt.edu is flagged because it dies at graduation;
 *  @alumni.pitt.edu is permanent and is deliberately not flagged. */
function EmailCell({ emails }: { emails: AdminPerson["emails"] }) {
  const [expanded, setExpanded] = useState(false);
  if (emails.length === 0)
    return (
      <span className="label-caps" style={{ color: "var(--sterling)" }}>
        No address
      </span>
    );
  const ordered = [...emails].sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const shown = expanded ? ordered : ordered.slice(0, 1);
  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 240 }}>
      {shown.map((e) => {
        const expiring = /@pitt\.edu$/i.test(e.email);
        return (
          <span key={e.email} className="flex flex-wrap items-baseline gap-1.5">
            <span
              title={e.email}
              style={{
                fontFamily: '"Space Mono", ui-monospace, monospace',
                fontSize: 12,
                color: "var(--steel-ink)",
                userSelect: "all",
                cursor: "text",
                overflowWrap: "anywhere",
              }}
            >
              {e.email}
            </span>
            {e.is_primary ? (
              <span className="label-caps" style={{ fontSize: 10, color: "var(--pitt-royal)" }}>
                primary
              </span>
            ) : null}
            {e.verified ? null : (
              <span className="label-caps" style={{ fontSize: 10, color: "var(--steel-ink)" }}>
                unverified
              </span>
            )}
            {expiring ? (
              <span
                className="label-caps"
                title="A @pitt.edu address stops working after graduation. @alumni.pitt.edu is permanent."
                style={{
                  fontSize: 10,
                  border: "1px solid var(--steel-ink)",
                  borderRadius: 3,
                  padding: "0 4px",
                  color: "var(--steel-ink)",
                }}
              >
                expires
              </span>
            ) : null}
          </span>
        );
      })}
      {ordered.length > 1 ? (
        <button
          type="button"
          className="label-caps"
          onClick={() => setExpanded((v) => !v)}
          style={{ fontSize: 10, color: "var(--pitt-royal)", textAlign: "left" }}
        >
          {expanded ? "Show fewer" : `+${ordered.length - 1} more`}
        </button>
      ) : null}
    </div>
  );
}

type SortKey =
  | "name" | "played_as" | "grad_year" | "board_year" | "board_division" | "team_label"
  | "email" | "stint_count" | "state" | "is_anchor" | "needs_review" | "show_on_board" | "deceased" | "member_no";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "name", label: "Name" },
  { key: "email", label: "Email" },
  { key: "played_as", label: "Played as" },
  { key: "grad_year", label: "Grad" },
  { key: "board_year", label: "Board yr" },
  { key: "board_division", label: "Division" },
  { key: "team_label", label: "Team" },
  { key: "stint_count", label: "Stints" },
  { key: "state", label: "State" },
  { key: "needs_review", label: "Flags" },
  { key: "member_no", label: "Member no" },
];

type Tri = "any" | "yes" | "no";
const TRI_FIELDS = [
  { key: "is_anchor", label: "Anchor" },
  { key: "needs_review", label: "Review" },
  { key: "show_on_board", label: "Visible" },
  { key: "deceased", label: "Memorial" },
] as const;

const fullName = (p: AdminPerson) => [p.first_name, p.last_name].filter(Boolean).join(" ");

function sortValue(p: AdminPerson, key: SortKey): string | number {
  switch (key) {
    case "name": return fullName(p).toLowerCase();
    case "played_as": return (p.played_as ?? "").toLowerCase();
    case "email": return (p.emails[0]?.email ?? "").toLowerCase();
    case "grad_year": return p.grad_year ?? -1;
    case "board_year": return p.board_year ?? -1;
    case "board_division": return p.board_division ?? "";
    case "team_label": return p.team_label ?? "";
    case "stint_count": return p.stint_count;
    case "state": return p.state;
    case "member_no": return p.member_no;
    default: return p[key] ? 1 : 0;
  }
}

const headButton = (active: boolean): React.CSSProperties => ({
  ...headStyle,
  padding: 0,
  background: "none",
  color: active ? "var(--pitt-royal)" : "var(--sterling)",
  cursor: "pointer",
});

const EMPTY_FILTERS = {
  query: "",
  division: "",
  team: "",
  state: "",
  gradFrom: "",
  gradTo: "",
  boardFrom: "",
  boardTo: "",
  is_anchor: "any" as Tri,
  needs_review: "any" as Tri,
  show_on_board: "any" as Tri,
  deceased: "any" as Tri,
};

export function PeopleTable() {
  const queryClient = useQueryClient();
  const fetchPeople = useServerFn(getAdminPeople);
  const [f, setF] = useState(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({ key: "member_no", dir: "asc" });
  const [openId, setOpenId] = useState<string | null>(null);

  const { data = [], isFetching } = useQuery({
    queryKey: ["admin-people"],
    queryFn: () => fetchPeople({}),
  });

  const set = <K extends keyof typeof EMPTY_FILTERS>(key: K, value: (typeof EMPTY_FILTERS)[K]) =>
    setF((prev) => ({ ...prev, [key]: value }));

  const teams = useMemo(
    () => Array.from(new Set(data.map((p) => p.team_label).filter(Boolean) as string[])).sort(),
    [data],
  );
  const states = useMemo(
    () => Array.from(new Set(data.map((p) => p.state))).sort(),
    [data],
  );

  const rows = useMemo(() => {
    const q = f.query.trim().toLowerCase();
    const inRange = (value: number | null, from: string, to: string) => {
      if (from === "" && to === "") return true;
      if (value === null) return false;
      if (from !== "" && value < Number(from)) return false;
      if (to !== "" && value > Number(to)) return false;
      return true;
    };
    const tri = (flag: boolean, mode: Tri) => mode === "any" || (mode === "yes") === flag;

    const filtered = data.filter((p) => {
      if (q) {
        const hay = [
          p.first_name,
          p.last_name ?? "",
          p.played_as ?? "",
          String(p.member_no),
          ...p.emails.map((e) => e.email),
        ]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      if (f.division && (p.board_division ?? p.seed_division) !== f.division) return false;
      if (f.team && p.team_label !== f.team) return false;
      if (f.state && p.state !== f.state) return false;
      if (!inRange(p.grad_year, f.gradFrom, f.gradTo)) return false;
      if (!inRange(p.board_year, f.boardFrom, f.boardTo)) return false;
      for (const t of TRI_FIELDS) if (!tri(Boolean(p[t.key]), f[t.key])) return false;
      return true;
    });

    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const va = sortValue(a, sort.key);
      const vb = sortValue(b, sort.key);
      if (va === vb) return a.member_no - b.member_no;
      return va < vb ? -dir : dir;
    });
  }, [data, f, sort]);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-people"] });
  const toggleSort = (key: SortKey) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "asc" }));

  const triControl = (key: (typeof TRI_FIELDS)[number]["key"], label: string) => (
    <div key={key} className="flex items-center gap-1">
      <span className="label-caps" style={{ color: "var(--sterling)" }}>{label}</span>
      {(["any", "yes", "no"] as Tri[]).map((mode) => (
        <button
          key={mode}
          type="button"
          onClick={() => set(key, mode)}
          style={{
            ...secondaryButton,
            padding: "5px 8px",
            fontSize: 11,
            background: f[key] === mode ? "var(--concrete)" : "transparent",
          }}
        >
          {mode}
        </button>
      ))}
    </div>
  );

  return (
    <Section
      eyebrow="People records"
      title="Every record"
      aside={
        <p style={{ fontSize: 12, color: "var(--sterling)" }}>
          Showing <Num>{rows.length}</Num> of <Num>{data.length}</Num>
          {isFetching ? " · loading" : ""}
        </p>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <input
          value={f.query}
          onChange={(e) => set("query", e.target.value)}
          placeholder="Search name, email, played-as or member no"
          style={{ ...inputStyle, width: 280 }}
        />
        <select value={f.division} onChange={(e) => set("division", e.target.value)} style={{ ...inputStyle, width: 150 }}>
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
        </select>
        <select value={f.team} onChange={(e) => set("team", e.target.value)} style={{ ...inputStyle, width: 170 }}>
          <option value="">All teams</option>
          {teams.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={f.state} onChange={(e) => set("state", e.target.value)} style={{ ...inputStyle, width: 150 }}>
          <option value="">All states</option>
          {states.map((s) => <option key={s} value={s}>{s.replace(/_/g, " ")}</option>)}
        </select>
        <button type="button" onClick={() => setF(EMPTY_FILTERS)} style={{ ...secondaryButton, padding: "7px 11px", fontSize: 11 }}>
          Clear all
        </button>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-1">
          <span className="label-caps" style={{ color: "var(--sterling)" }}>Grad</span>
          <input value={f.gradFrom} onChange={(e) => set("gradFrom", e.target.value)} placeholder="from" inputMode="numeric" style={{ ...inputStyle, width: 74 }} />
          <input value={f.gradTo} onChange={(e) => set("gradTo", e.target.value)} placeholder="to" inputMode="numeric" style={{ ...inputStyle, width: 74 }} />
        </div>
        <div className="flex items-center gap-1">
          <span className="label-caps" style={{ color: "var(--sterling)" }}>Board yr</span>
          <input value={f.boardFrom} onChange={(e) => set("boardFrom", e.target.value)} placeholder="from" inputMode="numeric" style={{ ...inputStyle, width: 74 }} />
          <input value={f.boardTo} onChange={(e) => set("boardTo", e.target.value)} placeholder="to" inputMode="numeric" style={{ ...inputStyle, width: 74 }} />
        </div>
        {TRI_FIELDS.map((t) => triControl(t.key, t.label))}
      </div>

      {rows.length === 0 ? (
        <Empty>No records match.</Empty>
      ) : (
        <div
          className="overflow-auto"
          style={{ border: hairline, borderRadius: 6, maxHeight: "70vh", overscrollBehavior: "contain" }}
        >
          <table className="w-full" style={{ borderCollapse: "separate", borderSpacing: 0, minWidth: 1080 }}>
            <thead style={{ position: "sticky", top: 0, zIndex: 2, background: "var(--pure-white)" }}>
              <tr>
                {COLUMNS.map((c) => (
                  <th
                    key={c.key}
                    style={{
                      ...headStyle,
                      borderBottom: hairline,
                      background: "var(--pure-white)",
                      ...(c.key === "name"
                        ? { position: "sticky", left: 0, zIndex: 3, minWidth: 170 }
                        : null),
                    }}
                  >
                    <button type="button" onClick={() => toggleSort(c.key)} style={headButton(sort.key === c.key)}>
                      {c.label}
                      {sort.key === c.key ? (sort.dir === "asc" ? " ↑" : " ↓") : ""}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((person, i) => {
                const zebra = i % 2 === 1 ? "var(--field-white)" : "var(--pure-white)";
                const cell = { ...cellStyle, background: zebra };
                return (
                <Fragment key={person.id}>
                  <tr>
                    <td style={{ ...cell, position: "sticky", left: 0, zIndex: 1, borderRight: hairline }}>
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === person.id ? null : person.id)}
                        style={{ textAlign: "left", color: "var(--pitt-royal)", fontWeight: 600 }}
                      >
                        {fullName(person)}
                      </button>
                    </td>
                    <td style={cell}><EmailCell emails={person.emails} /></td>
                    <td style={{ ...cell, color: "var(--sterling)" }}>{person.played_as ?? "—"}</td>
                    <td style={cell}><Num>{person.grad_year ?? "—"}</Num></td>
                    <td style={cell}><Num>{person.board_year ?? "—"}</Num></td>
                    <td style={cell}>{person.board_division ?? "—"}</td>
                    <td style={cell}>{person.team_label ?? "—"}</td>
                    <td style={cell}><Num>{person.stint_count}</Num></td>
                    <td style={cell}>
                      <span className="label-caps">{person.state.replace(/_/g, " ")}</span>
                    </td>
                    <td style={cell}><FlagChips person={person} /></td>
                    <td style={cell}><Num>{person.member_no}</Num></td>
                  </tr>
                  {openId === person.id ? (
                    <EditRow key={`edit-${person.id}`} person={person} onSaved={refresh} />
                  ) : null}
                </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3" style={{ fontSize: 12, color: "var(--sterling)" }}>
        Member number is here for support lookups only. Nothing joins on it.
      </p>
    </Section>
  );
}
