/** Types for the claim flow. Claiming a permanent profile and answering the
 *  annual RSVP are two separate acts: nothing here writes an RSVP row, and no
 *  shape in this file carries an attendance answer. */

/** Everything the claim flow may show back to the person. Never an email. */
export type ClaimPerson = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  board_year: number | null;
  team_label: string | null;
  years_label: string | null;
  grad_year: number | null;
  division: string | null;
  division_label: string | null;
};

export type ClaimResult = {
  ok: boolean;
  /** "claimed" means the address is on the record and a sign in link went out.
   *  "sign_in_required" means the record belongs to a verified account and the
   *  address typed here is not on it, so nothing was written. */
  outcome: "claimed" | "sign_in_required";
  person: ClaimPerson | null;
};

/** What the person tells us when their name is not on the board yet. Every
 *  historical field is optional because "Not sure" is a real answer. */
export type MissingPersonInput = {
  firstName: string;
  lastName: string;
  playedAs?: string | null;
  /** A division code, or null when they picked Not sure. */
  division?: string | null;
  startYear?: number | null;
  endYear?: number | null;
  /** True when they could not place their playing years at all. */
  yearsUnsure?: boolean;
  gradYear?: number | null;
  email: string;
  note?: string | null;
  src?: string | null;
  origin?: string | null;
};

export type MissingPersonResult = {
  ok: boolean;
  outcome: "review_requested";
};

/** A correction to the roster facts we show back during a claim. Filed for the
 *  organizers, never applied straight to the record. */
export type RosterCorrectionInput = {
  personId: string;
  gradYear?: number | null;
  playedAs?: string | null;
  division?: string | null;
  note?: string | null;
  /** Which surface it came from: the claim flow, or the person's own page. */
  source?: string | null;
};

export type DivisionOption = { code: string; label: string };
