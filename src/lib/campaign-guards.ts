/**
 * The rules that stop a campaign reaching the same person twice.
 *
 * September 2026 incident: the dispatcher read the whole sends table with one
 * unpaginated select. Past a thousand rows that read is silently short, so a
 * recorded send stopped being visible and the daily job mailed the person
 * again. The provider was called before the ledger row existed, so the unique
 * constraint rejected the duplicate row afterwards and the second copy left no
 * trace.
 *
 * Two rules follow from that, and they live here so they can be reasoned about
 * and tested without a database:
 *
 *   1. Nothing reads an unbounded table. Every history read is either targeted
 *      or fully paginated, and a failed read throws instead of returning a
 *      short answer that looks complete.
 *   2. A recipient is claimed in the database before the provider is called.
 *      A claim that does not succeed means no provider call at all.
 */

/** Hard ceiling: seven automated campaign emails per person per edition. */
export const CAMPAIGN_CAP_PER_EDITION = 7;

/** The quiet period between any two campaign emails to one person. */
export const CAMPAIGN_COOLDOWN_DAYS = 10;

/** Messages a person asked for. They are never campaigns and never count
 *  against the cap, however many of them go out. */
export const TRANSACTIONAL_SEND_KINDS = new Set(["magic_link", "rsvp_confirmation"]);

export type ClaimOutcome =
  | "claimed"
  | "already_sent"
  | "cooldown"
  | "over_cap"
  | "duplicate_mailbox"
  | "invalid";

export type CampaignOutcomeCounts = {
  /** Reserved in the database and handed to the provider. */
  claimed: number;
  /** Provider accepted it and the ledger row records that. */
  sent: number;
  /** The claim failed, so the provider was never called. */
  failed_before_provider: number;
  /** Claimed, called, and the provider refused. Never retried automatically. */
  provider_failed: number;
  /** Delivered but the ledger could not be updated. Never reported as sent. */
  log_failed: number;
  already_sent: number;
  cooldown: number;
  over_cap: number;
  duplicate_mailbox: number;
  no_body: number;
  over_limit: number;
};

export function emptyOutcomeCounts(): CampaignOutcomeCounts {
  return {
    claimed: 0,
    sent: 0,
    failed_before_provider: 0,
    provider_failed: 0,
    log_failed: 0,
    already_sent: 0,
    cooldown: 0,
    over_cap: 0,
    duplicate_mailbox: 0,
    no_body: 0,
    over_limit: 0,
  };
}

/** A campaign send is one tied to a sequence. Anything a person asked for is
 *  not, whatever else it looks like. */
export function countsAgainstCampaignCap(row: {
  kind?: string | null;
  sequence_id?: string | null;
  outcome?: string | null;
}): boolean {
  if (!row.sequence_id) return false;
  if (row.kind && TRANSACTIONAL_SEND_KINDS.has(row.kind)) return false;
  return row.outcome === "sent" || row.outcome === "claimed";
}

export type PageResult<T> = { data: T[] | null; error: { message: string } | null };

/**
 * Reads every row of a query, one page at a time.
 *
 * The default page size matches PostgREST's own ceiling, which is exactly what
 * made the incident invisible. A read error throws: a short list here would be
 * read as "this person has never been emailed".
 */
