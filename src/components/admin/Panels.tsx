import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { adminExportCsv, adminUpdateTeamName } from "@/lib/admin.functions";
import type { DataGaps, DigestCohort, DripData, TeamNameRow } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

export function ConfidencePanel({ rows, onSaved }: { rows: TeamNameRow[]; onSaved: () => void }) {
  const update = useServerFn(adminUpdateTeamName);
  const [draft, setDraft] = useState<Record<string, Partial<TeamNameRow>>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const valueOf = (row: TeamNameRow, key: keyof TeamNameRow) =>
    (draft[row.id]?.[key] ?? row[key] ?? "") as string | number;

  const save = async (row: TeamNameRow) => {
    setBusy(row.id);
    try {
      await update({
        data: {
          id: row.id,
          name: String(valueOf(row, "name") || "") || null,
          start_year: Number(valueOf(row, "start_year")) || null,
          end_year: Number(valueOf(row, "end_year")) || null,
          confidence: String(valueOf(row, "confidence") || "assumed"),
        },
      });
      toast.success("Span updated.");
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 720 }}>
        <thead>
          <tr>
            {["Division", "Name", "Start", "End", "Confidence", ""].map((h) => (
              <th key={h} style={headStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const editable = row.confidence !== "verified";
            return (
              <tr key={row.id}>
                <td style={cellStyle}>{row.division}</td>
                <td style={cellStyle}>
                  {editable ? (
                    <input
                      value={String(valueOf(row, "name"))}
                      onChange={(e) =>
                        setDraft((d) => ({ ...d, [row.id]: { ...d[row.id], name: e.target.value } }))
                      }
                      style={{ ...inputStyle, width: 160 }}
                    />
                  ) : (
                    row.name ?? "—"
                  )}
                </td>
                {(["start_year", "end_year"] as const).map((key) => (
                  <td key={key} style={cellStyle}>
                    {editable ? (
                      <input
                        value={String(valueOf(row, key))}
                        onChange={(e) =>
                          setDraft((d) => ({ ...d, [row.id]: { ...d[row.id], [key]: e.target.value } }))
                        }
                        style={{
                          ...inputStyle,
                          width: 80,
                          fontFamily: '"Space Mono", ui-monospace, monospace',
                        }}
                      />
                    ) : (
                      <Num>{row[key] ?? "—"}</Num>
                    )}
                  </td>
                ))}
                <td style={cellStyle}>
                  {editable ? (
                    <select
                      value={String(valueOf(row, "confidence"))}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          [row.id]: { ...d[row.id], confidence: e.target.value },
                        }))
                      }
                      style={{ ...inputStyle, width: 120 }}
                    >
                      <option value="assumed">assumed</option>
                      <option value="unknown">unknown</option>
                      <option value="verified">verified</option>
                    </select>
                  ) : (
                    <span className="label-caps">{row.confidence}</span>
                  )}
                </td>
                <td style={cellStyle}>
                  {editable ? (
                    <button
                      type="button"
                      style={{ ...secondaryButton, padding: "6px 10px", fontSize: 11 }}
                      disabled={busy === row.id}
                      onClick={() => save(row)}
                    >
                      Save
                    </button>
                  ) : null}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function GapsPanel({ gaps }: { gaps: DataGaps }) {
  return (
    <div className="mt-8 grid gap-6 sm:grid-cols-2">
      <div>
        <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
          Holes in the record
        </h3>
        <p style={{ fontSize: 14, color: "var(--steel-ink)" }}>
          <Num>{gaps.no_stints}</Num> people with no stints
          <br />
          <Num>{gaps.no_grad_year}</Num> people with no grad year
          <br />
          <Num>{gaps.thin_years.length}</Num> years with fewer than <Num>6</Num> people
        </p>
        {gaps.thin_years.length > 0 ? (
          <p className="mt-2" style={{ fontSize: 12, color: "var(--sterling)" }}>
            {gaps.thin_years.map((y) => `${y.year} (${y.count})`).join(" · ")}
          </p>
        ) : null}
      </div>
      <div>
        <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
          Men's A, recent years
        </h3>
        <p style={{ fontSize: 14, color: "var(--steel-ink)" }}>
          {gaps.mens_a_recent.map((y) => (
            <span key={y.year}>
              <Num>{y.year}</Num>: <Num>{y.count}</Num> players
              <br />
            </span>
          ))}
        </p>
        <p className="mt-2" style={{ fontSize: 12, color: "var(--sterling)" }}>
          Those are missing records, not real squad sizes. A visible hole recruits corrections.
        </p>
      </div>
    </div>
  );
}

export function DigestPanel({ cohorts }: { cohorts: DigestCohort[] }) {
  return (
    <Section eyebrow="Monday digest" title="Who to text">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Goes to the three organizers, not the list. Sending is not built yet; this is the live view.
      </p>
      {cohorts.length === 0 ? (
        <Empty>No admin has a year range yet.</Empty>
      ) : (
        <div className="grid gap-8">
          {cohorts.map((cohort) => (
            <div key={cohort.admin} style={{ borderTop: hairline, paddingTop: 12 }}>
              <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
                {cohort.admin} — your years <Num>{cohort.from}</Num>–<Num>{cohort.to}</Num>:{" "}
                <Num>{cohort.counts.going}</Num> going, <Num>{cohort.counts.claimed}</Num> claimed,{" "}
                <Num>{cohort.counts.maybe}</Num> maybe, <Num>{cohort.counts.never_opened}</Num> never
                opened.
              </p>
              {(
                [
                  ["Going", cohort.going],
                  ["Claimed", cohort.claimed],
                  ["Maybe", cohort.maybe],
                  ["Never opened", cohort.never_opened],
                ] as const
              ).map(([label, names]) => (
                <p key={label} className="mt-2" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
                  <span className="label-caps" style={{ color: "var(--sterling)" }}>
                    {label}
                  </span>{" "}
                  {names.length ? names.join(", ") : "—"}
                </p>
              ))}
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

export function DripPanel({ drip }: { drip: DripData }) {
  return (
    <Section eyebrow="Drip" title="Sequences, read only">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Sending is not built in this pass. There is no control on this page that can turn a sequence
        on.
      </p>
      <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {["Key", "Offset days", "Audience states", "Anchors only", "Active"].map((h) => (
                <th key={h} style={headStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {drip.sequences.map((seq) => (
              <tr key={seq.id}>
                <td style={cellStyle}>{seq.key}</td>
                <td style={cellStyle}><Num>{seq.offset_days}</Num></td>
                <td style={{ ...cellStyle, color: "var(--sterling)" }}>
                  {(seq.audience_states ?? []).join(", ")}
                </td>
                <td style={cellStyle}>
                  <span className="label-caps">{seq.anchors_only ? "yes" : "no"}</span>
                </td>
                <td style={cellStyle}>
                  <span className="label-caps">{seq.active ? "on" : "off"}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Bounces
          </h3>
          <p style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            <Num>{drip.bounces.hard}</Num> hard · <Num>{drip.bounces.soft}</Num> soft ·{" "}
            <Num>{drip.bounces.complaints}</Num> complaints
          </p>
        </div>
        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Suppressions · <Num>{drip.suppressions.length}</Num>
          </h3>
          {drip.suppressions.length === 0 ? (
            <Empty>Nothing suppressed.</Empty>
          ) : (
            <ul style={{ fontSize: 13, color: "var(--steel-ink)" }}>
              {drip.suppressions.map((row) => (
                <li key={row.email}>
                  {row.email} — <span style={{ color: "var(--sterling)" }}>{row.reason}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Section>
  );
}

export function ExportPanel() {
  const exportCsv = useServerFn(adminExportCsv);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await exportCsv({});
      if (!result) return;
      const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${result.rows} records. Logged.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section eyebrow="Export" title="CSV">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Board year, division, team label, state, anchor, needs review, and the primary email where
        one exists. This is the only place an email leaves the database, and every export is logged
        with your name.
      </p>
      <button type="button" style={primaryButton} disabled={busy} onClick={run}>
        Download CSV
      </button>
    </Section>
  );
}
