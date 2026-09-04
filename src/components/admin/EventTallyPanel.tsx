import type { EventHeadcountRow, PeopleFilterKey } from "@/lib/admin.server";
import { audienceLabel, statusLabel } from "@/lib/event-model";
import { Num, Section, cellStyle, hairline, headStyle } from "./ui";

export type EventTallyTarget = {
  eventId: string;
  filter: Extract<PeopleFilterKey, "event_yes" | "event_no" | "event_no_choice">;
};

function when(row: EventHeadcountRow) {
  if (!row.startsAt) return row.timeTbd ? "Time to be confirmed" : "Date to be confirmed";
  const date = new Date(row.startsAt);
  const day = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
  if (row.timeTbd) return `${day} · time to be confirmed`;
  const time = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
  return `${day} · ${time} ET`;
}

/** Per event tallies on the overview, so an organizer never has to leave this
 *  screen to know who is coming to what. People counts carry the weight; heads
 *  sit beside them, quieter and labelled, because they are a different
 *  measure. Every number is a button onto the exact list it counted. */
export function EventTallyPanel({
  rows,
  onOpen,
}: {
  rows: EventHeadcountRow[];
  onOpen: (target: EventTallyTarget) => void;
}) {
  const denominator = rows[0]?.denominator ?? 0;

  return (
    <section className="mb-16">
      <h3 className="label-caps mb-1" style={{ color: "var(--sterling)" }}>
        Every event of the weekend
      </h3>
      <p className="mb-3" style={{ fontSize: 12, color: "var(--sterling)" }}>
        Counted out of the <Num>{denominator}</Num> people who can answer and said they are going to
        the weekend. Yes, No and No choice are people. Expected heads is the sum of party sizes on
        the Yes answers only, so it is always the larger figure. Open the Yes list to see the party
        sizes behind it.
      </p>

      {rows.length === 0 ? (
        <p style={{ fontSize: 13, color: "var(--sterling)", border: hairline, padding: "10px 12px" }}>
          No published event on the current edition asks whether people are coming.
        </p>
      ) : (
        <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
          <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 640 }}>
            <thead>
              <tr>
                <th style={headStyle}>Event</th>
                <th style={{ ...headStyle, textAlign: "right" }}>Yes</th>
                <th style={{ ...headStyle, textAlign: "right" }}>No</th>
                <th style={{ ...headStyle, textAlign: "right" }}>No choice</th>
                <th
                  style={{
                    ...headStyle,
                    textAlign: "right",
                    borderLeft: hairline,
                    color: "var(--sterling)",
                  }}
                >
                  Expected heads
                </th>
                <th style={{ ...headStyle, textAlign: "right", color: "var(--sterling)" }}>
                  Target and capacity
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.eventId}>
                  <td style={cellStyle}>
                    <span style={{ fontWeight: 600, color: "var(--sabah-black)" }}>{row.title}</span>
                    <span className="block" style={{ fontSize: 12, color: "var(--sterling)" }}>
                      {when(row)}
                      {row.location ? ` · ${row.location}` : ""}
                    </span>
                    <span className="block" style={{ fontSize: 11, color: "var(--sterling)" }}>
                      {statusLabel(row.status)} · {audienceLabel(row.audience, row.division)}
                    </span>
                  </td>
                  <Tally
                    value={row.yes}
                    label={`${row.yes} people said yes to ${row.title}`}
                    onClick={() => onOpen({ eventId: row.eventId, filter: "event_yes" })}
                  />
                  <Tally
                    value={row.no}
                    label={`${row.no} people said no to ${row.title}`}
                    onClick={() => onOpen({ eventId: row.eventId, filter: "event_no" })}
                  />
                  <Tally
                    value={row.unanswered}
                    label={`${row.unanswered} people made no choice on ${row.title}`}
                    onClick={() => onOpen({ eventId: row.eventId, filter: "event_no_choice" })}
                  />
                  <td style={{ ...cellStyle, textAlign: "right", borderLeft: hairline }}>
                    <span
                      style={{
                        fontFamily: '"Space Mono", ui-monospace, monospace',
                        fontSize: 13,
                        color: "var(--sterling)",
                      }}
                    >
                      {row.heads}
                    </span>
                    <span className="block" style={{ fontSize: 11, color: "var(--sterling)" }}>
                      heads
                    </span>
                  </td>
                  <td style={{ ...cellStyle, textAlign: "right" }}>
                    {row.criticalMass ? (
                      <span
                        className="block"
                        style={{
                          fontFamily: '"Space Mono", ui-monospace, monospace',
                          fontSize: 13,
                          color:
                            row.heads >= row.criticalMass ? "var(--pitt-royal)" : "var(--sterling)",
                        }}
                      >
                        {row.heads} of {row.criticalMass}
                        {row.heads >= row.criticalMass ? " · target met" : " to go ahead"}
                      </span>
                    ) : (
                      <span className="block" style={{ fontSize: 11, color: "var(--sterling)" }}>
                        No target
                      </span>
                    )}
                    <span className="block" style={{ fontSize: 11, color: "var(--sterling)" }}>
                      {row.capacity
                        ? `${Math.max(row.capacity - row.heads, 0)} of ${row.capacity} places left`
                        : "No capacity limit"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Tally({
  value,
  label,
  onClick,
}: {
  value: number;
  label: string;
  onClick: () => void;
}) {
  return (
    <td style={{ ...cellStyle, textAlign: "right", padding: 0 }}>
      <button
        type="button"
        onClick={onClick}
        aria-label={label}
        className="w-full text-right"
        style={{
          padding: "8px 10px",
          cursor: "pointer",
          background: "transparent",
          fontFamily: '"Space Mono", ui-monospace, monospace',
          fontSize: 16,
          color: value > 0 ? "var(--sabah-black)" : "var(--sterling)",
          minHeight: 44,
        }}
      >
        {value}
      </button>
    </td>
  );
}

export { EventTallyPanel as default };
