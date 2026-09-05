import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { resolveAudience, loadPendingEvents, buildFor, EVENT_RSVP_T10_KEY } from "../src/lib/drip.server";
import { dedupeAddresses, normalizeEmail } from "../src/lib/drip-dedupe";

const SEQ = "915b8152-cd97-4816-b17a-db9e57117e26";
const TARGET = Date.parse("2026-09-22T13:00:00Z");
const cutoff = TARGET - 10 * 86400000;

const aud = await resolveAudience(EVENT_RSVP_T10_KEY);
const { data: sends } = await supabaseAdmin.from("sends").select("person_id, sequence_id, outcome, created_at, to_email");
const already = new Set<string>(); const recent = new Set<string>(); const emailed = new Set<string>();
for (const row of sends ?? []) {
  if (row.outcome !== "sent") continue;
  const addr = normalizeEmail(row.to_email as string | null);
  if (row.sequence_id === SEQ && addr) emailed.add(addr);
  const pid = row.person_id as string | null; if (!pid) continue;
  if (row.sequence_id === SEQ) already.add(pid);
  const at = Date.parse(String(row.created_at ?? "")); if (Number.isFinite(at) && at >= cutoff) recent.add(pid);
}
const skips = { already_sent: 0, recent_send: 0, no_body: 0, duplicate_email: 0 };
const queue = aud.filter(r => { if (already.has(r.personId)) { skips.already_sent++; return false; } if (recent.has(r.personId)) { skips.recent_send++; return false; } return true; });
const d = dedupeAddresses(queue, emailed); skips.duplicate_email = d.skipped;
const pending = await loadPendingEvents();
let would = 0; let sample: any = null;
for (const r of d.keep) {
  const b = await buildFor(EVENT_RSVP_T10_KEY, { id: r.personId, name: [r.firstName, r.lastName].filter(Boolean).join(" "), firstName: r.firstName }, { schedule: [], dates: "", editionYear: 2026, pendingEvents: pending });
  if (!b) { skips.no_body++; continue; }
  would++; if (!sample) sample = b;
}
console.log("target 2026-09-22 | eligible", aud.length, "wouldSend", would, JSON.stringify(skips));
console.log("SUBJECT:", sample?.subject); console.log(sample?.text);
