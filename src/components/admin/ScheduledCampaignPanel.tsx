import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";

import { adminCancelScheduledCampaign, adminScheduledCampaigns } from "@/lib/admin.functions";
import { Empty, Section, hairline, mono, secondaryButton } from "./ui";

type Row = {
  key: string;
  scheduledAt: string | null;
  dispatchedAt: string | null;
  cancelledAt: string | null;
  active: boolean;
  eligible: number;
  skips: { already_sent: number; recent_send: number; no_body: number } | null;
  subject: string | null;
  bodyText: string | null;
  audience: number;
  missedAt: string | null;
  scheduledLabel: string | null;
};


function eastern(iso: string | null) {
  if (!iso) return "not scheduled";
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso));
}

export function ScheduledCampaignPanel() {
  const load = useServerFn(adminScheduledCampaigns);
  const cancel = useServerFn(adminCancelScheduledCampaign);
  const [busy, setBusy] = useState<string | null>(null);
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["admin-scheduled-campaigns"],
    queryFn: () => load({}) as Promise<Row[]>,
  });

  const rows = data ?? [];

  return (
    <Section eyebrow="One time sends" title="Scheduled campaigns">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        A campaign here goes out once, at the time shown, and switches itself off again. Cancel it
        any time before that moment and nothing leaves the building.
      </p>

      {isLoading ? (
        <p style={{ fontSize: 13, color: "var(--sterling)" }}>Checking…</p>
      ) : rows.length === 0 ? (
        <Empty>Nothing is scheduled.</Empty>
      ) : (
        rows.map((row) => {
          const pending =
            !row.dispatchedAt && !row.cancelledAt && !row.missedAt && row.scheduledAt;
          return (
            <div key={row.key} style={{ border: hairline, padding: "14px 16px", marginBottom: 12 }}>
              <p style={{ fontSize: 15, fontWeight: 700, color: "var(--sabah-black)" }}>
                {row.subject ?? row.key}
              </p>
              <p style={{ ...mono, marginTop: 6 }}>
                {row.dispatchedAt
                  ? `Sent ${eastern(row.dispatchedAt)}`
                  : row.cancelledAt
                    ? `Cancelled ${eastern(row.cancelledAt)}`
                    : row.missedAt
                      ? `Missed. Nothing went out.`
                      : `Goes out ${row.scheduledLabel ?? eastern(row.scheduledAt)}`}
                {pending ? ` · ${row.eligible} eligible right now, ${row.audience} in the audience` : ""}
              </p>
              {row.missedAt ? (
                <p style={{ fontSize: 13, color: "var(--pitt-royal)", marginTop: 4 }}>
                  The moment for this one passed without it going out, so it was left unsent rather
                  than arriving late. Reschedule it if you still want it.
                </p>
              ) : null}
              {pending && row.skips ? (
                <p style={{ fontSize: 12, color: "var(--sterling)", marginTop: 4 }}>
                  Skipping {row.skips.already_sent} already sent this campaign,{" "}
                  {row.skips.recent_send} inside the ten day rule, {row.skips.no_body} with no
                  personal link. The list is checked again at send time.
                </p>
              ) : null}
              {pending && row.bodyText ? (
                <details className="mt-3">
                  <summary style={{ fontSize: 13, cursor: "pointer", color: "var(--pitt-royal)" }}>
                    Read it exactly as it will arrive
                  </summary>
                  <pre
                    className="mt-2"
                    style={{
                      whiteSpace: "pre-wrap",
                      fontSize: 12.5,
                      lineHeight: 1.6,
                      color: "var(--steel-ink)",
                      border: hairline,
                      padding: 12,
                    }}
                  >
                    {row.bodyText}
                  </pre>
                </details>
              ) : null}

              {pending ? (
                <button
                  type="button"
                  className="mt-3"
                  style={secondaryButton}
                  disabled={busy === row.key}
                  onClick={async () => {
                    if (!window.confirm(`Cancel "${row.subject ?? row.key}"? It will not go out.`))
                      return;
                    setBusy(row.key);
                    try {
                      await cancel({ data: { key: row.key } });
                      void refetch();
                    } finally {
                      setBusy(null);
                    }
                  }}
                >
                  {busy === row.key ? "Cancelling" : "Cancel this send"}
                </button>
              ) : null}
            </div>
          );
        })
      )}
    </Section>
  );
}
