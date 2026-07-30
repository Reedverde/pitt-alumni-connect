import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import { adminMergePeople } from "@/lib/admin.functions";
import type { AdminPerson, DuplicatePair } from "@/lib/admin.server";
import { Empty, Num, Section, TypedConfirm, cellStyle, hairline, headStyle, inputStyle } from "./ui";

function Side({
  person,
  survivor,
  onPick,
}: {
  person: AdminPerson;
  survivor: boolean;
  onPick: () => void;
}) {
  return (
    <div
      style={{
        border: survivor ? "2px solid var(--pitt-royal)" : hairline,
        borderRadius: 7,
        padding: 12,
      }}
    >
      <label className="flex items-center gap-2" style={{ fontSize: 13 }}>
        <input type="radio" checked={survivor} onChange={onPick} />
        <span className="label-caps">{survivor ? "Survivor" : "Keep as survivor"}</span>
      </label>
      <table className="mt-2 w-full" style={{ borderCollapse: "collapse" }}>
        <tbody>
          {(
            [
              ["Name", [person.first_name, person.last_name].filter(Boolean).join(" ")],
              ["Played as", person.played_as ?? "—"],
              ["Grad", person.grad_year ?? "—"],
              ["Board year", person.board_year ?? "—"],
              ["Division", person.board_division ?? "—"],
              ["Stints", person.stint_count],
              ["State", person.state.replace(/_/g, " ")],
              ["Member no", person.member_no],
            ] as const
          ).map(([label, value]) => (
            <tr key={label}>
              <th style={headStyle}>{label}</th>
              <td style={{ ...cellStyle, fontFamily: '"Space Mono", ui-monospace, monospace' }}>
                {String(value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PairRow({ pair, onDone }: { pair: DuplicatePair; onDone: () => void }) {
  const merge = useServerFn(adminMergePeople);
  const [survivorId, setSurvivorId] = useState(pair.a.id);
  const [playedAs, setPlayedAs] = useState("");
  const [busy, setBusy] = useState(false);

  const loserId = survivorId === pair.a.id ? pair.b.id : pair.a.id;

  const run = async () => {
    setBusy(true);
    try {
      await merge({ data: { survivorId, loserId, playedAs: playedAs || null } });
      toast.success("Merged. Child rows repointed and the loser deleted.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Merge failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ borderTop: hairline, padding: "16px 0" }}>
      <p className="label-caps mb-3" style={{ color: "var(--sterling)" }}>
        Similarity <Num>{pair.score.toFixed(2)}</Num>
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <Side person={pair.a} survivor={survivorId === pair.a.id} onPick={() => setSurvivorId(pair.a.id)} />
        <Side person={pair.b} survivor={survivorId === pair.b.id} onPick={() => setSurvivorId(pair.b.id)} />
      </div>
      <div className="mt-3 grid gap-3 sm:grid-cols-[240px_1fr] sm:items-end">
        <div>
          <label className="label-caps block" style={{ color: "var(--sterling)" }}>
            Played as on the survivor
          </label>
          <input
            value={playedAs}
            onChange={(e) => setPlayedAs(e.target.value)}
            placeholder={pair.a.played_as ?? pair.b.played_as ?? "keep the survivor's"}
            style={{ ...inputStyle, marginTop: 6 }}
          />
        </div>
        <TypedConfirm phrase="MERGE" label="Merge and delete the other record" onConfirm={run} busy={busy} />
      </div>
    </div>
  );
}

export function MergeTool({ pairs, onDone }: { pairs: DuplicatePair[]; onDone: () => void }) {
  return (
    <Section eyebrow="Name collisions" title="Merge duplicates">
      <p className="mb-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Merging repoints stints, identities, RSVPs, verifications and suggestions to the survivor,
        then deletes the other record. The whole before and after goes to the audit log. There is no
        undo.
      </p>
      {pairs.length === 0 ? (
        <Empty>No candidate pairs by name and overlapping years.</Empty>
      ) : (
        pairs.map((pair) => <PairRow key={pair.key} pair={pair} onDone={onDone} />)
      )}
    </Section>
  );
}
