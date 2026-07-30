import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { adminRecordMemorial, adminResolveSuggestion } from "@/lib/admin.functions";
import type { QueueItem } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

function When({ value }: { value: string | null }) {
  if (!value) return null;
  return <Num>{value.slice(0, 10)}</Num>;
}

function MemorialCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const record = useServerFn(adminRecordMemorial);
  const [note, setNote] = useState(String(item.payload.note ?? ""));
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [busy, setBusy] = useState(false);

  const save = async (markDeceased: boolean) => {
    if (!item.person) return;
    setBusy(true);
    try {
      await record({
        data: {
          personId: item.person.id,
          suggestionId: item.id,
          note,
          confirmedByName: name,
          confirmedAt: date,
          markDeceased,
        },
      });
      toast.success(markDeceased ? "Record marked and logged." : "Note saved.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ border: hairline, borderRadius: 7, padding: 16, background: "var(--field-white)" }}>
      <p className="label-caps" style={{ color: "var(--sterling)" }}>
        Private admin note
      </p>
      <p className="mt-2" style={{ fontSize: 15, color: "var(--steel-ink)" }}>
        {item.person?.name ?? "Record not found"}
        {item.person?.grad_year ? <> · <Num>{item.person.grad_year}</Num></> : null}
      </p>
      <p className="mt-1" style={{ fontSize: 12, color: "var(--sterling)" }}>
        Reported by {item.submitter ?? "a member"} on <When value={item.created_at} />. Nothing here
        changes a record until an admin confirms off site and types the confirming name and date.
      </p>

      <label className="label-caps mt-4 block" style={{ color: "var(--sterling)" }}>
        What was confirmed, and how
      </label>
      <textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        rows={3}
        style={{ ...inputStyle, marginTop: 6 }}
      />

      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="label-caps block" style={{ color: "var(--sterling)" }}>
            Confirmed by (name)
          </label>
          <input value={name} onChange={(e) => setName(e.target.value)} style={{ ...inputStyle, marginTop: 6 }} />
        </div>
        <div>
          <label className="label-caps block" style={{ color: "var(--sterling)" }}>
            Confirmed on (date)
          </label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            style={{ ...inputStyle, marginTop: 6, fontFamily: '"Space Mono", ui-monospace, monospace' }}
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" style={secondaryButton} disabled={busy} onClick={() => save(false)}>
          Save note only
        </button>
        <button
          type="button"
          style={{ ...secondaryButton, opacity: name.trim() && date ? 1 : 0.4 }}
          disabled={busy || !name.trim() || !date}
          onClick={() => save(true)}
        >
          Record as confirmed
        </button>
      </div>
    </div>
  );
}

function NewPersonCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const resolve = useServerFn(adminResolveSuggestion);
  const [busy, setBusy] = useState(false);

  const act = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      await resolve({ data: { suggestionId: item.id, action } });
      toast.success(action === "approve" ? "Record created." : "Closed with no record.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't do that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: hairline, padding: "14px 0" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>
          {item.proposedName ?? "Unnamed"}
          {typeof item.payload.grad_year === "number" ? (
            <> · <Num>{item.payload.grad_year}</Num></>
          ) : null}
          {typeof item.payload.division === "string" ? (
            <span style={{ color: "var(--sterling)" }}> · {item.payload.division}</span>
          ) : null}
        </p>
        <p style={{ fontSize: 12, color: "var(--sterling)" }}>
          from {item.submitter ?? "a member"} · <When value={item.created_at} /> ·{" "}
          {item.peer_vouched ? "peer vouched" : "no peer vouch yet"}
        </p>
      </div>
      {item.matches.length > 0 ? (
        <p className="mt-2" style={{ fontSize: 12, color: "var(--sterling)" }}>
          Possible duplicates:{" "}
          {item.matches.map((m, i) => (
            <span key={m.id}>
              {i > 0 ? "; " : ""}
              {m.name}
              {m.grad_year ? <> <Num>{m.grad_year}</Num></> : null} (<Num>{m.score.toFixed(2)}</Num>)
            </span>
          ))}
        </p>
      ) : (
        <p className="mt-2" style={{ fontSize: 12, color: "var(--sterling)" }}>
          No close match in the roster.
        </p>
      )}
      {item.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" style={primaryButton} disabled={busy} onClick={() => act("approve")}>
            Approve
          </button>
          <button type="button" style={secondaryButton} disabled={busy} onClick={() => act("reject")}>
            Reject
          </button>
        </div>
      ) : (
        <p className="mt-2 label-caps" style={{ color: "var(--sterling)" }}>
          {item.status}
        </p>
      )}
    </div>
  );
}

