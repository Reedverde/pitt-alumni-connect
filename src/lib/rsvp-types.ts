export const EVENT_YEAR = 2026;

export const RSVP_STATUSES = ["going", "maybe", "not_this_year"] as const;
export type RsvpStatus = (typeof RSVP_STATUSES)[number];

export const RSVP_SOURCES = ["discord", "groupme", "email"] as const;
export type RsvpSource = (typeof RSVP_SOURCES)[number];

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