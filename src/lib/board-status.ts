import type { BoardPerson } from "@/lib/board.functions";

/**
 * Two different things used to be one word.
 *
 * `BoardPerson.state` blends a permanent property of a record (has this person
 * claimed their name, do we have any way to reach them, are they remembered)
 * with a single year's answer (are they coming to this edition). The board read
 * as one long key because of it.
 *
 * This module carries the two apart WITHOUT changing the wire format. Every
 * existing reader of `state` keeps working; new surfaces read
 * `profileStatusOf` and `attendanceOf` instead. When every reader has moved
 * over, `state` can be split at the database. Until then both representations
 * are derived from the same row, so they can never disagree.
 */

/** Permanent, not tied to any one weekend. */
export type ProfileStatus = "memorial" | "no_contact" | "claimed" | "unclaimed";

/** This edition only. Never mixed into the profile status. */
export type Attendance = "going" | "maybe" | "unanswered";

export function profileStatusOf(person: BoardPerson): ProfileStatus {
  if (person.state === "memorial") return "memorial";
  if (person.state === "unclaimed") {
    return person.has_contact === false ? "no_contact" : "unclaimed";
  }
  return "claimed";
}

/** Only meaningful while an edition is live. Off season everyone is unanswered. */
export function attendanceOf(person: BoardPerson): Attendance {
  if (person.state === "going") return "going";
  if (person.state === "maybe") return "maybe";
  return "unanswered";
}

export const PROFILE_STATUS_LABELS: Record<ProfileStatus, string> = {
  claimed: "Claimed their name",
  unclaimed: "Not claimed yet",
  no_contact: "No way to reach them",
  memorial: "In memoriam",
};

export const ATTENDANCE_LABELS: Record<Attendance, string> = {
  going: "Coming",
  maybe: "Maybe",
  unanswered: "No answer yet",
};

/**
 * Recognizable program names. The database codes are internal and must never
 * reach a reader. Anything not listed falls back to the division's own label.
 */
export const PROGRAM_LABELS: Record<string, string> = {
  MENS_A: "Sabah, men's A",
  MENS_B: "BITT and Pressure, men's B",
  WOMENS_A: "Danger, women's A",
  WOMENS_B: "Danger B, women's B",
};

export function programLabel(code: string, fallback: string) {
  return PROGRAM_LABELS[code] ?? fallback;
}

/**
 * Era bands, newest first. 1978 to 1997 is one anchor band because the early
 * rosters are sparse, and 1998 is when the club's own records begin.
 */
export type Era = { key: string; label: string; from: number; to: number };

export function buildEras(years: number[]): Era[] {
  if (years.length === 0) return [];
  const max = Math.max(...years);
  const bands: Era[] = [{ key: "1978", label: "1978 to 1997", from: 0, to: 1997 }];
  bands.push({ key: "1998", label: "1998 to 2009", from: 1998, to: 2009 });
  for (let from = 2010; from <= max; from += 10) {
    const to = from + 9;
    bands.push({ key: String(from), label: `${from} to ${Math.min(to, max)}`, from, to });
  }
  return bands
    .filter((band) => years.some((y) => y >= band.from && y <= band.to))
    .reverse();
}
