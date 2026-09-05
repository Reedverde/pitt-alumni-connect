import { supabaseAdmin } from "@/integrations/supabase/client.server";

import { dispatchSequence, type DispatchSkips } from "./drip.server";

/** One-time scheduled campaigns.
 *
 *  Deliberately separate from the daily drip tick: this path does not read the
 *  drip arming switch, because the authorization here is the scheduling record
 *  itself. It opens the send choke point for the length of one dispatch and
 *  puts the stored setting back exactly as it found it afterwards, even on a
 *  throw. The live setting is "drip_enabled", which the mail layer treats as
 *  paused for everything but sign-in links; that paused state survives this
 *  campaign untouched.
 *
 *  Idempotency: dispatched_at is stamped before any mail leaves, so a second
 *  tick, a retry, or an overlapping cron run finds nothing to do. The
 *  per-sequence already_sent rule inside the dispatcher is the second guard. */

const SAFE_MODE = "transactional_only";
const RUN_LIMIT = 2000;
/**
 * How late a scheduled send may still go out on its own. The tick runs hourly,
 * so this is one attempt plus a little slack. An approved date is part of the
 * approval: past this the campaign is left unsent for an organizer to decide
 * about, rather than turning up hours after the moment it was written for.
 */
export const MISSED_GRACE_MINUTES = 90;

export type ScheduledRow = {
  id: string;
  key: string;
  scheduled_at: string | null;
  dispatched_at: string | null;
  cancelled_at: string | null;
  active: boolean;
  /** Stamped when the moment passed unsent. A missed campaign stays unsent. */
  missed_at?: string | null;
};

export type ScheduledOutcome = {
  key: string;
  sequenceId: string;
  scheduledAt: string | null;
  sent: number;
  failed: number;
  skips: DispatchSkips | null;
  audience: number;
  error: string | null;
};

export type ScheduledTickResult = {
  ok: boolean;
  ranAt: string;
  due: number;
  outcomes: ScheduledOutcome[];
  /** Campaigns whose approved moment passed unsent. They need an organizer. */
  missed: string[];
};

async function readOutboundMode(): Promise<string> {
  const { data } = await supabaseAdmin
    .from("app_settings")
    .select("value")
    .eq("key", "outbound_email_mode")
    .maybeSingle();
  const value = (data as { value?: string } | null)?.value;
  return typeof value === "string" && value ? value : SAFE_MODE;
}

async function setOutboundMode(mode: string) {
  await supabaseAdmin
    .from("app_settings")
    .upsert({ key: "outbound_email_mode", value: mode } as never, { onConflict: "key" });
}

/** Everything a human needs to see before the moment arrives. */
export async function listScheduledCampaigns(): Promise<ScheduledRow[]> {
  const { data } = await supabaseAdmin
    .from("sequences")
    .select("id, key, scheduled_at, dispatched_at, cancelled_at, active, missed_at")
    .eq("one_time", true)
    .order("scheduled_at", { ascending: true });
  return (data ?? []) as ScheduledRow[];
}

/** The cancel button. Clearing scheduled_at is what actually stops the tick;
 *  cancelled_at is the record of who stopped it and when. */
export async function cancelScheduledCampaign(key: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("sequences")
    .update({ scheduled_at: null, cancelled_at: new Date().toISOString(), active: false } as never)
    .eq("key", key)
    .eq("one_time", true)
    .is("dispatched_at", null)
    .select("id");
  return (data ?? []).length > 0;
}

/** Reads the exact audience a pending one-time campaign would reach right now.
 *  Writes nothing and sends nothing. */
export async function previewScheduledCampaigns() {
  const rows = await listScheduledCampaigns();
  const pending = rows.filter((r) => !r.dispatched_at && !r.cancelled_at && r.scheduled_at);
  const out = [];
  for (const row of pending) {
    const preview = await dispatchSequence({ sequenceKey: row.key, dryRun: true });
    out.push({
      key: row.key,
      scheduledAt: row.scheduled_at,
      audience: preview.audience,
      wouldSend: preview.wouldSend.length,
      skips: preview.skips,
      subject: preview.sample?.subject ?? null,
      sampleHtmlLength: preview.sample?.html.length ?? 0,
      sampleText: preview.sample?.text ?? null,
      reason: preview.reason,
    });
  }
  return { ok: true, dryRun: true, ranAt: new Date().toISOString(), campaigns: out };
}

export async function runScheduledCampaignTick(): Promise<ScheduledTickResult> {
  const ranAt = new Date().toISOString();
  const { data } = await supabaseAdmin
    .from("sequences")
    .select("id, key, scheduled_at, dispatched_at, cancelled_at, missed_at")
    .eq("one_time", true)
    .is("dispatched_at", null)
    .is("cancelled_at", null)
    .is("missed_at", null)
    .not("scheduled_at", "is", null)
    .lte("scheduled_at", ranAt);

  const all = (data ?? []) as ScheduledRow[];

  // A campaign whose moment slipped by more than the grace window is not sent
  // late and quietly: an approved date is part of the approval. It is flagged
  // for an organizer instead.
  const graceMs = MISSED_GRACE_MINUTES * 60_000;
  const due: ScheduledRow[] = [];
  const missed: string[] = [];
  for (const row of all) {
    const at = Date.parse(row.scheduled_at ?? "");
    if (Number.isFinite(at) && Date.parse(ranAt) - at > graceMs) {
      await supabaseAdmin
        .from("sequences")
        .update({ missed_at: ranAt, active: false } as never)
        .eq("id", row.id);
      missed.push(row.key);
      continue;
    }
    due.push(row);
  }

  const outcomes: ScheduledOutcome[] = [];

  for (const row of due) {
    // Claim it first. If another tick already claimed it, this updates nothing.
    const { data: claimed } = await supabaseAdmin
      .from("sequences")
      .update({ dispatched_at: new Date().toISOString(), active: true } as never)
      .eq("id", row.id)
      .is("dispatched_at", null)
      .is("cancelled_at", null)
      .select("id");
    if ((claimed ?? []).length === 0) continue;

    const outcome: ScheduledOutcome = {
      key: row.key,
      sequenceId: row.id,
      scheduledAt: row.scheduled_at,
      sent: 0,
      failed: 0,
      skips: null,
      audience: 0,
      error: null,
    };

    // Whatever the mode was before this campaign is what it goes back to. The
    // daily drip's own arming switch is not ours to turn off.
    const priorMode = await readOutboundMode();

    try {
      await setOutboundMode("all");
      const result = await dispatchSequence({
        sequenceKey: row.key,
        limit: RUN_LIMIT,
        dryRun: false,
        allowOneTime: true,
      });
      outcome.sent = result.sent;
      outcome.failed = result.failed;
      outcome.skips = result.skips;
      outcome.audience = result.audience;
      if (!result.ok) outcome.error = result.reason;
    } catch (err) {
      outcome.error = err instanceof Error ? err.message : String(err);
    } finally {
      await setOutboundMode(priorMode === "all" ? SAFE_MODE : priorMode);
      // A one-time campaign is switched off the instant it has run.
      await supabaseAdmin.from("sequences").update({ active: false } as never).eq("id", row.id);
    }

    outcomes.push(outcome);
    try {
      await supabaseAdmin.from("audit_log").insert({
        actor_person_id: null,
        action: "scheduled_campaign_dispatch",
        table_name: "sequences",
        record_id: row.id,
        before: null as never,
        after: { ...outcome, ranAt } as never,
      });
    } catch (err) {
      console.error("[scheduled-campaign] audit write failed", err);
    }
  }

  return { ok: true, ranAt, due: due.length, outcomes, missed };
}
