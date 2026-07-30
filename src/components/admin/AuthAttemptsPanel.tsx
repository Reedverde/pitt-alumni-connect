import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";

import { getAuthAttempts } from "@/lib/admin.functions";
import { Section, cellStyle, headStyle, mono } from "./ui";

function stamp(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Anything other than a real send is called out, because the page tells the
 *  person the same neutral sentence in every case. */
export function AuthAttemptsPanel() {
  const load = useServerFn(getAuthAttempts);
  const { data } = useQuery({
    queryKey: ["admin-auth-attempts"],
    queryFn: () => load(),
    refetchInterval: 60_000,
  });
  const rows = data ?? [];
  const problems = rows.filter((r) => r.outcome !== "sent").length;

  return (
    <Section
      eyebrow="Sign-in attempts"
      title="Every request for a link"
      aside={
        <span style={{ ...mono, color: problems > 0 ? "var(--pitt-royal)" : "var(--sterling)" }}>
          {rows.length} shown · {problems} not sent
        </span>
      }
    >
      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>
          No sign-in link has been requested yet.
        </p>
      ) : (
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={headStyle}>When</th>
              <th style={headStyle}>Address</th>
              <th style={headStyle}>Person</th>
              <th style={headStyle}>Outcome</th>
              <th style={headStyle}>Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const bad = r.outcome !== "sent";
              return (
                <tr key={r.id} style={bad ? { background: "var(--concrete)" } : undefined}>
                  <td style={{ ...cellStyle, ...mono, whiteSpace: "nowrap" }}>
                    {stamp(r.created_at)}
                  </td>
                  <td style={cellStyle}>{r.email_attempted}</td>
                  <td style={cellStyle}>{r.name ?? "—"}</td>
                  <td
                    style={{
                      ...cellStyle,
                      fontWeight: bad ? 700 : 400,
                      color: bad ? "var(--pitt-royal)" : "var(--steel-ink)",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {r.outcome}
                  </td>
                  <td style={{ ...cellStyle, color: "var(--sterling)" }}>{r.detail ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </Section>
  );
}
