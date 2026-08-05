import type { RsvpBreakdown, SendRow, SendTotals, SourceCount } from "@/lib/admin.server";
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

/** Every answer for the current edition, by name, including the ones the public
 *  board must never list. Admin only. */
export function RsvpBreakdownPanel({ data }: { data: RsvpBreakdown }) {
  return (
    <Section
      eyebrow="Answers"
      title={`Who said what for ${data.eventYear}`}
      aside={
        <span style={{ fontSize: 13, color: "var(--sterling)" }}>
          Organizer view only. Never shown on the board.
        </span>
      }
    >
      <div className="grid gap-8 md:grid-cols-2">
        {data.buckets.map((bucket) => (
          <div key={bucket.key}>
            <p className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
              {bucket.label} <span style={mono}>{bucket.count}</span>
            </p>
            {bucket.people.length === 0 ? (
              <Empty>Nobody yet.</Empty>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th style={headStyle}>Name</th>
                    <th style={headStyle}>Year</th>
                    <th style={headStyle}>Party</th>
                  </tr>
                </thead>
                <tbody>
                  {bucket.people.map((p) => (
                    <tr key={p.person_id}>
                      <td style={cellStyle}>{p.name}</td>
                      <td style={{ ...cellStyle, ...mono }}>{p.board_year ?? "—"}</td>
                      <td style={{ ...cellStyle, ...mono }}>{p.party_size ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ))}
      </div>
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
      <p className="mb-4" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
        One-click answer links: <span style={mono}>{totals.linksOpened}</span> opened ·{" "}
        <span style={mono}>{totals.linksConfirmed}</span> confirmed. Loading a link writes
        nothing, so a wide gap between the two is security scanners opening mail, not people
        changing their minds.
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