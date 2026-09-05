import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The rules that decide whether something is said publicly, and when.
 *
 * Both modules reach for the service-role client at import time, so it is
 * stubbed here: none of these rules touch the database, and the point of the
 * tests is that they can be reasoned about without one.
 */
vi.mock("@/integrations/supabase/client.server", () => ({ supabaseAdmin: {} }));
vi.mock("../site-url", () => ({ SITE_ORIGIN: "https://example.test" }));

const { describeChange, materialDiff } = await import("../schedule-news.server");
const { windowVerdict } = await import("../news.server");
const { dedupeAddresses } = await import("../drip-dedupe");

type State = Parameters<typeof describeChange>[0];

const base = {
  published: true,
  title: "Alumni Game",
  day_number: 2,
  starts_at: "2026-10-04T14:00:00Z",
  ends_at: "2026-10-04T16:00:00Z",
  doors_at: null,
  relative_timing: null,
  time_tbd: false,
  location: "Cost Sports Center",
  audience: "everyone",
  division: null,
  status: "confirmed",
  ticket_url: null,
} satisfies NonNullable<State>;

const withPatch = (patch: Partial<NonNullable<State>>) => ({ ...base, ...patch });

describe("what counts as news", () => {
  it("says nothing when nothing changed", () => {
    expect(describeChange(base, withPatch({}))).toBeNull();
  });

  it("says nothing about punctuation or case", () => {
    expect(describeChange(base, withPatch({ title: "alumni game." }))).toBeNull();
  });

  it("names the new date, time and time zone when the time moves", () => {
    const line = describeChange(base, withPatch({ starts_at: "2026-10-04T15:00:00Z" }));
    expect(line).toContain("Sunday, October 4");
    expect(line).toContain("11:00 AM");
    expect(line).toMatch(/EDT|EST/);
  });

  it("announces a cancellation on its own", () => {
    expect(describeChange(base, withPatch({ status: "cancelled" }))).toBe("Alumni Game is cancelled.");
  });

  it("notices tickets appearing and disappearing", () => {
    expect(describeChange(base, withPatch({ ticket_url: "https://tix.test" }))).toContain(
      "has tickets available",
    );
    expect(describeChange(withPatch({ ticket_url: "https://tix.test" }), base)).toContain(
      "no longer has a ticket link",
    );
  });

  it("stays quiet when an edit is undone", () => {
    const moved = withPatch({ starts_at: "2026-10-04T15:00:00Z" });
    expect(describeChange(base, moved)).not.toBeNull();
    expect(describeChange(base, base)).toBeNull();
    expect(describeChange(moved, moved)).toBeNull();
  });

  it("treats an unpublished draft as nothing to say", () => {
    expect(describeChange(withPatch({ published: false }), withPatch({ published: false }))).toBeNull();
  });
});

describe("what a quiet save may absorb", () => {
  it("lets wording through", () => {
    expect(materialDiff(base, withPatch({ title: "Alumni Game (Sabah)" }))).toEqual([]);
    expect(materialDiff(base, withPatch({ location: "Cost Sports Centre" }))).toEqual([]);
  });

  it("refuses to hide a time change, a cancellation or a new audience", () => {
    expect(materialDiff(base, withPatch({ starts_at: "2026-10-04T15:00:00Z" }))).toContain("when");
    expect(materialDiff(base, withPatch({ status: "cancelled" }))).toContain("status");
    expect(materialDiff(base, withPatch({ audience: "alumni" }))).toContain("audience");
    expect(materialDiff(base, withPatch({ published: false }))).toContain("published");
  });
});

describe("the morning launch minute", () => {
  it("does not post before the minute", () => {
    expect(windowVerdict("08:45", "09:00")).toBe("early");
    expect(windowVerdict("08:59", "09:00")).toBe("early");
  });

  it("posts in the nine o'clock minute and in no other", () => {
    expect(windowVerdict("09:00", "09:00")).toBe("due");
    expect(windowVerdict("09:01", "09:00")).toBe("missed");
    expect(windowVerdict("09:15", "09:00")).toBe("missed");
    expect(windowVerdict("09:30", "09:00")).toBe("missed");
  });

  it("never catches up later in the day", () => {
    expect(windowVerdict("10:00", "09:00")).toBe("missed");
    expect(windowVerdict("17:00", "09:00")).toBe("missed");
    expect(windowVerdict("23:59", "09:00")).toBe("missed");
  });
});

describe("one address, one copy", () => {
  beforeEach(() => vi.clearAllMocks());

  it("skips a mailbox this campaign already wrote to", () => {
    const { keep, skipped } = dedupeAddresses(
      [{ id: "a", email: "Reed@example.test" }],
      new Set(["reed@example.test"]),
    );
    expect(keep).toEqual([]);
    expect(skipped).toBe(1);
  });

  it("gives two records sharing a mailbox a single copy", () => {
    const { keep, skipped } = dedupeAddresses(
      [
        { id: "a", email: "shared@example.test" },
        { id: "b", email: "SHARED@example.test" },
      ],
      new Set(),
    );
    expect(keep.map((r) => r.id)).toEqual(["a"]);
    expect(skipped).toBe(1);
  });
});
