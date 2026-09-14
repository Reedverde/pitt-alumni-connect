import { describe, expect, it, vi } from "vitest";

/**
 * The September 2026 duplicate-send incident, written down as tests.
 *
 * None of this touches a database: the rules are pure so they can be argued
 * with on their own, which is exactly what the original whole-table read made
 * impossible.
 */

import {
  CAMPAIGN_CAP_PER_EDITION,
  countsAgainstCampaignCap,
  emptyClaimState,
  fetchAllRows,
  previewClaim,
  recordPreviewClaim,
  runClaimedQueue,
  type ClaimOutcome,
} from "../campaign-guards";

function pagedSource<T>(rows: T[], pageSize = 1000) {
  return (from: number, to: number) =>
    Promise.resolve({ data: rows.slice(from, to + 1), error: null });
}

describe("reading send history", () => {
  it("sees the row past one thousand that the incident hid", async () => {
    const rows = Array.from({ length: 1023 }, (_, i) => ({ person_id: `p${i}` }));
    rows[1017] = { person_id: "david-vatz" };

    // The old behaviour: one page, silently short.
    const onePage = (await pagedSource(rows)(0, 999)).data;
    expect(onePage.some((r) => r.person_id === "david-vatz")).toBe(false);

    const all = await fetchAllRows(pagedSource(rows));
    expect(all).toHaveLength(1023);
    expect(all.some((r) => r.person_id === "david-vatz")).toBe(true);
  });

  it("throws rather than returning a short list when a page fails", async () => {
    await expect(
      fetchAllRows(() => Promise.resolve({ data: null, error: { message: "timeout" } })),
    ).rejects.toThrow(/paginated read failed/);
  });
});

describe("who may be claimed", () => {
  it("refuses a person this campaign already reached", () => {
    const state = emptyClaimState();
    state.claimedPersons.add("p1");
    expect(previewClaim({ personId: "p1", email: "a@x.test" }, state)).toBe("already_sent");
  });

  it("refuses a mailbox this campaign already wrote to", () => {
    const state = emptyClaimState();
    state.claimedMailboxes.add("shared@x.test");
    expect(previewClaim({ personId: "p2", email: " Shared@X.test " }, state)).toBe(
      "duplicate_mailbox",
    );
  });

  it("holds the ten day quiet period", () => {
    const now = Date.parse("2026-09-20T12:00:00Z");
    const state = emptyClaimState();
    state.lastCampaignAt.set("p3", now - 3 * 86400000);
    expect(previewClaim({ personId: "p3", email: "a@x.test" }, state, { now })).toBe("cooldown");
    state.lastCampaignAt.set("p3", now - 11 * 86400000);
    expect(previewClaim({ personId: "p3", email: "a@x.test" }, state, { now })).toBe("claimed");
  });

  it("stops at seven campaign emails in an edition", () => {
    const state = emptyClaimState();
    state.campaignSends.set("p4", CAMPAIGN_CAP_PER_EDITION - 1);
    expect(
      previewClaim({ personId: "p4", email: "a@x.test" }, state, { skipCooldown: true }),
    ).toBe("claimed");
    state.campaignSends.set("p4", CAMPAIGN_CAP_PER_EDITION);
    expect(
      previewClaim({ personId: "p4", email: "a@x.test" }, state, { skipCooldown: true }),
    ).toBe("over_cap");
  });

  it("does not count sign-in links or RSVP confirmations against the cap", () => {
    expect(countsAgainstCampaignCap({ kind: "magic_link", sequence_id: null, outcome: "sent" })).toBe(
      false,
    );
    expect(
      countsAgainstCampaignCap({ kind: "rsvp_confirmation", sequence_id: "s1", outcome: "sent" }),
    ).toBe(false);
    expect(countsAgainstCampaignCap({ kind: "drip:t_minus_21", sequence_id: "s1", outcome: "sent" })).toBe(
      true,
    );
    expect(
      countsAgainstCampaignCap({ kind: "drip:t_minus_21", sequence_id: "s1", outcome: "claimed" }),
    ).toBe(true);
  });

  it("a claim inside one run blocks the next record sharing that mailbox", () => {
    const state = emptyClaimState();
    const first = { personId: "p5", email: "couple@x.test" };
    expect(previewClaim(first, state, { skipCooldown: true })).toBe("claimed");
    recordPreviewClaim(first, state);
    expect(
      previewClaim({ personId: "p6", email: "couple@x.test" }, state, { skipCooldown: true }),
    ).toBe("duplicate_mailbox");
  });
});

/** A database-shaped claim: one person per sequence, first caller wins. */
function claimStore() {
  const taken = new Set<string>();
  let n = 0;
  return async (item: { personId: string }): Promise<{ outcome: ClaimOutcome; sendId: string | null }> => {
    if (taken.has(item.personId)) return { outcome: "already_sent", sendId: null };
    taken.add(item.personId);
    return { outcome: "claimed", sendId: `send-${++n}` };
  };
}

