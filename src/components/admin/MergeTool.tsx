import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { toast } from "sonner";

import {
  adminKeepPairSeparate,
  adminMergeDuplicatePair,
  adminUndoMerge,
} from "@/lib/admin.functions";
import type { AdminPerson, ArchivedRecord, DuplicatePair } from "@/lib/admin.server";
import { Empty, Num, Section, cellStyle, hairline, headStyle, secondaryButton } from "./ui";

function Side({ person, survivor }: { person: AdminPerson; survivor: boolean }) {
  return (
    <div
      style={{
        border: survivor ? "2px solid var(--pitt-royal)" : hairline,
        borderRadius: 7,
        padding: 12,
      }}
    >
      <p className="label-caps" style={{ color: survivor ? "var(--pitt-royal)" : "var(--sterling)" }}>
        {survivor ? "Survivor, kept" : "Folded in, archived"}
      </p>
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

function name(p: AdminPerson) {
  return [p.first_name, p.last_name].filter(Boolean).join(" ");
}

/** Two records in a collision almost always share a display name, so the
 *  member number travels with it everywhere. */
function labelled(p: AdminPerson) {
  return `${name(p)}, no ${p.member_no}`;
}

function PairRow({
  pair,
  onDone,
  onDismiss,
}: {
  pair: DuplicatePair;
  onDone: () => void;
  onDismiss: () => void;
}) {
  const merge = useServerFn(adminMergeDuplicatePair);
  const keepSeparate = useServerFn(adminKeepPairSeparate);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  const survivor = pair.survivorId === pair.a.id ? pair.a : pair.b;
  const loser = pair.survivorId === pair.a.id ? pair.b : pair.a;

  const runMerge = async () => {
    setBusy(true);
    try {
      await merge({ data: { survivorId: pair.survivorId, loserId: pair.loserId } });
      toast.success("Merged. Child rows repointed and the ruling recorded.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Merge failed.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  const runKeep = async () => {
    setBusy(true);
    try {
      await keepSeparate({ data: { aId: pair.a.id, bId: pair.b.id, note: null } });
      toast.success("Ruled separate. This pair will not surface again.");
      onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Couldn't record the ruling.");
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
        <Side person={survivor} survivor />
        <Side person={loser} survivor={false} />
      </div>

      <div
        className="mt-3"
        style={{ border: hairline, borderRadius: 7, padding: 12, fontSize: 13 }}
      >
        <p className="label-caps" style={{ color: "var(--sterling)" }}>
          What moves
        </p>
        <p className="mt-2" style={{ color: "var(--steel-ink)" }}>
          Before: <strong>{labelled(survivor)}</strong> keeps its own rows.{" "}
          <strong>{labelled(loser)}</strong> holds <Num>{pair.moves.stints}</Num> stints,{" "}
          <Num>{pair.moves.identities}</Num> identities and <Num>{pair.moves.rsvps}</Num> RSVPs.
        </p>
        <p className="mt-1" style={{ color: "var(--steel-ink)" }}>
          After: all of those point at <strong>{labelled(survivor)}</strong>, and the record for{" "}
          <strong>{labelled(loser)}</strong> is archived, not deleted. It leaves the board, the
          counts and the match pool, stays visible here under Archived records, and can be restored
          exactly with Undo merge.
        </p>
        <p className="mt-1" style={{ color: "var(--sterling)" }}>
          Survivor picked automatically: more stints, ties to the lower member number.
        </p>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {confirming ? (
          <>
            <button
              type="button"
              style={secondaryButton}
              disabled={busy}
              onClick={runMerge}
            >
              Confirm merge
            </button>
            <button
              type="button"
              style={{ ...secondaryButton, opacity: 0.7 }}
              disabled={busy}
              onClick={() => setConfirming(false)}
            >
              Cancel
            </button>
          </>
        ) : (
          <button
            type="button"
            style={secondaryButton}
            disabled={busy}
            onClick={() => setConfirming(true)}
          >
            Merge
          </button>
        )}
        <button type="button" style={secondaryButton} disabled={busy} onClick={runKeep}>
          Keep separate, permanently
        </button>
        <button
          type="button"
          style={{ ...secondaryButton, opacity: 0.7 }}
          disabled={busy}
          onClick={onDismiss}
        >
          Not now, hide until the next scan
        </button>
      </div>
    </div>
  );
}

export function MergeTool({ pairs, onDone }: { pairs: DuplicatePair[]; onDone: () => void }) {
  const [dismissed, setDismissed] = useState<string[]>([]);
  const visible = pairs.filter((p) => !dismissed.includes(p.key));

  return (
    <Section eyebrow="Name collisions" title="Duplicate rulings">
      <p className="mb-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
        Merging repoints stints, identities, RSVPs, verifications and suggestions onto the survivor,
        then deletes the other record and records a ruling. Keep separate is permanent and the pair
        never surfaces again. Not now stores nothing, so the pair returns on the next scan.
      </p>
      {visible.length === 0 ? (
        <Empty>No unruled candidate pairs by name and overlapping years.</Empty>
      ) : (
        visible.map((pair) => (
          <PairRow
            key={pair.key}
            pair={pair}
            onDone={onDone}
            onDismiss={() => setDismissed((d) => [...d, pair.key])}
          />
        ))
      )}
    </Section>
  );
}
