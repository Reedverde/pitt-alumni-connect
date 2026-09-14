import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { adminRunDrip } from "@/lib/admin.functions";
import type { DripRunReport } from "@/lib/drip-types";
import { Empty, Num, Section, cellStyle, hairline, headStyle, mono, primaryButton, secondaryButton } from "./ui";

const REASONS: { key: keyof DripRunReport["sequences"][number]["excluded"]; label: string }[] = [
  { key: "suppressed", label: "suppressed" },
  { key: "no_email", label: "no email" },
  { key: "already_sent", label: "already sent" },
  { key: "recent_send", label: "10 day rule" },
  { key: "deceased_archived", label: "deceased or archived" },
  { key: "null_body", label: "no body" },
];

export function DripDispatchPanel() {
  const run = useServerFn(adminRunDrip);
  const [report, setReport] = useState<DripRunReport | null>(null);
  const [previewed, setPreviewed] = useState(false);
  const [busy, setBusy] = useState<"preview" | "send" | null>(null);

  async function preview() {
    setBusy("preview");
    try {
      const out = await run({ data: { dryRun: true } });
      setReport(out);
      setPreviewed(true);
    } finally {
      setBusy(null);
    }
  }

  async function send() {
    const count = report?.totalEligible ?? 0;
    if (count < 1) return;
    if (!window.confirm(`Send the drip to ${count} ${count === 1 ? "person" : "people"} now? This cannot be undone.`))
      return;
    setBusy("send");
    try {
      setReport(await run({ data: { dryRun: false } }));
      setPreviewed(false);
    } finally {
      setBusy(null);
    }
  }

  const eligible = report?.totalEligible ?? 0;
  const canSend = previewed && eligible > 0 && busy === null;

  return (
    <Section eyebrow="Sequence preview" title="What a sequence would reach">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        There is no daily drip any more, and nothing on this page sends. The only email that goes
        out is an approved campaign on its own dated schedule, or a sign-in link someone asks for.
        This page is for looking: it shows who a sequence would reach and why anyone is left out.
      </p>

      <p
        className="mb-4"
        style={{ border: hairline, padding: "12px 14px", fontSize: 13, color: "var(--steel-ink)" }}
      >
        <strong>The daily send is retired.</strong> Outbound mail stays on sign-in links only, and
        that does not change. A campaign that misses its scheduled minute is not sent late.
      </p>

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" style={primaryButton} disabled={busy !== null} onClick={preview}>
          {busy === "preview" ? "Checking" : "Preview"}
        </button>
        <span style={{ fontSize: 12, color: "var(--sterling)" }}>
          {previewed ? "Preview is current." : "Nothing has been checked yet."}
        </span>
      </div>


      {report === null ? (
        <Empty>No preview yet.</Empty>
      ) : report.sequences.length === 0 ? (
        <Empty>No sequence is active. Nothing to run.</Empty>
      ) : (
        <>
          <p className="mb-3" style={{ ...mono, fontSize: 12 }}>
            {report.dryRun ? "Dry run" : "Live run"} · today {report.today} · anchor{" "}
            {report.anchorDate} · eligible {report.totalEligible} · sent {report.totalSent}
            {report.stoppedReason ? (
              <span style={{ display: "block", color: "var(--pitt-royal)" }}>
                {report.stoppedReason}
              </span>
            ) : null}
          </p>

          <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 820 }}>
              <thead>
                <tr>
                  {["Sequence", "Due", "State", "Eligible", "Excluded", "Sent", "Failed"].map((h) => (
                    <th key={h} style={headStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {report.sequences.map((seq) => (
                  <tr key={seq.id}>
                    <td style={cellStyle}>{seq.key}</td>
                    <td style={cellStyle}>
                      <Num>{seq.dueDate}</Num>
                    </td>
                    <td style={{ ...cellStyle, color: seq.due ? "var(--steel-ink)" : "var(--sterling)" }}>
                      {seq.note}
                    </td>
                    <td style={cellStyle}>
                      <Num>{seq.eligible}</Num>
                    </td>
                    <td style={{ ...cellStyle, color: "var(--sterling)", fontSize: 12 }}>
                      {REASONS.filter((r) => seq.excluded[r.key] > 0)
                        .map((r) => `${r.label} ${seq.excluded[r.key]}`)
                        .join(" · ") || "none"}
                    </td>
                    <td style={cellStyle}>
                      <Num>{seq.sent}</Num>
                    </td>
                    <td style={cellStyle}>
                      <Num>{seq.failed}</Num>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {report.sequences
            .filter((s) => s.sample.length > 0)
            .map((seq) => (
              <div key={`${seq.id}-sample`} className="mt-5">
                <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
                  {seq.key} · first {seq.sample.length} of {seq.eligible}
                </h3>
                <ul style={{ ...mono, fontSize: 12, lineHeight: 1.8 }}>
                  {seq.sample.map((r) => (
                    <li key={r.personId}>
                      {r.name} · {r.email}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}
    </Section>
  );
}
