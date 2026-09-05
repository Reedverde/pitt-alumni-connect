import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { dispatchSequence, type DispatchSkips } from "./drip.server";
import { loadCurrentEdition } from "./editions.server";

const RUN_LIMIT = 1000;

export type SequenceOutcome = {
  sequenceKey: string;
  sequenceId: string;
  offsetDays: number;
  targetDate: string;
  sent: number;
  failed: number;
  skips: DispatchSkips | null;
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

/** The arming switch. The drip runs only while this reads exactly
 *  "drip_enabled", a value only a human sets. Anything else, including an
 *  unreadable row, means no sends at all. */
const ARMED_MODE = "drip_enabled";

async function readOutboundMode(): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "outbound_email_mode")
    .maybeSingle();
  const value = (data as { value?: string } | null)?.value;
  return typeof value === "string" ? value : null;
}

async function setOutboundMode(mode: string) {
  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "outbound_email_mode", value: mode } as never, { onConflict: "key" });
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
      refusalReason: o.refusalReason,
      error: o.error,
      targetDate: o.targetDate,
      runDate: o.runDate,
    } as never,
  });
}

/** One daily tick. Nothing happens unless outbound_email_mode reads
 *  "drip_enabled". When it does, every active sequence whose target date has
 *  arrived runs one at a time, with the send choke point opened only for the
 *  length of that single dispatch and forced back to the armed value after. */
export async function runDripCronTick(): Promise<CronTickResult> {
  const runDate = easternToday();
  const edition = await loadCurrentEdition();
  const eventDate = edition.starts_on;

  const mode = await readOutboundMode();
  if (mode !== ARMED_MODE) {
    return {
      ok: false,
      reason: `outbound_email_mode is "${mode ?? "unset"}", not "${ARMED_MODE}"; no sends`,
      runDate,
      eventDate,
      considered: 0,
      eligible: 0,
      outcomes: [],
    };
  }

  const { data: rows } = await supabaseAdmin
    .from("sequences")
    .select("id, key, offset_days, active")
    .eq("active", true)
    // One-time campaigns belong to their own scheduler and its approved moment.
    .eq("one_time", false)
    .order("offset_days", { ascending: true });

  const sequences = (rows ?? []) as { id: string; key: string; offset_days: number }[];
  const outcomes: SequenceOutcome[] = [];

  try {
    for (const seq of sequences) {
      const targetDate = addDays(eventDate, seq.offset_days);
      if (runDate < targetDate) continue;

      const outcome: SequenceOutcome = {
        sequenceKey: seq.key,
        sequenceId: seq.id,
        offsetDays: seq.offset_days,
        targetDate,
        sent: 0,
        failed: 0,
        skips: null,
        refusalReason: null,
        error: null,
      };

      try {
        await setOutboundMode("all");
        const result = await dispatchSequence({
          sequenceKey: seq.key,
          limit: RUN_LIMIT,
          anchorsFirst: false,
          dryRun: false,
        });
        outcome.sent = result.sent;
        outcome.failed = result.failed;
        outcome.skips = result.skips;
        outcome.refusalReason = result.ok ? null : result.reason;
      } catch (err) {
        outcome.error = err instanceof Error ? err.message : String(err);
      } finally {
        await setOutboundMode(ARMED_MODE);
      }

      outcomes.push(outcome);
      try {
        await recordAttempt({ ...outcome, runDate });
      } catch (err) {
        console.error("[drip-cron] audit write failed", err);
      }
    }
  } finally {
    await setOutboundMode(ARMED_MODE);
  }


  return {
    ok: true,
    runDate,
    eventDate,
    considered: sequences.length,
    eligible: outcomes.length,
    outcomes,
  };
}
