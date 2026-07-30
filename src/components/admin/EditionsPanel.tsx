import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  adminAddEditionEvent,
  adminCreateEdition,
  adminDefaultEditionDates,
  adminDeleteEditionEvent,
  adminSetEditionCurrent,
  adminSetEditionPublished,
  adminUpdateEdition,
} from "@/lib/admin.functions";
import type { EditionRow } from "@/lib/admin.server";
import { Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

const DIVISIONS = ["", "MENS_A", "MENS_B", "WOMENS_A", "WOMENS_B"];

export function EditionsPanel({ rows, onSaved }: { rows: EditionRow[]; onSaved: () => void }) {
  const create = useServerFn(adminCreateEdition);
  const update = useServerFn(adminUpdateEdition);
  const publish = useServerFn(adminSetEditionPublished);
  const setCurrent = useServerFn(adminSetEditionCurrent);
  const addEvent = useServerFn(adminAddEditionEvent);
  const deleteEvent = useServerFn(adminDeleteEditionEvent);
  const defaults = useServerFn(adminDefaultEditionDates);

  const [busy, setBusy] = useState(false);
  const [draft, setDraft] = useState({
    event_year: String(new Date().getFullYear() + 1),
    title: "",
    starts_on: "",
    ends_on: "",
  });
  const [editing, setEditing] = useState<
    Record<number, { title: string; starts_on: string; ends_on: string; lodging_note: string; travel_note: string }>
  >({});
  const [eventYear, setEventYear] = useState<number | null>(null);
  const [placeholdersOnly, setPlaceholdersOnly] = useState(false);
  const [eventDraft, setEventDraft] = useState({
    title: "",
    day_number: "1",
    division: "",
    location: "",
    notes: "",
    time_tbd: true,
    starts_at: "",
  });

  const run = async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true);
    try {
      await fn();
      toast.success(ok);
      onSaved();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't save.");
    } finally {
      setBusy(false);
    }
  };

  const fillDefaults = async () => {
    const year = Number(draft.event_year);
    if (!Number.isInteger(year)) return;
    const dates = await defaults({ data: { event_year: year } });
    if (dates) setDraft((d) => ({ ...d, starts_on: dates.starts_on, ends_on: dates.ends_on }));
  };

  return (
    <Section eyebrow="Editions" title="Rolling over a year">
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Three separate actions. Creating an edition does not publish it, and publishing does not
        make it current. Only the current edition drives the countdown, the schedule and the gold
        chips.
      </p>

      <div className="overflow-x-auto" style={{ borderBottom: hairline }}>
        <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 860 }}>
          <thead>
            <tr>
              {["Year", "Title", "Starts", "Ends", "Events", "Going", "Published", "Current", ""].map((h) => (
                <th key={h} style={headStyle}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const edit = editing[row.event_year];
              return (
                <>
                <tr key={row.event_year}>
                  <td style={cellStyle}>
                    <Num>{row.event_year}</Num>
                  </td>
                  <td style={cellStyle}>
                    {edit ? (
                      <input
                        style={inputStyle}
                        value={edit.title}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, [row.event_year]: { ...edit, title: e.target.value } }))
                        }
                      />
                    ) : (
                      row.title
                    )}
                  </td>
                  <td style={cellStyle}>
                    {edit ? (
                      <input
                        type="date"
                        style={inputStyle}
                        value={edit.starts_on}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, [row.event_year]: { ...edit, starts_on: e.target.value } }))
                        }
                      />
                    ) : (
                      <Num>{row.starts_on}</Num>
                    )}
                  </td>
                  <td style={cellStyle}>
                    {edit ? (
                      <input
                        type="date"
                        style={inputStyle}
                        value={edit.ends_on}
                        onChange={(e) =>
                          setEditing((s) => ({ ...s, [row.event_year]: { ...edit, ends_on: e.target.value } }))
                        }
                      />
                    ) : (
                      <Num>{row.ends_on}</Num>
                    )}
                  </td>
                  <td style={cellStyle}>
                    <Num>{row.event_count}</Num>
                  </td>
                  <td style={cellStyle}>
                    <Num>{row.going}</Num>
                  </td>
                  <td style={cellStyle}>
                    <span className="label-caps">{row.published ? "yes" : "no"}</span>
                  </td>
                  <td style={cellStyle}>
                    <span className="label-caps">{row.is_current ? "current" : "—"}</span>
                  </td>
                  <td style={{ ...cellStyle, whiteSpace: "nowrap" }}>
                    <div className="flex flex-wrap gap-2">
                      {edit ? (
                        <>
                          <button
                            type="button"
                            style={primaryButton}
                            disabled={busy}
                            onClick={() =>
                              run(
                                () => update({ data: { event_year: row.event_year, ...edit } }),
                                "Dates saved.",
                              ).then(() =>
                                setEditing((s) => {
                                  const next = { ...s };
                                  delete next[row.event_year];
                                  return next;
                                }),
                              )
                            }
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() =>
                              setEditing((s) => {
                                const next = { ...s };
                                delete next[row.event_year];
                                return next;
                              })
                            }
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() =>
                              setEditing((s) => ({
                                ...s,
                                 [row.event_year]: {
                                   title: row.title,
                                   starts_on: row.starts_on,
                                   ends_on: row.ends_on,
                                   lodging_note: row.lodging_note ?? "",
                                   travel_note: row.travel_note ?? "",
                                 },
                              }))
                            }
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            style={secondaryButton}
                            disabled={busy}
                            onClick={() =>
                              run(
                                () =>
                                  publish({
                                    data: { event_year: row.event_year, published: !row.published },
                                  }),
                                row.published ? "Unpublished." : "Published.",
                              )
                            }
                          >
                            {row.published ? "Unpublish" : "Publish"}
                          </button>
                          {!row.is_current && (
                            <button
                              type="button"
                              style={secondaryButton}
                              disabled={busy}
                              onClick={() => {
                                if (
                                  !window.confirm(
                                    `Make ${row.event_year} the current edition? This replaces the live countdown and resets every gold chip to that year's RSVPs.`,
                                  )
                                )
                                  return;
                                void run(
                                  () => setCurrent({ data: { event_year: row.event_year } }),
                                  `${row.event_year} is now current.`,
                                );
                              }}
                            >
                              Make current
                            </button>
                          )}
                          <button
                            type="button"
                            style={secondaryButton}
                            onClick={() =>
                              setEventYear(eventYear === row.event_year ? null : row.event_year)
                            }
                          >
                            Add event
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
                {edit && (
                  <tr key={`${row.event_year}-notes`}>
                    <td style={cellStyle} colSpan={9}>
                      <div className="grid gap-3 md:grid-cols-2">
                        <label style={{ fontSize: 13, color: "var(--sterling)" }}>
                          Lodging note
                          <textarea
                            style={{ ...inputStyle, minHeight: 84 }}
                            value={edit.lodging_note}
                            onChange={(e) =>
                              setEditing((s) => ({
                                ...s,
                                [row.event_year]: { ...edit, lodging_note: e.target.value },
                              }))
                            }
                          />
                        </label>
                        <label style={{ fontSize: 13, color: "var(--sterling)" }}>
                          Travel note
                          <textarea
                            style={{ ...inputStyle, minHeight: 84 }}
                            value={edit.travel_note}
                            onChange={(e) =>
                              setEditing((s) => ({
                                ...s,
                                [row.event_year]: { ...edit, travel_note: e.target.value },
                              }))
                            }
                          />
                        </label>
                      </div>
                      <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
                        Plain text. Both show on the weekend page when filled and disappear when empty.
                      </p>
                    </td>
                  </tr>
                )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      {eventYear !== null && (
        <div className="mt-6" style={{ border: hairline, padding: 16 }}>
          <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
            Events · {eventYear}
          </p>
          <div className="mb-6 flex flex-col gap-2">
            {(rows.find((r) => r.event_year === eventYear)?.events ?? []).map((ev) => (
              <div key={ev.id} className="flex flex-wrap items-center gap-3" style={{ fontSize: 13 }}>
                <Num>Day {ev.day_number ?? 1}</Num>
                <span style={{ color: "var(--sabah-black)" }}>{ev.title}</span>
                <span className="label-caps" style={{ color: "var(--sterling)" }}>
                  {ev.division ?? "Whole program"}
                  {ev.time_tbd ? " · TBD" : ""}
                </span>
                {ev.is_placeholder && (
                  <span
                    className="label-caps"
                    style={{
                      border: "1px solid var(--pitt-royal)",
                      color: "var(--pitt-royal)",
                      padding: "2px 6px",
                    }}
                  >
                    Placeholder · edit or delete when real plans exist
                  </span>
                )}
                <button
                  type="button"
                  style={secondaryButton}
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(`Delete "${ev.title}"?`)) return;
                    void run(() => deleteEvent({ data: { id: ev.id } }), "Event deleted.");
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
            {(rows.find((r) => r.event_year === eventYear)?.events ?? []).length === 0 && (
              <p style={{ fontSize: 13, color: "var(--sterling)" }}>Nothing scheduled yet.</p>
            )}
          </div>
          <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
            New event · {eventYear}
          </p>
          <div className="grid gap-3 md:grid-cols-3">
            <input
              style={inputStyle}
              placeholder="Title"
              value={eventDraft.title}
              onChange={(e) => setEventDraft((d) => ({ ...d, title: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="Day number (1, 2, 3)"
              value={eventDraft.day_number}
              onChange={(e) => setEventDraft((d) => ({ ...d, day_number: e.target.value }))}
            />
            <select
              style={inputStyle}
              value={eventDraft.division}
              onChange={(e) => setEventDraft((d) => ({ ...d, division: e.target.value }))}
            >
              {DIVISIONS.map((code) => (
                <option key={code} value={code}>
                  {code === "" ? "Whole program" : code}
                </option>
              ))}
            </select>
            <input
              style={inputStyle}
              placeholder="Location"
              value={eventDraft.location}
              onChange={(e) => setEventDraft((d) => ({ ...d, location: e.target.value }))}
            />
            <input
              style={inputStyle}
              placeholder="Notes"
              value={eventDraft.notes}
              onChange={(e) => setEventDraft((d) => ({ ...d, notes: e.target.value }))}
            />
            <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
              <input
                type="checkbox"
                checked={eventDraft.time_tbd}
                onChange={(e) => setEventDraft((d) => ({ ...d, time_tbd: e.target.checked }))}
              />
              Time TBD
            </label>
            {!eventDraft.time_tbd && (
              <input
                type="datetime-local"
                style={inputStyle}
                value={eventDraft.starts_at}
                onChange={(e) => setEventDraft((d) => ({ ...d, starts_at: e.target.value }))}
              />
            )}
          </div>
          <div className="mt-4">
            <button
              type="button"
              style={primaryButton}
              disabled={busy}
              onClick={() =>
                run(
                  () =>
                    addEvent({
                      data: {
                        event_year: eventYear,
                        title: eventDraft.title,
                        day_number: Number(eventDraft.day_number) || 1,
                        division: eventDraft.division || null,
                        location: eventDraft.location || null,
                        notes: eventDraft.notes || null,
                        time_tbd: eventDraft.time_tbd,
                        starts_at: eventDraft.starts_at
                          ? new Date(eventDraft.starts_at).toISOString()
                          : null,
                      },
                    }),
                  "Event added.",
                ).then(() =>
                  setEventDraft({
                    title: "",
                    day_number: "1",
                    division: "",
                    location: "",
                    notes: "",
                    time_tbd: true,
                    starts_at: "",
                  }),
                )
              }
            >
              Add event
            </button>
          </div>
        </div>
      )}

      <div className="mt-8" style={{ border: hairline, padding: 16 }}>
        <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
          New edition
        </p>
        <div className="grid gap-3 md:grid-cols-4">
          <input
            style={inputStyle}
            placeholder="Year"
            value={draft.event_year}
            onChange={(e) => setDraft((d) => ({ ...d, event_year: e.target.value }))}
            onBlur={fillDefaults}
          />
          <input
            style={inputStyle}
            placeholder="Title"
            value={draft.title}
            onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          />
          <input
            type="date"
            style={inputStyle}
            value={draft.starts_on}
            onChange={(e) => setDraft((d) => ({ ...d, starts_on: e.target.value }))}
          />
          <input
            type="date"
            style={inputStyle}
            value={draft.ends_on}
            onChange={(e) => setDraft((d) => ({ ...d, ends_on: e.target.value }))}
          />
        </div>
        <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
          Dates default to the first weekend of October for that year. Override them if the weekend
          moves.
        </p>
        <div className="mt-4 flex gap-2">
          <button type="button" style={secondaryButton} onClick={fillDefaults}>
            Use first weekend of October
          </button>
          <button
            type="button"
            style={primaryButton}
            disabled={busy}
            onClick={() =>
              run(
                () =>
                  create({
                    data: {
                      event_year: Number(draft.event_year),
                      title: draft.title || `Alumni Weekend ${draft.event_year}`,
                      starts_on: draft.starts_on || null,
                      ends_on: draft.ends_on || null,
                    },
                  }),
                "Edition created. It is not published and not current.",
              )
            }
          >
            Create edition
          </button>
        </div>
      </div>
    </Section>
  );
}
