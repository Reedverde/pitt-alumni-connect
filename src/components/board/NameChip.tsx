import type { BoardPerson } from "@/lib/board.functions";

const STATE_WORDS: Record<BoardPerson["state"], string> = {
  unclaimed: "not claimed yet",
  claimed: "claimed",
  going: "going to Alumni Weekend",
  maybe: "maybe going to Alumni Weekend",
  memorial: "remembered",
};

function chipStyle(state: BoardPerson["state"]): React.CSSProperties {
  switch (state) {
    case "claimed":
      return { background: "var(--pitt-royal)", color: "var(--pure-white)", border: "1px solid transparent" };
    case "going":
      return { background: "var(--pitt-gold)", color: "var(--sabah-black)", border: "1px solid transparent" };
    case "maybe":
      return { background: "transparent", color: "var(--steel-ink)", border: "1px solid var(--pitt-gold)" };
    case "memorial":
      return { background: "var(--sabah-black)", color: "var(--pure-white)", border: "1px solid transparent" };
    default:
      return { background: "transparent", color: "var(--sterling)", border: "1px solid var(--chalk)" };
  }
}

function dotColor(state: BoardPerson["state"]) {
  switch (state) {
    case "claimed":
      return "rgba(255,255,255,0.4)";
    case "going":
      return "var(--sabah-black)";
    case "maybe":
      return "var(--pitt-gold)";
    default:
      return "var(--chalk)";
  }
}

export function NameChip({
  person,
  dimmed,
  onClick,
}: {
  person: BoardPerson;
  dimmed: boolean;
  onClick?: (person: BoardPerson) => void;
}) {
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const display = person.played_as ? `${name} "${person.played_as}"` : name;
  const teamPart = person.team_label ? `, ${person.team_label}` : "";
  const isUnclaimed = person.state === "unclaimed";
  const clickable = Boolean(onClick) && person.state !== "memorial";
  const isCurrent = person.is_current === true;
  const isCoach = person.is_coach === true;
  const isManager = isCoach && person.role_label === "manager";
  const tag = isManager ? "MANAGER" : isCoach ? "COACH" : isCurrent ? "CURRENT" : null;

  return (
    <button
      type="button"
      id={`person-${person.id}`}
      disabled={!clickable}
      onClick={clickable ? () => onClick?.(person) : undefined}
      aria-label={`${display}${teamPart}${
        isManager ? ", manager" : isCoach ? ", coach" : isCurrent ? ", current player" : ""
      }${
        person.board_year > 0 ? `, ${person.board_year}` : ""
      }, ${STATE_WORDS[person.state]}${
        clickable ? (isUnclaimed ? ". Claim this name" : ". Update this answer") : ""
      }`}
      className="group inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full transition-[opacity,border-color] duration-150"
      style={{
        ...chipStyle(person.state),
        padding: "7px 13px",
        opacity: dimmed ? 0.25 : 1,
        cursor: clickable ? "pointer" : "default",
      }}
    >
      {person.state !== "memorial" && (
        <span
          aria-hidden="true"
          className="inline-block shrink-0 rounded-full"
          style={{ width: 6, height: 6, background: dotColor(person.state) }}
        />
      )}
      <span style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.1 }}>{display}</span>
      {person.team_label && (
        <span style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.55, textTransform: "uppercase" }}>
          {person.team_label}
        </span>
      )}
      {tag && (
        <span style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.55, textTransform: "uppercase" }}>
          {tag}
        </span>
      )}
      {person.board_year > 0 && (
        <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, opacity: 0.7 }}>
          {person.board_year}
        </span>
      )}
      {isUnclaimed && (
        <span
          aria-hidden="true"
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--pitt-royal)" }}
        >
          +
        </span>
      )}
    </button>
  );
}
