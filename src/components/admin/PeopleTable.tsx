import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Fragment, useState } from "react";
import { toast } from "sonner";

import { adminUpdatePerson, getAdminPeople } from "@/lib/admin.functions";
import type { AdminPerson, PeopleFilter } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

const FILTERS: { value: PeopleFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "needs_review", label: "Needs review" },
  { value: "no_grad_year", label: "No grad year" },
  { value: "no_stints", label: "No stints" },
  { value: "is_anchor", label: "Anchors" },
  { value: "deceased", label: "Memorial" },
];

const DIVISIONS = ["MENS_A", "MENS_B", "WOMENS_A", "WOMENS_B"];

function Flag({ on, children }: { on: boolean; children: string }) {
  return (
    <span className="label-caps" style={{ color: on ? "var(--steel-ink)" : "var(--chalk)" }}>
      {children}
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
      <td colSpan={13} style={{ ...cellStyle, background: "var(--field-white)" }}>
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
      </td>
    </tr>
  );
}

export function PeopleTable() {
  const queryClient = useQueryClient();
  const fetchPeople = useServerFn(getAdminPeople);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<PeopleFilter>("all");
  const [division, setDivision] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const { data = [], isFetching } = useQuery({
    queryKey: ["admin-people", query, filter, division],
    queryFn: () => fetchPeople({ data: { query, filter, division } }),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["admin-people"] });

  return (
    <Section
      eyebrow="People records"
      title="Every record"
      aside={
        <p style={{ fontSize: 12, color: "var(--sterling)" }}>
          Showing <Num>{data.length}</Num>
          {isFetching ? " · loading" : ""}
        </p>
      }
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name or played-as"
          style={{ ...inputStyle, width: 260 }}
        />
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            onClick={() => setFilter(f.value)}
            style={{
              ...secondaryButton,
              padding: "7px 11px",
              fontSize: 11,
              background: filter === f.value ? "var(--concrete)" : "transparent",
            }}
          >
            {f.label}
          </button>
        ))}
        <select
          value={division ?? ""}
          onChange={(e) => setDivision(e.target.value || null)}
          style={{ ...inputStyle, width: 150 }}
        >
          <option value="">All divisions</option>
          {DIVISIONS.map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </div>

      {data.length === 0 ? (
        <Empty>No records match.</Empty>
      ) : (
        <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 1000 }}>
            <thead>
              <tr>
                {[
                  "Name",
                  "Played as",
                  "Grad",
                  "Board yr",
                  "Division",
                  "Team",
                  "Stints",
                  "State",
                  "Anchor",
                  "Review",
                  "Visible",
                  "Memorial",
                  "Member no",
                ].map((h) => (
                  <th key={h} style={headStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((person) => (
                <Fragment key={person.id}>
                  <tr>
                    <td style={cellStyle}>
                      <button
                        type="button"
                        onClick={() => setOpenId(openId === person.id ? null : person.id)}
                        style={{ textAlign: "left", color: "var(--pitt-royal)", fontWeight: 600 }}
                      >
                        {[person.first_name, person.last_name].filter(Boolean).join(" ")}
                      </button>
                    </td>
                    <td style={{ ...cellStyle, color: "var(--sterling)" }}>{person.played_as ?? "—"}</td>
                    <td style={cellStyle}><Num>{person.grad_year ?? "—"}</Num></td>
                    <td style={cellStyle}><Num>{person.board_year ?? "—"}</Num></td>
                    <td style={cellStyle}>{person.board_division ?? "—"}</td>
                    <td style={cellStyle}>{person.team_label ?? "—"}</td>
                    <td style={cellStyle}><Num>{person.stint_count}</Num></td>
                    <td style={cellStyle}>
                      <span className="label-caps">{person.state.replace(/_/g, " ")}</span>
                    </td>
                    <td style={cellStyle}><Flag on={person.is_anchor}>anchor</Flag></td>
                    <td style={cellStyle}><Flag on={person.needs_review}>review</Flag></td>
                    <td style={cellStyle}><Flag on={person.show_on_board}>visible</Flag></td>
                    <td style={cellStyle}><Flag on={person.deceased}>memorial</Flag></td>
                    <td style={cellStyle}><Num>{person.member_no}</Num></td>
                  </tr>
                  {openId === person.id ? (
                    <EditRow key={`edit-${person.id}`} person={person} onSaved={refresh} />
                  ) : null}
                </Fragment>
              ))}
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