describe("claim before send", () => {
  const queue = [
    { personId: "p1", email: "a@x.test" },
    { personId: "p2", email: "b@x.test" },
  ];
  const noSleep = () => Promise.resolve();

  it("never calls the provider when the claim fails", async () => {
    const deliver = vi.fn();
    const run = await runClaimedQueue({
      queue,
      claim: async () => {
        throw new Error("ledger unreachable");
      },
      deliver,
      sleep: noSleep,
    });
    expect(deliver).not.toHaveBeenCalled();
    expect(run.counts.failed_before_provider).toBe(2);
    expect(run.counts.sent).toBe(0);
  });

  it("two overlapping ticks send one copy each person", async () => {
    const claim = claimStore();
    const deliver = vi.fn(async () => ({ sent: true, reason: null, logged: true }));
    const first = await runClaimedQueue({ queue, claim, deliver, sleep: noSleep });
    const second = await runClaimedQueue({ queue, claim, deliver, sleep: noSleep });
    expect(first.counts.sent).toBe(2);
    expect(second.counts.sent).toBe(0);
    expect(second.counts.already_sent).toBe(2);
    expect(deliver).toHaveBeenCalledTimes(2);
  });

  it("reports a provider refusal without retrying it", async () => {
    const deliver = vi.fn(async () => ({ sent: false, reason: "rate limited", logged: true }));
    const run = await runClaimedQueue({ queue, claim: claimStore(), deliver, sleep: noSleep });
    expect(run.counts.provider_failed).toBe(2);
    expect(run.counts.sent).toBe(0);
    expect(deliver).toHaveBeenCalledTimes(2);
    expect(run.errors).toHaveLength(2);
  });

  it("never reports a send whose ledger row could not be written", async () => {
    const run = await runClaimedQueue({
      queue,
      claim: claimStore(),
      deliver: async () => ({ sent: true, reason: null, logged: false }),
      sleep: noSleep,
    });
    expect(run.counts.sent).toBe(0);
    expect(run.counts.log_failed).toBe(2);
    expect(run.sentPeople).toEqual([]);
  });

  it("honours a run limit and counts what it left alone", async () => {
    const run = await runClaimedQueue({
      queue,
      limit: 1,
      claim: claimStore(),
      deliver: async () => ({ sent: true, reason: null, logged: true }),
      sleep: noSleep,
    });
    expect(run.counts.sent).toBe(1);
    expect(run.counts.over_limit).toBe(1);
  });

  it("passes every database refusal through to its own counter", async () => {
    const refusals: ClaimOutcome[] = ["cooldown", "over_cap", "duplicate_mailbox"];
    let i = 0;
    const run = await runClaimedQueue({
      queue: refusals.map((_, n) => ({ personId: `p${n}`, email: `p${n}@x.test` })),
      claim: async () => ({ outcome: refusals[i++]!, sendId: null }),
      deliver: async () => ({ sent: true, reason: null, logged: true }),
      sleep: noSleep,
    });
    expect(run.counts).toMatchObject({
      cooldown: 1,
      over_cap: 1,
      duplicate_mailbox: 1,
      claimed: 0,
      sent: 0,
    });
  });
});

/**
 * A model of `claim_campaign_send` as the database now runs it: every claim
 * for one person within one edition takes the same advisory transaction lock
 * before it counts rows, so two different sequences cannot both read six and
 * both insert. `lock` off reproduces the reviewed hole.
 */
function makeDbClaim(opts: { existing: number; cap?: number; lock: boolean }) {
  const cap = opts.cap ?? CAMPAIGN_CAP_PER_EDITION;
  const rows: { personId: string; sequenceId: string }[] = Array.from(
    { length: opts.existing },
    (_, i) => ({ personId: "p1", sequenceId: `old-${i}` }),
  );
  const held = new Set<string>();
  const waiters: (() => void)[] = [];

  async function withLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    if (!opts.lock) return fn();
    while (held.has(key)) await new Promise<void>((r) => waiters.push(r));
    held.add(key);
    try {
      return await fn();
    } finally {
      held.delete(key);
      waiters.shift()?.();
    }
  }

  return {
    rows,
    claim: (personId: string, sequenceId: string, eventYear: number) =>
      withLock(`${personId}:${eventYear}`, async () => {
        // the yield a real transaction gets between statements
        await new Promise<void>((r) => setTimeout(r, 0));
        if (rows.some((r) => r.personId === personId && r.sequenceId === sequenceId)) {
          return "already_sent" as const;
        }
        const used = rows.filter((r) => r.personId === personId).length;
        await new Promise<void>((r) => setTimeout(r, 0));
        if (used >= cap) return "over_cap" as const;
        rows.push({ personId, sequenceId });
        return "claimed" as const;
      }),
  };
}

describe("the per person and edition claim lock", () => {
  it("lets at most one of two racing sequences take the seventh slot", async () => {
    const db = makeDbClaim({ existing: CAMPAIGN_CAP_PER_EDITION - 1, lock: true });
    const results = await Promise.all([
      db.claim("p1", "seq-a", 2026),
      db.claim("p1", "seq-b", 2026),
    ]);
    expect(results.filter((r) => r === "claimed")).toHaveLength(1);
    expect(results.filter((r) => r === "over_cap")).toHaveLength(1);
    expect(db.rows.filter((r) => r.personId === "p1")).toHaveLength(CAMPAIGN_CAP_PER_EDITION);
  });

  it("holds the cap when several sequences pile on at once", async () => {
    const db = makeDbClaim({ existing: CAMPAIGN_CAP_PER_EDITION - 1, lock: true });
    const outcomes = await Promise.all(
      ["a", "b", "c", "d"].map((s) => db.claim("p1", `seq-${s}`, 2026)),
    );
    expect(outcomes.filter((o) => o === "claimed")).toHaveLength(1);
    expect(db.rows.filter((r) => r.personId === "p1").length).toBeLessThanOrEqual(
      CAMPAIGN_CAP_PER_EDITION,
    );
  });

  it("without the lock the same race overshoots, which is the bug being fixed", async () => {
    const db = makeDbClaim({ existing: CAMPAIGN_CAP_PER_EDITION - 1, lock: false });
    await Promise.all([db.claim("p1", "seq-a", 2026), db.claim("p1", "seq-b", 2026)]);
    expect(db.rows.filter((r) => r.personId === "p1").length).toBe(CAMPAIGN_CAP_PER_EDITION + 1);
  });
});
