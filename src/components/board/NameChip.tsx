import { createContext, useContext } from "react";

import type { BoardPerson } from "@/lib/board.functions";

const STATE_WORDS: Record<BoardPerson["state"], string> = {
  unclaimed: "not claimed yet",
  claimed: "claimed",
  going: "going to Alumni Weekend",
  maybe: "maybe going to Alumni Weekend",
  memorial: "remembered",
};

/** Whether a viewer is signed in. Chips read it from context so the board does
 *  not have to thread a prop through every row component, and so a single
 *  session lookup serves hundreds of chips. */
export const ChipSessionContext = createContext(false);

function chipStyle(state: BoardPerson["state"]): React.CSSProperties {
  switch (state) {
    case "claimed":
      return { background: "transparent", color: "var(--pitt-royal)", border: "1px solid var(--pitt-royal)" };
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
      return "var(--pitt-royal)";
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
  const signedIn = useContext(ChipSessionContext);
  const name = [person.first_name, person.last_name].filter(Boolean).join(" ");
  const display = person.played_as ? `${name} "${person.played_as}"` : name;
  const teamPart = person.team_label ? `, ${person.team_label}` : "";
  const isUnclaimed = person.state === "unclaimed";
  // No row in identities at all: nobody has an address or a number for them.
  const noContact = isUnclaimed && person.has_contact === false;
  const clickable = Boolean(onClick) && person.state !== "memorial";
  const isCurrent = person.is_current === true;
  // Anyone who ever coached or managed carries the tag, even if they also played.
  const role = person.role_label ?? person.coach_role ?? null;
  const hasRole = person.has_coached === true || person.is_coach === true || role !== null;
  const roleTag = hasRole ? (role === "manager" ? "MANAGER" : "COACH") : null;
  // At most two tags, CURRENT first.
  const tags = [isCurrent ? "CURRENT" : null, roleTag].filter(Boolean) as string[];

  return (
    <button
      type="button"
      id={`person-${person.id}`}
      disabled={!clickable}
      onClick={clickable ? () => onClick?.(person) : undefined}
      title={noContact && signedIn ? "Help us reach them" : undefined}
      aria-label={`${display}${teamPart}${isCurrent ? ", current player" : ""}${
        roleTag === "MANAGER" ? ", manager" : roleTag === "COACH" ? ", coach" : ""
      }${
        person.board_year > 0 ? `, ${person.board_year}` : ""
      }, ${STATE_WORDS[person.state]}${noContact ? ", no contact info on file" : ""}${
        clickable
          ? noContact && signedIn
            ? ". Help us reach them"
            : isUnclaimed
              ? ". Claim this name"
              : ". Update this answer"
          : ""
      }`}
      // max-w-full keeps a long name plus its team and year tags inside a phone
      // screen: the name itself truncates rather than pushing the page sideways.
      className="group inline-flex max-w-full shrink-0 items-center gap-2 whitespace-nowrap rounded-full transition-[opacity,border-color] duration-150"
      style={{
        ...chipStyle(person.state),
        ...(noContact ? { border: "1.5px dashed var(--chalk)" } : null),
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
      <span
        className="min-w-0 overflow-hidden text-ellipsis"
        style={{ fontSize: 14, fontWeight: 500, lineHeight: 1.1 }}
      >
        {display}
      </span>
      {person.team_label && (
        <span style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.55, textTransform: "uppercase" }}>
          {person.team_label}
        </span>
      )}
      {tags.map((tag) => (
        <span
          key={tag}
          style={{ fontSize: 10, letterSpacing: "0.1em", opacity: 0.55, textTransform: "uppercase" }}
        >
          {tag}
        </span>
      ))}
      {person.board_year > 0 && (
        <span style={{ fontFamily: '"Space Mono", monospace', fontSize: 11, opacity: 0.7 }}>
          {person.board_year}
        </span>
      )}
      {noContact && signedIn ? (
        // Signed in, no way to reach them: the trailing affordance asks for help
        // instead of offering a claim. Anonymous visitors see nothing here.
        <span
          aria-hidden="true"
          className="inline-flex items-center gap-1 opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
          style={{ fontSize: 11, color: "var(--sterling)" }}
        >
          <span
            style={{
              fontFamily: '"Space Grotesk", sans-serif',
              fontSize: 11,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
            }}
          >
            Help us reach them
          </span>
          <span style={{ fontSize: 13, fontWeight: 700, color: "var(--pitt-royal)" }}>?</span>
        </span>
      ) : isUnclaimed ? (
        <span
          aria-hidden="true"
          className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus:opacity-100"
          style={{ fontSize: 13, fontWeight: 700, color: "var(--pitt-royal)" }}
        >
          +
        </span>
      ) : null}
    </button>
  );
}
