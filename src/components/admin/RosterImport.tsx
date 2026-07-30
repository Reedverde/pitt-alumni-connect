import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { adminRosterCommit, adminRosterDryRun } from "@/lib/admin.functions";
import type { RosterLine } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, inputStyle, primaryButton, secondaryButton } from "./ui";

const DIVISIONS = ["MENS_A", "MENS_B", "WOMENS_A", "WOMENS_B"];

type Summary = { matched: number; created: number; ambiguous: number; total: number };

export function RosterImport({ seasonYear, onDone }: { seasonYear: number; onDone: () => void }) {
  const dryRun = useServerFn(adminRosterDryRun);
  const commit = useServerFn(adminRosterCommit);
  const [text, setText] = useState("");
  const [division, setDivision] = useState("MENS_A");
  const [lines, setLines] = useState<RosterLine[] | null>(null);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async () => {
    setBusy(true);
    try {
      const result = await dryRun({ data: { text } });
      setLines(result.lines);
      setSummary(result.summary);
      if (result.lines.length === 0) toast.message("No names found in that paste.");
    } finally {
      setBusy(false);
    }
  };

  const resolveLine = (index: number, personId: string | null, bucket: RosterLine["bucket"]) =>
    setLines((current) =>
      (current ?? []).map((line, i) => (i === index ? { ...line, personId, bucket } : line)),
    );

  const write = async () => {
    if (!lines) return;
    setBusy(true);
    try {
      const result = await commit({
        data: {
          division,
          year: seasonYear,
          lines: lines.map((l) => ({
            parsed: l.parsed,
            personId: l.personId,
            create: l.personId === null && l.bucket === "new",
          })),
        },
      });
      toast.success(
        `Wrote ${result.matched + result.created} stints · ${result.created} new people · ${result.skipped} skipped.`,
      );
      setLines(null);
      setSummary(null);
      setText("");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  };

  const pending = summary
    ? {
        matched: (lines ?? []).filter((l) => l.personId !== null).length,
        created: (lines ?? []).filter((l) => l.personId === null && l.bucket === "new").length,
        ambiguous: (lines ?? []).filter((l) => l.personId === null && l.bucket === "ambiguous").length,
      }
    : null;

  return (
    <Section eyebrow="Roster import" title={`Current season · ${seasonYear}`}>
      <p className="mb-4" style={{ fontSize: 13, color: "var(--sterling)" }}>
        The only path that writes a current-year stint. Names alone are enough; no email is required.
        One name per line, “First Last” or “Last, First”.
      </p>

      <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          placeholder={"Kaczmarek, Nick\nReed Verdesoto"}
          style={{ ...inputStyle, fontFamily: '"Space Mono", ui-monospace, monospace' }}
        />
        <div>
          <label className="label-caps block" style={{ color: "var(--sterling)" }}>
            Division for this batch
          </label>
          <select
            value={division}
            onChange={(e) => setDivision(e.target.value)}
            style={{ ...inputStyle, marginTop: 6 }}
          >
            {DIVISIONS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
          <button
            type="button"
            style={{ ...secondaryButton, marginTop: 12, width: "100%" }}
            disabled={busy || !text.trim()}
            onClick={run}
          >
            Dry run
          </button>
        </div>
      </div>

      {summary ? (
        <div className="mt-6" style={{ border: hairline, borderRadius: 7, padding: 14 }}>
          <p className="label-caps" style={{ color: "var(--sterling)" }}>
            Dry run · nothing is written yet
          </p>
          <p className="mt-2" style={{ fontSize: 14, color: "var(--steel-ink)" }}>
            <Num>{summary.total}</Num> lines · <Num>{pending?.matched ?? 0}</Num> matched ·{" "}
            <Num>{pending?.created ?? 0}</Num> new people would be created ·{" "}
            <Num>{pending?.ambiguous ?? 0}</Num> still ambiguous
          </p>
        </div>
      ) : null}

      {lines && lines.length > 0 ? (
        <>
          <div className="mt-4 overflow-x-auto" style={{ borderBottom: hairline }}>
            <table className="w-full" style={{ borderCollapse: "collapse", minWidth: 760 }}>
              <thead>
                <tr>
                  {["Line", "Reads as", "Resolution"].map((h) => (
                    <th key={h} style={headStyle}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={`${line.raw}-${index}`}>
                    <td style={{ ...cellStyle, fontFamily: '"Space Mono", ui-monospace, monospace' }}>
                      {line.raw}
                    </td>
                    <td style={cellStyle}>{line.parsed}</td>
                    <td style={cellStyle}>
                      <select
                        value={line.personId ?? (line.bucket === "new" ? "__new" : "")}
                        onChange={(e) => {
                          const value = e.target.value;
                          if (value === "__new") resolveLine(index, null, "new");
                          else if (value === "") resolveLine(index, null, "ambiguous");
                          else resolveLine(index, value, "matched");
                        }}
                        style={{ ...inputStyle, maxWidth: 380 }}
                      >
                        <option value="">Unresolved — skip this line</option>
                        <option value="__new">Create a new person</option>
                        {line.candidates.map((c) => (
                          <option key={c.id} value={c.id}>
                            {c.name}
                            {c.grad_year ? ` ${c.grad_year}` : ""} · {c.score.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button type="button" style={primaryButton} disabled={busy} onClick={write}>
              Confirm and write stints
            </button>
            <button
              type="button"
              style={secondaryButton}
              disabled={busy}
              onClick={() => {
                setLines(null);
                setSummary(null);
              }}
            >
              Discard
            </button>
            <span style={{ fontSize: 12, color: "var(--sterling)" }}>
              Writes source <Num>roster_import</Num> at year <Num>{seasonYear}</Num>.
            </span>
          </div>
        </>
      ) : summary ? (
        <Empty>No usable names in that paste.</Empty>
      ) : null}
    </Section>
  );
}
