import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { CampaignOutcomeCounts } from "./campaign-guards";
import { dispatchSequence, type DispatchSkips } from "./drip.server";
import { loadCurrentEdition } from "./editions.server";

const RUN_LIMIT = 1000;

/** A sequence is due from its date until two days after it, and never again.
 *  Before this, a past-due sequence was reconsidered every single day, which
 *  turned one invisible ledger row into a daily repeat. */
const DUE_WINDOW_DAYS = 2;

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

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Today in America/New_York, as a plain date. The schedule is a local one. */
export function easternToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}


async function recordAttempt(o: SequenceOutcome & { runDate: string }) {
  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: null,
    action: "drip_cron_tick",
    table_name: "sequences",
    record_id: o.sequenceId,
    before: null as never,
    after: {
      sequenceKey: o.sequenceKey,
      sent: o.sent,
      failed: o.failed,
      skips: o.skips,
      counts: o.counts,
      errors: o.errors,
      refusalReason: o.refusalReason,
      error: o.error,
      targetDate: o.targetDate,
      runDate: o.runDate,
    } as never,
  });
}

/** One daily tick. Nothing happens unless outbound_email_mode reads
 *  "drip_enabled". When it does, every active sequence whose target date has
 *  arrived runs one at a time, each carrying a permission scoped to that one
 *  sequence's kind. The stored setting is only ever read here, never written,
 *  so nothing else can observe a moment of unrestricted sending. */
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
