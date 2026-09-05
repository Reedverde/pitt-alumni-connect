import { dispatchSequence } from "../src/lib/drip.server";
const r = await dispatchSequence({ sequenceKey: "event_rsvp_prompt", dryRun: true });
console.log(JSON.stringify({ ...r, wouldSend: r.wouldSend.length, sample: r.sample?.subject }, null, 2));
console.log("---TEXT---\n" + (r.sample?.text ?? ""));
console.log("---HTMLHEAD---\n" + (r.sample?.html ?? "").slice(0, 1200));
