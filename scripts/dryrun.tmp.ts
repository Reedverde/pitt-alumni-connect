import { dispatchSequence } from "../src/lib/drip.server";
const r = await dispatchSequence({ sequenceKey: "event_rsvp_prompt", dryRun: true });
console.log(JSON.stringify({ ...r, wouldSend: r.wouldSend.length, sample: r.sample ? { subject: r.sample.subject, text: r.sample.text } : null }, null, 2));
