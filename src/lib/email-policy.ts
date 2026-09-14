/**
 * The permanent email rule, in one pure place.
 *
 * There is no rolling drip, no automatic catch-up and no reconsideration of a
 * past-due sequence. Exactly two things may leave the building:
 *
 *   1. an explicitly dated, one-time campaign approved in `sequences`, sent in
 *      its approved minute and never afterwards;
 *   2. an access email a person asked for themselves (the sign-in link).
 *
 * Everything else — the daily drip, the automatic RSVP confirmation — is
 * retired. `outbound_email_mode` stays `transactional_only` permanently.
 */

import { launchVerdict, type LaunchVerdict } from "./launch-window";

/** The daily drip is retired. The hook stays mounted so an accidental call is
 *  answered and recorded, but it can never dispatch. */
export const DAILY_DRIP_RETIRED = true;

/** Permanent outbound mode. Nothing in the product asks a human to change it. */
export const PERMANENT_OUTBOUND_MODE = "transactional_only";

/** Person-initiated access email. This is the only kind allowed outside an
 *  approved dated campaign. */
export const PERSON_INITIATED_KINDS = new Set(["magic_link"]);

/** Automatic acknowledgements are retired; an RSVP never triggers email. */
export const AUTOMATIC_RSVP_CONFIRMATION_RETIRED = true;

export function dailyDripMaySend(): false {
  return false;
}

export function automaticRsvpConfirmationMaySend(): false {
  return false;
}

/** True only for an email the person themselves asked for. */
export function personInitiatedMaySend(kind: string): boolean {
  return PERSON_INITIATED_KINDS.has(kind);
}

export type ScheduledCampaignShape = {
  key: string;
  scheduled_at: string | null;
  dispatched_at?: string | null;
  cancelled_at?: string | null;
  missed_at?: string | null;
};

export type CampaignVerdict = "send" | "wait" | "missed" | "closed";

/** A dated campaign sends in its approved minute alone. A moment that passed
 *  unsent is `missed` and is never caught up. */
export function campaignVerdict(
  row: ScheduledCampaignShape,
  now: Date | string | number,
): CampaignVerdict {
  if (row.dispatched_at || row.cancelled_at || row.missed_at || !row.scheduled_at) return "closed";
  const verdict: LaunchVerdict = launchVerdict(now, row.scheduled_at);
  if (verdict === "early") return "wait";
  if (verdict === "due") return "send";
  return "missed";
}

/** The remaining approved 2026 campaigns, for organizer-facing display. Seven
 *  per edition is the maximum; t_minus_45 and t_minus_21 are already done. */
export const REMAINING_2026_CAMPAIGNS: { key: string; label: string; easternDate: string }[] = [
  { key: "t_minus_14", label: "Two weeks out", easternDate: "2026-09-18" },
  { key: "event_rsvp_prompt_t10_2026_09_22", label: "Event answers", easternDate: "2026-09-22" },
  { key: "t_minus_7", label: "One week out", easternDate: "2026-09-25" },
  { key: "locked_schedule_2026_09_30", label: "Locked schedule", easternDate: "2026-09-30" },
  { key: "t_plus_3", label: "Thank you", easternDate: "2026-10-05" },
];

export const COMPLETED_2026_CAMPAIGNS = ["t_minus_45", "t_minus_21"];
