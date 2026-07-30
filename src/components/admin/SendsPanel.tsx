import type { SendRow } from "@/lib/admin.server";
import { Empty, Section, cellStyle, headStyle, mono } from "./ui";

const STATUS_COLOR: Record<string, string> = {
  sent: "var(--steel-ink)",
  delivered: "var(--steel-ink)",
  failed: "var(--pitt-royal)",
  bounced: "var(--pitt-royal)",
  complained: "var(--pitt-royal)",
  suppressed: "var(--sterling)",
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

export function SendsPanel({ rows }: { rows: SendRow[] }) {
  return (
    <Section eyebrow="Outbound mail" title="Last fifty messages">
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
                  <td
                    style={{
                      ...cellStyle,
                      color: STATUS_COLOR[row.status] ?? "var(--steel-ink)",
                      fontWeight: row.error ? 700 : 400,
                    }}
                  >
                    {row.status}
                    {row.error ? (
                      <span
                        style={{ display: "block", fontSize: 12, color: "var(--sterling)", fontWeight: 400 }}
                      >
                        {row.error}
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