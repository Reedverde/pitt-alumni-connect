import type { EditionEventRow } from "@/lib/admin.server";
import {
  EVENT_AUDIENCES,
  EVENT_AUDIENCE_LABELS,
  EVENT_STATUSES,
  EVENT_STATUS_LABELS,
  eventWarnings,
} from "@/lib/event-model";

import { hairline, inputStyle } from "./ui";

/** One editor for every meaningful field on an event. The same form adds a new
 *  event and edits an existing one, so the two can never drift apart. */
export type EventFormValue = {
  title: string;
  admin_name: string;
  admin_key: string;
  day_number: string;
  division: string;
  status: string;
  audience: string;
  location: string;
  map_url: string;
  ticket_url: string;
  notes: string;
  organizer_notes: string;
  time_tbd: boolean;
  starts_at: string;
  ends_at: string;
  timezone: string;
  prompt_rsvp: boolean;
  ask_party_size: boolean;
  critical_mass: string;
  capacity: string;
  published: boolean;
  is_placeholder: boolean;
};

const local = (iso: string | null) => (iso ? iso.slice(0, 16) : "");

export function emptyEventForm(): EventFormValue {
  return {
    title: "",
    admin_name: "",
    admin_key: "",
    day_number: "1",
    division: "",
    status: "tentative",
    audience: "everyone",
    location: "",
    map_url: "",
    ticket_url: "",
    notes: "",
    organizer_notes: "",
    time_tbd: true,
    starts_at: "",
    ends_at: "",
    timezone: "America/New_York",
    // Everything on the schedule asks the question unless an organizer says no.
    prompt_rsvp: true,
    ask_party_size: true,
    critical_mass: "",
    capacity: "",
    published: false,
    is_placeholder: false,
  };
}

export function formFromRow(row: EditionEventRow): EventFormValue {
  return {
    title: row.title,
    admin_name: row.admin_name ?? "",
    admin_key: row.admin_key ?? "",
    day_number: String(row.day_number ?? 1),
    division: row.division ?? "",
    status: row.status ?? "tentative",
    audience: row.audience ?? "everyone",
    location: row.location ?? "",
    map_url: row.map_url ?? "",
    ticket_url: row.ticket_url ?? "",
    notes: row.notes ?? "",
    organizer_notes: row.organizer_notes ?? "",
    time_tbd: row.time_tbd,
    starts_at: local(row.starts_at),
    ends_at: local(row.ends_at),
    timezone: row.timezone ?? "America/New_York",
    prompt_rsvp: row.prompt_rsvp,
    ask_party_size: row.ask_party_size,
    critical_mass: row.critical_mass === null ? "" : String(row.critical_mass),
    capacity: row.capacity === null ? "" : String(row.capacity),
    published: row.published,
    is_placeholder: row.is_placeholder,
  };
}

const num = (value: string) => {
  const n = Number(value.trim());
  return value.trim() === "" || !Number.isFinite(n) || n <= 0 ? null : Math.trunc(n);
};

export function toPayload(form: EventFormValue) {
  return {
    title: form.title.trim(),
    admin_name: form.admin_name.trim() || null,
    admin_key: form.admin_key.trim() || null,
    day_number: Number(form.day_number) || 1,
    division: form.division || null,
    status: form.status,
    audience: form.audience,
    location: form.location.trim() || null,
    map_url: form.map_url.trim() || null,
    ticket_url: form.ticket_url.trim() || null,
    notes: form.notes.trim() || null,
    organizer_notes: form.organizer_notes.trim() || null,
    time_tbd: form.time_tbd,
    starts_at: form.time_tbd || !form.starts_at ? null : new Date(form.starts_at).toISOString(),
    ends_at: form.time_tbd || !form.ends_at ? null : new Date(form.ends_at).toISOString(),
    timezone: form.timezone || "America/New_York",
    prompt_rsvp: form.prompt_rsvp,
    ask_party_size: form.ask_party_size,
    critical_mass: num(form.critical_mass),
    capacity: num(form.capacity),
    published: form.published,
    is_placeholder: form.is_placeholder,
  };
}

/** Everything an organizer can get wrong without the save failing. */
export function formWarnings(form: EventFormValue, heads?: number | null) {
  const payload = toPayload(form);
  return eventWarnings(payload, heads ?? null);
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1" style={{ fontSize: 13 }}>
      <span className="label-caps" style={{ color: "var(--sterling)" }}>
        {label}
      </span>
      {children}
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2" style={{ fontSize: 13, color: "var(--steel-ink)" }}>
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}

