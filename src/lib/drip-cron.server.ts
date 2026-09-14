import type { CampaignOutcomeCounts } from "./campaign-guards";
import type { DispatchSkips } from "./drip.server";
import { loadCurrentEdition } from "./editions.server";

export type SequenceOutcome = {
  sequenceKey: string;
  sequenceId: string;
  offsetDays: number;
  targetDate: string;
  sent: number;
  failed: number;
  skips: DispatchSkips | null;
  /** Exactly what happened to each recipient on a real run. */
  counts: CampaignOutcomeCounts | null;
  errors: string[];
  refusalReason: string | null;
  error: string | null;
};

export type CronTickResult = {
  ok: boolean;
  reason?: string;
  runDate: string;
  eventDate: string;
  considered: number;
  eligible: number;
  outcomes: SequenceOutcome[];
};

/** Today in America/New_York, as a plain date. The schedule is a local one. */
export function easternToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}


/** Retired. Kept as a named no-op so anything still wired to it fails closed
 *  and says why, rather than finding a dispatcher. */
export async function runDripCronTick(): Promise<CronTickResult> {
  // Retired permanently. There is no rolling drip, no catch-up and no
  // reconsideration of a past-due sequence. The production cron job is off and
  // this function fails closed even if something reaches it: it dispatches
  // nothing, whatever outbound_email_mode says.
  const runDate = easternToday();
  let eventDate = runDate;
  try {
    eventDate = (await loadCurrentEdition()).starts_on;
  } catch {
    /* the answer is "no sends" either way */
  }
  return {
    ok: false,
    reason:
      "the daily drip is retired; only an approved dated one-time campaign or a person-initiated sign-in link may send",
    runDate,
    eventDate,
    considered: 0,
    eligible: 0,
    outcomes: [],
  };
}
