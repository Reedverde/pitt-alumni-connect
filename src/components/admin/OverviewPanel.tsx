import type { AdminOverview, OverviewTile, PeopleFilterKey } from "@/lib/admin.server";
import { Num, Section, hairline } from "./ui";

/** One screen an organizer can open cold. Every tile is a button: the number
 *  and the list behind it come from the same rows, so tapping a figure lands
 *  on exactly the people it counted. Dense and quiet on purpose. */
export function OverviewPanel({
  overview,
  onOpen,
}: {
  overview: AdminOverview;
  onOpen: (tile: OverviewTile) => void;
}) {
  const group = (keys: string[]) =>
    keys.map((k) => overview.tiles.find((t) => t.key === k)).filter(Boolean) as OverviewTile[];

  const attendance = group([
    "going",
    "heads",
    "maybe",
    "not_this_year",
    "no_response",
    "claimed",
  ]);
  const actions = group([
    "missing_event_answers",
    "new_person",
    "queue",
    "duplicates",
    "no_contact",
    "unplaced",
    "needs_review",
    "bad_contact",
  ]);

  return (
    <Section
      eyebrow={`Alumni Weekend ${overview.eventYear}`}
      title="Where the weekend stands"
      aside={
        <p style={{ fontSize: 12, color: "var(--sterling)" }}>
          <Num>{overview.eligible}</Num> people on the board can answer
        </p>
      }
    >
      <Grid tiles={attendance} onOpen={onOpen} />
      <h3 className="label-caps mt-8 mb-3" style={{ color: "var(--sterling)" }}>
        Next actions
      </h3>
      <Grid tiles={actions} onOpen={onOpen} />
      <p className="mt-4" style={{ fontSize: 12, color: "var(--sterling)" }}>
        No response means nobody has answered for them. It is never counted as a no.
      </p>
    </Section>
  );
}

function Grid({ tiles, onOpen }: { tiles: OverviewTile[]; onOpen: (t: OverviewTile) => void }) {
  return (
    <div className="grid gap-px sm:grid-cols-2 lg:grid-cols-4" style={{ background: "var(--pure-white)", border: hairline }}>
      {tiles.map((tile) => (
        <button
          key={tile.key}
          type="button"
          onClick={() => onOpen(tile)}
          className="text-left"
          style={{
            background: "var(--pure-white)",
            boxShadow: "0 0 0 0.5px var(--chalk)",
            padding: "14px 14px 16px",
            cursor: "pointer",
            minHeight: 96,
          }}
        >
          <span className="label-caps block" style={{ color: "var(--sterling)" }}>
            {tile.label}
          </span>
          <span
            className="block"
            style={{
              fontFamily: '"Space Mono", ui-monospace, monospace',
              fontSize: 26,
              lineHeight: 1.1,
              marginTop: 4,
              color: tile.value > 0 ? "var(--sabah-black)" : "var(--sterling)",
            }}
          >
            {tile.value}
          </span>
          <span className="block mt-1" style={{ fontSize: 12, color: "var(--sterling)" }}>
            {tile.hint}
          </span>
        </button>
      ))}
    </div>
  );
}

export type { PeopleFilterKey };
