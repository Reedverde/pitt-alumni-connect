import type { SendRow, SendTotals, SourceCount } from "@/lib/admin.server";
import { Empty, Section, cellStyle, headStyle, mono } from "./ui";

const STATUS_COLOR: Record<string, string> = {
  sent: "var(--steel-ink)",
  delivered: "var(--steel-ink)",
  failed: "var(--pitt-royal)",
  bounced: "var(--pitt-royal)",
  complained: "var(--pitt-royal)",
  suppressed: "var(--sterling)",
  throttled: "var(--sterling)",
};

function when(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

const OUTCOME_LABEL: Record<string, string> = {
  sent: "Delivered",
  blocked: "Blocked",
  failed: "Failed",
  suppressed: "Held back",
};

export function SourcesPanel({ sources }: { sources: SourceCount[] }) {
  const total = sources.reduce((sum, s) => sum + s.count, 0);
  return (
    <Section eyebrow="Attribution" title="Where the answers came from">
      {sources.length === 0 ? (
        <Empty>No answers yet.</Empty>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse", maxWidth: 420 }}>
          <thead>
            <tr>
              <th style={headStyle}>Source</th>
              <th style={headStyle}>Answers</th>
            </tr>
          </thead>
          <tbody>
            {sources.map((s) => (
              <tr key={s.src}>
                <td style={cellStyle}>{s.label}</td>
                <td style={{ ...cellStyle, ...mono }}>{s.count}</td>
              </tr>
            ))}
            <tr>
              <td style={cellStyle}>Total</td>
              <td style={{ ...cellStyle, ...mono }}>{total}</td>
            </tr>
          </tbody>
        </table>
      )}
    </Section>
  );
}

export function SendsPanel({ rows, totals }: { rows: SendRow[]; totals: SendTotals }) {
  return (
    <Section eyebrow="Outbound mail" title="Last fifty messages">
      <p className="mb-4" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        <span style={mono}>{totals.sent}</span> actually delivered ·{" "}
        <span style={mono}>{totals.blocked}</span> blocked by the pause ·{" "}
        <span style={mono}>{totals.failed}</span> failed ·{" "}
        <span style={mono}>{totals.suppressed}</span> held back. Only the first number
        counts as mail that left the building.
      </p>
      {rows.length === 0 ? (
        <Empty>Nothing has been sent yet.</Empty>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={headStyle}>When</th>
                <th style={headStyle}>Who</th>
                <th style={headStyle}>Address</th>
                <th style={headStyle}>Type</th>
                <th style={headStyle}>Outcome</th>
                <th style={headStyle}>Status</th>
                <th style={headStyle}>Message id</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td style={{ ...cellStyle, ...mono, whiteSpace: "nowrap" }}>
                    {when(row.created_at)}
                  </td>
                  <td style={cellStyle}>{row.name ?? "—"}</td>
                  <td style={{ ...cellStyle, ...mono }}>{row.to_email ?? "—"}</td>
                  <td style={cellStyle}>{row.kind}</td>
                  <td style={cellStyle}>
                    <span
                      className="label-caps"
                      style={{
                        color: row.outcome === "sent" ? "var(--steel-ink)" : "var(--sterling)",
                      }}
                    >
                      {OUTCOME_LABEL[row.outcome] ?? row.outcome}
                    </span>
                  </td>
                  <td
                    style={{
                      ...cellStyle,
                      color: STATUS_COLOR[row.status] ?? "var(--steel-ink)",
                      fontWeight: row.error ? 700 : 400,
                    }}
                  >
                    {row.status}
                    {row.blocked_reason ?? row.error ? (
                      <span
                        style={{ display: "block", fontSize: 12, color: "var(--sterling)", fontWeight: 400 }}
                      >
                        {row.blocked_reason ?? row.error}
                      </span>
                    ) : null}
                  </td>
                  <td style={{ ...cellStyle, ...mono, fontSize: 11 }}>
                    {row.provider_message_id ?? "—"}
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