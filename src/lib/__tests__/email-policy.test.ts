import { describe, expect, it } from "vitest";

/**
 * Reed's permanent rule, written down as tests: no rolling drip, no catch-up,
 * no automatic acknowledgement. Only an approved dated campaign in its own
 * minute, and an access link a person asked for.
 */

import {
  AUTOMATIC_RSVP_CONFIRMATION_RETIRED,
  COMPLETED_2026_CAMPAIGNS,
  DAILY_DRIP_RETIRED,
  PERMANENT_OUTBOUND_MODE,
  REMAINING_2026_CAMPAIGNS,
  automaticRsvpConfirmationMaySend,
  campaignVerdict,
  dailyDripMaySend,
  personInitiatedMaySend,
} from "../email-policy";
import { CAMPAIGN_CAP_PER_EDITION } from "../campaign-guards";

describe("what may send at all", () => {
  it("the daily endpoint can never send", () => {
    expect(DAILY_DRIP_RETIRED).toBe(true);
    expect(dailyDripMaySend()).toBe(false);
  });

  it("an RSVP never triggers a confirmation", () => {
    expect(AUTOMATIC_RSVP_CONFIRMATION_RETIRED).toBe(true);
    expect(automaticRsvpConfirmationMaySend()).toBe(false);
    expect(personInitiatedMaySend("rsvp_confirmation")).toBe(false);
  });

  it("a person asking for a sign-in link still gets one", () => {
    expect(personInitiatedMaySend("magic_link")).toBe(true);
  });

  it("nothing asks anyone to turn a daily send back on", () => {
    expect(PERMANENT_OUTBOUND_MODE).toBe("transactional_only");
  });
});

describe("dated one-time campaigns", () => {
  const row = { key: "t_minus_14", scheduled_at: "2026-09-18T13:00:00Z" };

  it("sends only inside its approved minute", () => {
    expect(campaignVerdict(row, "2026-09-18T12:59:59Z")).toBe("wait");
    expect(campaignVerdict(row, "2026-09-18T13:00:00Z")).toBe("send");
    expect(campaignVerdict(row, "2026-09-18T13:00:45Z")).toBe("send");
  });

  it("never catches up on a minute it missed", () => {
    expect(campaignVerdict(row, "2026-09-18T13:01:30Z")).toBe("missed");
    expect(campaignVerdict(row, "2026-09-19T13:00:00Z")).toBe("missed");
    expect(campaignVerdict({ ...row, missed_at: "2026-09-18T13:05:00Z" }, "2026-09-18T13:00:10Z")).toBe(
      "closed",
    );
  });

  it("does not reconsider a campaign already sent or cancelled", () => {
    expect(campaignVerdict({ ...row, dispatched_at: "2026-09-18T13:00:02Z" }, "2026-09-18T13:00:20Z")).toBe(
      "closed",
    );
    expect(campaignVerdict({ ...row, cancelled_at: "2026-09-17T10:00:00Z" }, "2026-09-18T13:00:00Z")).toBe(
      "closed",
    );
    expect(campaignVerdict({ ...row, scheduled_at: null }, "2026-09-18T13:00:00Z")).toBe("closed");
  });

  it("keeps the remaining plan within the seven per edition maximum", () => {
    expect(COMPLETED_2026_CAMPAIGNS).toEqual(["t_minus_45", "t_minus_21"]);
    expect(REMAINING_2026_CAMPAIGNS.map((c) => c.easternDate)).toEqual([
      "2026-09-18",
      "2026-09-22",
      "2026-09-25",
      "2026-09-30",
      "2026-10-05",
    ]);
    expect(COMPLETED_2026_CAMPAIGNS.length + REMAINING_2026_CAMPAIGNS.length).toBe(
      CAMPAIGN_CAP_PER_EDITION,
    );
  });
});
