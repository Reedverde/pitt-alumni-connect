export const RSVP_STATUSES = ["going", "maybe", "not_this_year"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export { RSVP_SOURCES, normalizeRsvpSource } from "./rsvp-src";
export type { RsvpSource } from "./rsvp-src";

/** Heads, including the person themselves. Meaningful only for "going". */
export const PARTY_SIZE_MIN = 1;
export const PARTY_SIZE_MAX = 12;

/** Clamps to the range the database check constraint enforces. Anything other
 *  than "going" carries the default of 1 and is never displayed. */
export function normalizePartySize(status: RsvpStatus | null, raw: unknown): number {
  if (status !== "going") return PARTY_SIZE_MIN;
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return PARTY_SIZE_MIN;
  return Math.min(PARTY_SIZE_MAX, Math.max(PARTY_SIZE_MIN, n));
}

/** Only ever the fields the public board already shows. Never an email. */
export type PersonMatch = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  board_year: number | null;
  team_label: string | null;
  years_label: string | null;
  state: "unclaimed" | "claimed" | "going" | "maybe" | "memorial";
};

export type RsvpResult = {
  ok: boolean;
  /** "recorded" means the answer is saved against a real record. "review_requested"
   *  means the name went to the organizers and no record exists yet. */
  outcome: "recorded" | "review_requested";
  person: {
    first_name: string;
    last_name: string | null;
    board_year: number | null;
    team_label: string | null;
    state: "unclaimed" | "claimed" | "going" | "maybe" | "memorial";
  } | null;
};

export const STATUS_LABELS: Record<RsvpStatus, string> = {
  going: "Going",
  maybe: "Maybe",
  not_this_year: "Not this year",
};

export function personDisplayName(p: {
  first_name: string;
  last_name?: string | null;
  played_as?: string | null;
}) {
  const base = [p.first_name, p.last_name].filter(Boolean).join(" ");
  return p.played_as ? `${base} "${p.played_as}"` : base;
}