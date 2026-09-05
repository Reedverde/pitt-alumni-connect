import { describeChange } from "@/lib/schedule-news.server";
const base = {
  published: true, title: "Alumni Game", day_number: 3,
  starts_at: "2026-10-04T14:00:00+00:00", ends_at: "2026-10-04T16:00:00+00:00",
  doors_at: null, relative_timing: null, time_tbd: false,
  location: "The Bubble", audience: "everyone", division: null,
  status: "confirmed", ticket_url: null, timezone: "America/New_York",
};
const t = (label: string, after: Partial<typeof base>) =>
  console.log(label.padEnd(28), "->", describeChange(base as never, { ...base, ...after } as never));
t("no change", {});
t("spelling/case only", { title: "alumni  game" });
t("curly quote only", { location: "The Bubble" });
t("real title change", { title: "Alumni Game and Cookout" });
t("time change", { starts_at: "2026-10-04T15:00:00+00:00" });
t("doors added", { doors_at: "2026-10-04T13:00:00+00:00" });
t("location change", { location: "Cost Center" });
t("cancelled", { status: "cancelled" });
t("tickets on sale", { ticket_url: "https://x.test/t" });
t("unpublished", { published: false });
t("audience", { audience: "adults" });
t("added (no before)", {});
console.log("insert".padEnd(28), "->", describeChange(null, base as never));
