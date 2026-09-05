import { resolveAudience, loadPendingEvents, buildFor } from "../src/lib/drip.server";
const aud = await resolveAudience("event_rsvp_prompt");
const pending = await loadPendingEvents();
let withPending = 0; const dist: Record<number, number> = {};
for (const r of aud) {
  const list = pending.get(r.personId) ?? pending.get("__all__") ?? [];
  dist[list.length] = (dist[list.length] ?? 0) + 1;
  if (list.length) withPending++;
}
console.log("audience", aud.length, "withUnanswered", withPending, "dist", dist);
const sample = aud.find(r => (pending.get(r.personId) ?? pending.get("__all__") ?? []).length);
const built = sample && await buildFor("event_rsvp_prompt", { id: sample.personId, name: [sample.firstName, sample.lastName].filter(Boolean).join(" "), firstName: sample.firstName }, { schedule: [], dates: "", editionYear: 2026, pendingEvents: pending });
console.log("SUBJECT:", built?.subject);
console.log(built?.text);
console.log("PREHEADER/CTA:", (built?.html ?? "").match(/Each event needs its own yes or no|Answer on the board|alumni.pittultimate.org[^"<\s]*/g));