export function EventFields({
  value,
  onChange,
  divisions,
  heads,
}: {
  value: EventFormValue;
  onChange: (next: EventFormValue) => void;
  divisions: readonly string[];
  heads?: number | null;
}) {
  const set = <K extends keyof EventFormValue>(key: K, next: EventFormValue[K]) =>
    onChange({ ...value, [key]: next });
  const warnings = formWarnings(value, heads);

  return (
    <div className="mt-2" style={{ border: hairline, padding: 12 }}>
      <div className="grid gap-3 md:grid-cols-3">
        <Field label="Public title">
          <input style={inputStyle} value={value.title} onChange={(e) => set("title", e.target.value)} />
        </Field>
        <Field label="Internal name">
          <input
            style={inputStyle}
            placeholder="Only organizers see this"
            value={value.admin_name}
            onChange={(e) => set("admin_name", e.target.value)}
          />
        </Field>
        <Field label="Short id">
          <input
            style={inputStyle}
            placeholder="bar-crawl-2026"
            value={value.admin_key}
            onChange={(e) => set("admin_key", e.target.value)}
          />
        </Field>

        <Field label="Day number">
          <input
            style={inputStyle}
            value={value.day_number}
            onChange={(e) => set("day_number", e.target.value)}
          />
        </Field>
        <Field label="Planning status">
          <select style={inputStyle} value={value.status} onChange={(e) => set("status", e.target.value)}>
            {EVENT_STATUSES.map((code) => (
              <option key={code} value={code}>
                {EVENT_STATUS_LABELS[code]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Who it is for">
          <select style={inputStyle} value={value.audience} onChange={(e) => set("audience", e.target.value)}>
            {EVENT_AUDIENCES.map((code) => (
              <option key={code} value={code}>
                {EVENT_AUDIENCE_LABELS[code]}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Program">
          <select style={inputStyle} value={value.division} onChange={(e) => set("division", e.target.value)}>
            {divisions.map((code) => (
              <option key={code} value={code}>
                {code === "" ? "Whole program" : code}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Location">
          <input style={inputStyle} value={value.location} onChange={(e) => set("location", e.target.value)} />
        </Field>
        <Field label="Time zone">
          <input style={inputStyle} value={value.timezone} onChange={(e) => set("timezone", e.target.value)} />
        </Field>

        <Field label="Map link">
          <input style={inputStyle} value={value.map_url} onChange={(e) => set("map_url", e.target.value)} />
        </Field>
        <Field label="Ticket link">
          <input
            style={inputStyle}
            value={value.ticket_url}
            onChange={(e) => set("ticket_url", e.target.value)}
          />
        </Field>
        <Field label="Public description">
          <input style={inputStyle} value={value.notes} onChange={(e) => set("notes", e.target.value)} />
        </Field>

        <Field label="Organizer notes">
          <input
            style={inputStyle}
            placeholder="Private. Never shown publicly."
            value={value.organizer_notes}
            onChange={(e) => set("organizer_notes", e.target.value)}
          />
        </Field>
        <Field label="Critical mass target">
          <input
            style={inputStyle}
            placeholder="Leave empty for none"
            value={value.critical_mass}
            onChange={(e) => set("critical_mass", e.target.value)}
          />
        </Field>
        <Field label="Capacity">
          <input
            style={inputStyle}
            placeholder="Leave empty for none"
            value={value.capacity}
            onChange={(e) => set("capacity", e.target.value)}
          />
        </Field>

        {!value.time_tbd && (
          <>
            <Field label="Starts">
              <input
                type="datetime-local"
                style={inputStyle}
                value={value.starts_at}
                onChange={(e) => set("starts_at", e.target.value)}
              />
            </Field>
            <Field label="Ends">
              <input
                type="datetime-local"
                style={inputStyle}
                value={value.ends_at}
                onChange={(e) => set("ends_at", e.target.value)}
              />
            </Field>
          </>
        )}
      </div>

      <div className="mt-3 flex flex-wrap gap-4">
        <Check label="Time not set yet" checked={value.time_tbd} onChange={(v) => set("time_tbd", v)} />
        <Check label="Placeholder" checked={value.is_placeholder} onChange={(v) => set("is_placeholder", v)} />
        <Check label="Published" checked={value.published} onChange={(v) => set("published", v)} />
        <Check label="Ask for an RSVP" checked={value.prompt_rsvp} onChange={(v) => set("prompt_rsvp", v)} />
        <Check
          label="Ask how many are coming"
          checked={value.ask_party_size}
          onChange={(v) => set("ask_party_size", v)}
        />
      </div>

      {warnings.length > 0 && (
        <ul className="mt-3" style={{ fontSize: 13, color: "var(--pitt-royal)" }}>
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      )}
    </div>
  );
}
