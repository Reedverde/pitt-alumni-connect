import { dispatchSequence, EVENT_RSVP_T10_KEY, resolveAudience, loadPendingEvents } from "../src/lib/drip.server";
const r = await dispatchSequence({ sequenceKey: EVENT_RSVP_T10_KEY, dryRun: true });
console.log(JSON.stringify({ key: r.sequenceKey, id: r.sequenceId, active: r.sequenceActive, audience: r.audience, wouldSend: r.wouldSend.length, skips: r.skips }, null, 2));
console.log("SUBJECT:", r.sample?.subject);
console.log(r.sample?.text);
// target-date projection: recent-send cooldown measured as of 2026-09-22
const aud = await resolveAudience(EVENT_RSVP_T10_KEY);
const pending = await loadPendingEvents();
let complete = 0;
for (const a of aud) if (((pending.get(a.personId) ?? pending.get("__all__") ?? []).length) === 0) complete++;
console.log("eligibleGoing", aud.length, "completeAnswers", complete, "incomplete", aud.length - complete);
