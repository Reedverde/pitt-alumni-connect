import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { adminCampaignKeys, adminMailStatus, adminTargetedResend } from "@/lib/admin.functions";
import type { TargetedResult } from "@/lib/targeted-resend.server";
import { Empty, Section, cellStyle, headStyle, inputStyle, mono, primaryButton, secondaryButton } from "./ui";

const STATUS_LABEL: Record<string, string> = {
  going: "Going",
  maybe: "Maybe",
  not_this_year: "Not this year",
};

/** Named addresses, one campaign body, one run. The resend deliberately skips
 *  the already-sent rule and the cooldown; it never skips a suppression or a
 *  memorial record, and board visibility has no say in it. */
export function TargetedResendPanel() {
  const runResend = useServerFn(adminTargetedResend);
  const fetchKeys = useServerFn(adminCampaignKeys);
  const fetchStatus = useServerFn(adminMailStatus);

  const { data: keys } = useQuery({ queryKey: ["admin-campaign-keys"], queryFn: () => fetchKeys({}) });
  const { data: status, refetch: refetchStatus } = useQuery({
    queryKey: ["admin-mail-status"],
    queryFn: () => fetchStatus({}),
  });

  const [addresses, setAddresses] = useState("");
  const [campaignKey, setCampaignKey] = useState("rsvp_confirm_2026_09_04");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<TargetedResult | null>(null);

  const paused = status?.outboundMode !== "all";

  async function run(dryRun: boolean) {
    setBusy(true);
    try {
      const out = await runResend({ data: { campaignKey, addresses, dryRun } });
      setResult(out ?? null);
      void refetchStatus();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Section eyebrow="Targeted mail" title="Resend to specific people">
      <p className="mb-4" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        Paste addresses, one per line. A resend ignores the already-sent rule and the ten day
        cooldown on purpose. It never overrides a suppressed address or a memorial record, and it
        does not care whether someone is shown on the board.
      </p>

      <div className="mb-4 grid gap-3 md:grid-cols-[1fr_260px]">
        <textarea
          value={addresses}
          onChange={(e) => setAddresses(e.target.value)}
          rows={8}
          placeholder={"name@example.com\nsomeone@example.com"}
          style={{ ...inputStyle, fontFamily: '"Space Mono", monospace', minHeight: 160 }}
        />
        <div>
          <label className="label-caps" style={{ display: "block", marginBottom: 6, color: "var(--sterling)" }}>
            Message
          </label>
          <select
            value={campaignKey}
            onChange={(e) => setCampaignKey(e.target.value)}
            style={inputStyle}
          >
            {(keys ?? [campaignKey]).map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" style={secondaryButton} disabled={busy} onClick={() => run(true)}>
              Preview
            </button>
            <button
              type="button"
              style={{ ...primaryButton, opacity: paused ? 0.5 : 1 }}
              disabled={busy || paused}
              onClick={() => run(false)}
            >
              Send
            </button>
          </div>
          {paused ? (
            <p className="mt-2" style={{ fontSize: 12, color: "var(--sterling)" }}>
              Sending is off because outgoing mail is paused to sign-in links only. Turn it on in
              Mail configuration first.
            </p>
          ) : null}
        </div>
      </div>

      {result ? (
        <>
          <p className="mb-3" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            {result.reason ? (
              <span style={{ color: "var(--pitt-royal)" }}>{result.reason}</span>
            ) : result.dryRun ? (
              <>
                Preview only. <span style={mono}>{result.rows.filter((r) => !r.skip).length}</span>{" "}
                would receive it, <span style={mono}>{result.skipped}</span> would be skipped.
                {result.subject ? ` Subject: “${result.subject}”.` : ""}
              </>
            ) : (
              <>
                Sent <span style={mono}>{result.sent}</span> · failed{" "}
                <span style={mono}>{result.failed}</span> · skipped{" "}
                <span style={mono}>{result.skipped}</span>.
              </>
            )}
          </p>
          {result.rows.length === 0 ? (
            <Empty>No addresses resolved.</Empty>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Name</th>
                    <th style={headStyle}>Address</th>
                    <th style={headStyle}>Answer</th>
                    <th style={headStyle}>Outcome</th>
                  </tr>
                </thead>
                <tbody>
                  {result.rows.map((row) => (
                    <tr key={row.email}>
                      <td style={cellStyle}>{row.name ?? "—"}</td>
                      <td style={{ ...cellStyle, ...mono }}>{row.email}</td>
                      <td style={cellStyle}>
                        {row.rsvpStatus ? (STATUS_LABEL[row.rsvpStatus] ?? row.rsvpStatus) : "No answer"}
                      </td>
                      <td style={{ ...cellStyle, color: row.skip ? "var(--sterling)" : "var(--steel-ink)" }}>
                        {row.skip
                          ? `Skipped: ${row.skip}`
                          : result.dryRun
                            ? "Would send"
                            : row.sent
                              ? "Sent"
                              : `Failed: ${row.error ?? "unknown"}`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : null}
    </Section>
  );
}
