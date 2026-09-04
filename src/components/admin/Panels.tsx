import { useServerFn } from "@tanstack/react-start";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { toast } from "sonner";


import { adminExportCsv, adminSetDivisionVisible, adminUpdateTeamName } from "@/lib/admin.functions";
import {
  FOUNDATION_DONATE_URL,
  PAYPAL_DONATE_URL,
  VENMO_DONATE_URL,
} from "@/lib/donate";

import type {
  DataGaps,
  DigestCohort,
  DivisionRow,
  DripData,
  EventHeadcountRow,
  Headcount,
  TeamNameRow,
} from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

export function DivisionsPanel({ rows, onSaved }: { rows: DivisionRow[]; onSaved: () => void }) {
  const setVisible = useServerFn(adminSetDivisionVisible);
  const [busy, setBusy] = useState<string | null>(null);

  const toggle = async (row: DivisionRow) => {
    setBusy(row.code);
    try {
      await setVisible({ data: { code: row.code, visible: !row.visible } });
      toast.success(`${row.code} is now ${row.visible ? "hidden from" : "visible on"} the board.`);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
      <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 520 }}>
        <thead>
          <tr>
            {["Division", "Label", "Public board", ""].map((h) => (
              <th key={h} style={headStyle}>
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code}>
              <td style={cellStyle}>{row.code}</td>
              <td style={cellStyle}>{row.label ?? "—"}</td>
              <td style={cellStyle}>
                <span style={{ color: row.visible ? "var(--sabah-black)" : "var(--sterling)" }}>
                  {row.visible ? "Visible" : "Hidden"}
                </span>
              </td>
              <td style={cellStyle}>
                <button
                  type="button"
                  onClick={() => toggle(row)}
                  disabled={busy === row.code}
                  style={secondaryButton}
                >
                  {row.visible ? "Hide" : "Show"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="px-1 py-3" style={{ fontSize: 12, color: "var(--sterling)" }}>
        Hiding a division only affects the public board, counts and name search. Admin views always
        show every division and every person.
      </p>
    </div>
  );
}

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

/** People who answered going, and the heads they are bringing. The two are
 *  deliberately shown side by side because they are different numbers. */
export function HeadcountPanel({ headcount }: { headcount: Headcount }) {
  return (
    <Section eyebrow="Capacity" title="Total heads expected">
      <div className="flex flex-wrap items-baseline gap-8">
        <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          <Num>{headcount.going}</Num> going
        </p>
        <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          <Num>{headcount.heads}</Num> total heads expected
        </p>
      </div>
      {headcount.heads > headcount.capacity && (
        <p className="mt-3" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
          Above Schenley Overlook capacity. Thorne Barn holds more.
        </p>
      )}
    </Section>
  );
}

/** Per event answers for every event of the current edition. Until someone
 *  answers one of them there is nothing to tabulate, so the panel says so
 *  rather than showing a table of zeros. */
export function EventHeadcountPanel({ rows }: { rows: EventHeadcountRow[] }) {
  const anyAnswers = rows.some((row) => row.yes + row.no > 0);

  return (
    <Section eyebrow="Per event" title="Every event of the weekend">
      {rows.length === 0 ? (
        <Empty>No tracked events on the current edition yet.</Empty>
      ) : !anyAnswers ? (
        <Empty>No answers yet for any event.</Empty>
      ) : (
        <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 520 }}>
            <thead>
              <tr>
                {["Event", "Yes", "No", "Going, no answer", "Heads"].map((h) => (
                  <th key={h} style={headStyle}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.eventId}>
                  <td style={cellStyle}>{row.title}</td>
                  <td style={cellStyle}>
                    <Num>{row.yes}</Num>
                  </td>
                  <td style={cellStyle}>
                    <Num>{row.no}</Num>
                  </td>
                  <td style={cellStyle}>
                    <Num>{row.unanswered}</Num>
                  </td>
                  <td style={cellStyle}>
                    <Num>{row.heads}</Num>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  );
}

/** Three scannable codes for the donation links, one per way to give. Same
 *  print first pattern as the /qr poster, black on white, level H. Static
 *  constants, so nothing to fetch. Screenshot or print at an in person event. */
export function DonateQrPanel() {
  const targets = [
    { name: "Endowment fund", url: FOUNDATION_DONATE_URL },
    { name: "PayPal", url: PAYPAL_DONATE_URL },
    { name: "Venmo", url: VENMO_DONATE_URL },
  ];

  return (
    <Section eyebrow="Donations" title="Scan to give">
      <div className="flex flex-wrap gap-6">
        {targets.map((target) => (
          <div
            key={target.name}
            className="flex flex-col items-center"
            style={{
              border: "1px solid var(--chalk)",
              background: "var(--pure-white)",
              padding: 20,
              width: 220,
            }}
          >
            <QRCodeSVG
              value={target.url}
              level="H"
              marginSize={2}
              bgColor="#FFFFFF"
              fgColor="#0B0B0C"
              title={`QR code for ${target.name}`}
              size={160}
            />
            <p className="mt-3 label-caps" style={{ color: "var(--sabah-black)" }}>
              {target.name}
            </p>
          </div>
        ))}
      </div>
    </Section>
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
      <div className="sm:col-span-2">
        <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
          Claimed, no answer: <Num>{gaps.claimed_no_answer.length}</Num>
        </h3>
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>
          They claimed their name but never said whether they are coming. Chase them personally.
        </p>
        {gaps.claimed_no_answer.length > 0 ? (
          <ul className="mt-3 flex flex-col gap-1">
            {gaps.claimed_no_answer.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-baseline justify-between gap-3"
                style={{ fontSize: 14, color: "var(--steel-ink)" }}
              >
                <span>{p.name}</span>
                <span className="label-caps" style={{ color: "var(--sterling)" }}>
                  {[p.division, p.year].filter(Boolean).join(" · ")}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
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
        on. Offsets resolve against the current edition's start date ({drip.anchorDate}), so a
        rollover moves every send with it.
      </p>
      <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>
          <thead>
            <tr>
              {["Key", "Offset days", "Sends on", "Audience states", "Anchors only", "Active"].map((h) => (
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
                <td style={cellStyle}><Num>{seq.send_on}</Num></td>
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
