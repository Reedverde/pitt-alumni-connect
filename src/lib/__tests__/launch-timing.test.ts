import { describe, expect, it } from "vitest";

import { launchVerdict, localHHMM } from "../launch-window";
import { windowVerdict } from "../news.server";

/**
 * The one rule, from both ends: the bulletin's local wall clock and the
 * campaign's exact instant. 9:00 means 9:00.
 */

describe("news bulletin launch minute", () => {
  it("is early at 08:59", () => {
    expect(windowVerdict("08:59", "09:00")).toBe("early");
  });

  it("is due at 09:00", () => {
    expect(windowVerdict("09:00", "09:00")).toBe("due");
  });

  it("is missed at 09:01", () => {
    expect(windowVerdict("09:01", "09:00")).toBe("missed");
  });

  it("is missed at 09:15 and 09:30 — no forty-five minute window", () => {
    expect(windowVerdict("09:15", "09:00")).toBe("missed");
    expect(windowVerdict("09:30", "09:00")).toBe("missed");
  });

  it("is missed at 10:00", () => {
    expect(windowVerdict("10:00", "09:00")).toBe("missed");
  });
});

describe("daylight saving: the cron fires at 13:00 and 14:00 UTC", () => {
  const TZ = "America/New_York";

  it("during daylight time, 13:00 UTC is nine o'clock and 14:00 UTC is not", () => {
    // 2026-09-30 is EDT (UTC-4).
    expect(localHHMM(TZ, new Date("2026-09-30T13:00:00Z"))).toBe("09:00");
    expect(localHHMM(TZ, new Date("2026-09-30T14:00:00Z"))).toBe("10:00");
    expect(windowVerdict(localHHMM(TZ, new Date("2026-09-30T13:00:00Z")), "09:00")).toBe("due");
    expect(windowVerdict(localHHMM(TZ, new Date("2026-09-30T14:00:00Z")), "09:00")).toBe("missed");
  });

  it("during standard time, 14:00 UTC is nine o'clock and 13:00 UTC is early", () => {
    // 2026-12-15 is EST (UTC-5).
    expect(localHHMM(TZ, new Date("2026-12-15T14:00:00Z"))).toBe("09:00");
    expect(localHHMM(TZ, new Date("2026-12-15T13:00:00Z"))).toBe("08:00");
    expect(windowVerdict(localHHMM(TZ, new Date("2026-12-15T14:00:00Z")), "09:00")).toBe("due");
    expect(windowVerdict(localHHMM(TZ, new Date("2026-12-15T13:00:00Z")), "09:00")).toBe("early");
  });

  it("holds across both spring and autumn changeovers", () => {
    // Spring forward 2026-03-08, autumn back 2026-11-01.
    expect(localHHMM(TZ, new Date("2026-03-07T14:00:00Z"))).toBe("09:00"); // EST
    expect(localHHMM(TZ, new Date("2026-03-09T13:00:00Z"))).toBe("09:00"); // EDT
    expect(localHHMM(TZ, new Date("2026-10-31T13:00:00Z"))).toBe("09:00"); // EDT
    expect(localHHMM(TZ, new Date("2026-11-02T14:00:00Z"))).toBe("09:00"); // EST
  });
});

describe("scheduled campaign launch minute", () => {
  const at = "2026-09-30T13:00:00Z"; // 9:00 AM Eastern

  it("is early one minute before", () => {
    expect(launchVerdict("2026-09-30T12:59:00Z", at)).toBe("early");
  });

  it("is due on the second, and still due late in the same minute", () => {
    expect(launchVerdict("2026-09-30T13:00:00Z", at)).toBe("due");
    expect(launchVerdict("2026-09-30T13:00:41Z", at)).toBe("due");
    expect(launchVerdict("2026-09-30T13:00:59.900Z", at)).toBe("due");
  });

  it("is missed one minute later", () => {
    expect(launchVerdict("2026-09-30T13:01:00Z", at)).toBe("missed");
  });

  it("is missed at 9:15, 9:30 and 10:00 — no ninety minute grace", () => {
    expect(launchVerdict("2026-09-30T13:15:00Z", at)).toBe("missed");
    expect(launchVerdict("2026-09-30T13:30:00Z", at)).toBe("missed");
    expect(launchVerdict("2026-09-30T14:00:00Z", at)).toBe("missed");
  });

  it("treats an unreadable moment as not yet due, never as due", () => {
    expect(launchVerdict("2026-09-30T13:00:00Z", "")).toBe("early");
  });
});