export async function fetchAllRows<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
  pageSize = 1000,
  maxRows = 500_000,
): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; from < maxRows; from += pageSize) {
    const { data, error } = await page(from, from + pageSize - 1);
    if (error) throw new Error(`paginated read failed at offset ${from}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < pageSize) return out;
  }
  throw new Error(`paginated read exceeded ${maxRows} rows`);
}

/** What the database claim would answer, computed from already-loaded state.
 *  Used for previews only; the database remains the authority when sending. */
export type ClaimState = {
  /** People already claimed or sent for this one sequence. */
  claimedPersons: Set<string>;
  /** Mailboxes already claimed or sent for this one sequence. */
  claimedMailboxes: Set<string>;
  /** person id -> campaign sends this edition. */
  campaignSends: Map<string, number>;
  /** person id -> epoch ms of their most recent campaign send. */
  lastCampaignAt: Map<string, number>;
};

export function emptyClaimState(): ClaimState {
  return {
    claimedPersons: new Set(),
    claimedMailboxes: new Set(),
    campaignSends: new Map(),
    lastCampaignAt: new Map(),
  };
}

export function previewClaim(
  recipient: { personId: string; email: string },
  state: ClaimState,
  opts: { cap?: number; cooldownDays?: number; skipCooldown?: boolean; now?: number } = {},
): ClaimOutcome {
  const cap = opts.cap ?? CAMPAIGN_CAP_PER_EDITION;
  const cooldownDays = opts.cooldownDays ?? CAMPAIGN_COOLDOWN_DAYS;
  const now = opts.now ?? Date.now();
  const address = recipient.email.trim().toLowerCase();
  if (!recipient.personId || !address) return "invalid";
  if (state.claimedPersons.has(recipient.personId)) return "already_sent";
  if ((state.campaignSends.get(recipient.personId) ?? 0) >= cap) return "over_cap";
  if (!opts.skipCooldown) {
    const last = state.lastCampaignAt.get(recipient.personId);
    if (last !== undefined && now - last < cooldownDays * 86400000) return "cooldown";
  }
  if (state.claimedMailboxes.has(address)) return "duplicate_mailbox";
  return "claimed";
}

/** Applies a successful preview claim so the next recipient in the same run
 *  sees it. Mirrors what the database row does for real runs. */
export function recordPreviewClaim(
  recipient: { personId: string; email: string },
  state: ClaimState,
  now = Date.now(),
) {
  state.claimedPersons.add(recipient.personId);
  state.claimedMailboxes.add(recipient.email.trim().toLowerCase());
  state.campaignSends.set(recipient.personId, (state.campaignSends.get(recipient.personId) ?? 0) + 1);
  state.lastCampaignAt.set(recipient.personId, now);
}

export type QueueItem = { personId: string; email: string };

/**
 * Claim, then send. Never the other way round.
 *
 * A claim that throws or refuses ends that recipient's turn before the
 * provider is involved, and the counters say exactly which of those happened.
 */
export async function runClaimedQueue<T extends QueueItem>(opts: {
  queue: T[];
  limit?: number;
  claim: (item: T) => Promise<{ outcome: ClaimOutcome; sendId: string | null }>;
  deliver: (
    item: T,
    sendId: string,
  ) => Promise<{ sent: boolean; reason: string | null; logged?: boolean }>;
  pauseMs?: number;
  sleep?: (ms: number) => Promise<void>;
}): Promise<{ counts: CampaignOutcomeCounts; sentPeople: string[]; errors: string[] }> {
  const counts = emptyOutcomeCounts();
  const sentPeople: string[] = [];
  const errors: string[] = [];
  const limit = opts.limit ?? Number.MAX_SAFE_INTEGER;
  const sleep = opts.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));

  for (const item of opts.queue) {
    if (counts.claimed >= limit) {
      counts.over_limit++;
      continue;
    }

    let claim: { outcome: ClaimOutcome; sendId: string | null };
    try {
      claim = await opts.claim(item);
    } catch (err) {
      counts.failed_before_provider++;
      errors.push(`claim failed for ${item.personId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (claim.outcome !== "claimed" || !claim.sendId) {
      if (claim.outcome === "already_sent") counts.already_sent++;
      else if (claim.outcome === "cooldown") counts.cooldown++;
      else if (claim.outcome === "over_cap") counts.over_cap++;
      else if (claim.outcome === "duplicate_mailbox") counts.duplicate_mailbox++;
      else counts.failed_before_provider++;
      continue;
    }

    counts.claimed++;

    let result: { sent: boolean; reason: string | null; logged?: boolean };
    try {
      result = await opts.deliver(item, claim.sendId);
    } catch (err) {
      counts.provider_failed++;
      errors.push(`send failed for ${item.personId}: ${err instanceof Error ? err.message : String(err)}`);
      continue;
    }

    if (result.sent && result.logged === false) {
      counts.log_failed++;
      errors.push(`ledger write failed after delivery for ${item.personId}`);
    } else if (result.sent) {
      counts.sent++;
      sentPeople.push(item.personId);
    } else {
      counts.provider_failed++;
      if (result.reason) errors.push(`${item.personId}: ${result.reason}`);
    }

    if (opts.pauseMs) await sleep(opts.pauseMs);
  }

  return { counts, sentPeople, errors };
}
