import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";

import { adminRunDrip } from "@/lib/admin.functions";
import type { DripRunReport } from "@/lib/dispatcher.server";
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
    <Section eyebrow="Drip dispatcher" title="Run the sequences">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Nothing is scheduled. A sequence only goes out when someone presses Send on this page, and
        only inside its window: the due date through two days after it. A person is never sent the
        same sequence twice, and never any drip within ten days of their last delivered message.
      </p>

      {report?.outboundPaused !== false ? (
        <p
          className="mb-4"
          style={{ border: hairline, padding: "12px 14px", fontSize: 13, color: "var(--steel-ink)" }}
        >
          <strong>Outbound mail is paused.</strong> While the mode is transactional only, no drip
          will leave the building. Previews still run in full. Change the mode above when you
          actually mean to send.
        </p>
      ) : null}

      <div className="mb-6 flex flex-wrap items-center gap-2">
        <button type="button" style={primaryButton} disabled={busy !== null} onClick={preview}>
          {busy === "preview" ? "Checking" : "Preview"}
        </button>
        <button
          type="button"
          style={{ ...secondaryButton, opacity: canSend ? 1 : 0.4 }}
          disabled={!canSend}
          onClick={send}
        >
          {busy === "send"
            ? "Sending"
            : eligible > 0
              ? `Send to ${eligible} ${eligible === 1 ? "person" : "people"}`
              : "Send"}
        </button>
        <span style={{ fontSize: 12, color: "var(--sterling)" }}>
          {previewed ? "Preview is current." : "Run a preview before sending."}
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