function EditCard({ item, onDone }: { item: QueueItem; onDone: () => void }) {
  const resolve = useServerFn(adminResolveSuggestion);
  const [busy, setBusy] = useState(false);
  const act = async (action: "approve" | "reject") => {
    setBusy(true);
    try {
      await resolve({ data: { suggestionId: item.id, action } });
      toast.success(action === "approve" ? "Edit applied." : "Edit closed.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't do that.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: hairline, padding: "14px 0" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>{item.person?.name ?? "Unknown record"}</p>
        <p style={{ fontSize: 12, color: "var(--sterling)" }}>
          from {item.submitter ?? "a member"} · <When value={item.created_at} />
        </p>
      </div>
      <table className="mt-2 w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={headStyle}>Field</th>
            <th style={headStyle}>Before</th>
            <th style={headStyle}>After</th>
          </tr>
        </thead>
        <tbody>
          {item.diff.map((row) => (
            <tr key={row.field}>
              <td style={cellStyle}>{row.field}</td>
              <td style={{ ...cellStyle, color: "var(--sterling)" }}>{row.before}</td>
              <td style={cellStyle}>{row.after}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {item.status === "pending" ? (
        <div className="mt-3 flex gap-2">
          <button type="button" style={primaryButton} disabled={busy} onClick={() => act("approve")}>
            Apply
          </button>
          <button type="button" style={secondaryButton} disabled={busy} onClick={() => act("reject")}>
            Reject
          </button>
        </div>
      ) : null}
    </div>
  );
}

function RosterCard({ item }: { item: QueueItem }) {
  return (
    <div style={{ borderTop: hairline, padding: "14px 0" }}>
      <p style={{ fontSize: 15, color: "var(--steel-ink)" }}>Roster import batch</p>
      <p className="mt-1" style={{ fontSize: 12, color: "var(--sterling)" }}>
        from {item.submitter ?? "an admin"} · <When value={item.created_at} /> · {item.status}
      </p>
      <pre
        className="mt-2 overflow-x-auto"
        style={{ fontFamily: '"Space Mono", ui-monospace, monospace', fontSize: 12, color: "var(--steel-ink)" }}
      >
        {JSON.stringify(item.payload, null, 2)}
      </pre>
    </div>
  );
}

export function ReviewQueue({ queue, onRefresh }: { queue: QueueItem[]; onRefresh: () => void }) {
  const pending = queue.filter((q) => q.status === "pending");
  const stale = pending.filter((q) => q.stale);
  const group = (type: QueueItem["type"]) => pending.filter((q) => q.type === type);

  return (
    <Section eyebrow="Review queue" title="Waiting on you">
      <p
        className="mb-6"
        style={{
          display: "inline-block",
          border: "1px solid var(--steel-ink)",
          padding: "4px 10px",
          fontFamily: "var(--font-mono, monospace)",
          fontSize: 12,
          color: "var(--sabah-black)",
        }}
      >
        {pending.length} pending
      </p>
      <div className="grid gap-10">
        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            New people · <Num>{group("new_person").length}</Num>
          </h3>
          {group("new_person").length === 0 ? (
            <Empty>Nothing pending.</Empty>
          ) : (
            group("new_person").map((item) => (
              <NewPersonCard key={item.id} item={item} onDone={onRefresh} />
            ))
          )}
        </div>

        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Edits · <Num>{group("edit").length}</Num>
          </h3>
          {group("edit").length === 0 ? (
            <Empty>Nothing pending.</Empty>
          ) : (
            group("edit").map((item) => <EditCard key={item.id} item={item} onDone={onRefresh} />)
          )}
        </div>

        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Roster imports · <Num>{group("roster_import").length}</Num>
          </h3>
          {group("roster_import").length === 0 ? (
            <Empty>Nothing pending.</Empty>
          ) : (
            group("roster_import").map((item) => <RosterCard key={item.id} item={item} />)
          )}
        </div>

        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Memorials · <Num>{group("memorial").length}</Num>
          </h3>
          <p className="mb-3" style={{ fontSize: 12, color: "var(--sterling)" }}>
            There is no approve button here.
          </p>
          {group("memorial").length === 0 ? (
            <Empty>Nothing reported.</Empty>
          ) : (
            <div className="grid gap-4">
              {group("memorial").map((item) => (
                <MemorialCard key={item.id} item={item} onDone={onRefresh} />
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="label-caps mb-2" style={{ color: "var(--sterling)" }}>
            Fell to you · unverified after <Num>7</Num> days · <Num>{stale.length}</Num>
          </h3>
          {stale.length === 0 ? (
            <Empty>Nothing has aged out.</Empty>
          ) : (
            stale.map((item) => <NewPersonCard key={`stale-${item.id}`} item={item} onDone={onRefresh} />)
          )}
        </div>
      </div>
    </Section>
  );
}
