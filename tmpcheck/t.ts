import { rosterDryRun, rosterCommit, mergePeople, exportCsv, dataGaps, organizerDigest, duplicateCandidates, resolveSuggestion } from "../src/lib/admin.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";

const year = new Date().getFullYear();
const { data: admin } = await supabaseAdmin.from("admins").select("person_id").limit(1).single();
const actor = admin!.person_id as string;

// 1. dry run
const dry = await rosterDryRun("Kell, Jordan\n  Riley Ochoa  \nZZ Testimport Alpha\nZZ Testimport Beta");
console.log("DRYRUN summary", dry.summary, dry.lines.map(l=>[l.parsed,l.bucket,l.candidates[0]?.name]));

// count stints before
const before = await supabaseAdmin.from("stints").select("id",{count:"exact",head:true}).eq("year",year).eq("source","roster_import");
console.log("roster_import stints before", before.count);

const res = await rosterCommit(actor, { division: "MENS_A", year, lines: dry.lines.map(l=>({parsed:l.parsed, personId:l.personId, create:l.bucket==="new"})) });
console.log("COMMIT", res);
const after = await supabaseAdmin.from("stints").select("person_id",{count:"exact"}).eq("year",year).eq("source","roster_import");
console.log("roster_import stints after", after.count);

// 2. merge two throwaway records
const a = (await supabaseAdmin.from("people").insert({first_name:"ZZ",last_name:"Mergetest"}).select("id, member_no").single()).data!;
const b = (await supabaseAdmin.from("people").insert({first_name:"ZZ",last_name:"Mergetest"}).select("id, member_no").single()).data!;
console.log("member_no distinct:", a.member_no, b.member_no);
await supabaseAdmin.from("stints").insert({person_id:b.id, division:"MENS_B", year:2010, source:"admin"});
await supabaseAdmin.from("identities").insert({person_id:b.id, email:`zz-${Date.now()}@example.com`, provider:"magic"});
await supabaseAdmin.from("rsvps").insert({person_id:b.id, event_year:2026, status:"maybe"});
await supabaseAdmin.from("verifications").insert({person_id:b.id, verified_by:actor});
await mergePeople(actor, {survivorId:a.id, loserId:b.id, playedAs:null});
const orphan = async (t:string, col="person_id") => (await supabaseAdmin.from(t as any).select("id",{count:"exact",head:true}).eq(col, b.id)).count;
console.log("orphans after merge:", {stints:await orphan("stints"), identities:await orphan("identities"), rsvps:await orphan("rsvps"), verifications:await orphan("verifications")});
console.log("survivor children:", {stints:(await supabaseAdmin.from("stints").select("id",{count:"exact",head:true}).eq("person_id",a.id)).count, rsvps:(await supabaseAdmin.from("rsvps").select("id",{count:"exact",head:true}).eq("person_id",a.id)).count});
console.log("loser row gone:", (await supabaseAdmin.from("people").select("id").eq("id",b.id).maybeSingle()).data === null);

// 3. memorial has no approve path
const mem = (await supabaseAdmin.from("suggestions").insert({submitted_by:actor, type:"memorial", status:"pending", payload:{person_id:a.id, note:"test"}}).select("id").single()).data!;
try { await resolveSuggestion(actor, mem.id, "approve"); console.log("MEMORIAL APPROVE: ALLOWED (bad)"); }
catch(e){ console.log("MEMORIAL APPROVE refused:", (e as Error).message); }

// 4. csv + panels
const csv = await exportCsv(actor);
console.log("CSV", csv.filename, csv.rows, "header:", csv.csv.split("\n")[0]);
console.log("GAPS", await dataGaps());
console.log("DIGEST", (await organizerDigest()).map(d=>[d.admin,d.from,d.to,d.counts]));
console.log("DUPES", (await duplicateCandidates()).slice(0,5).map(p=>[p.a.first_name+" "+p.a.last_name, p.score]));

// cleanup
await supabaseAdmin.from("suggestions").delete().eq("id", mem.id);
await supabaseAdmin.from("stints").delete().eq("year", year).eq("source","roster_import");
await supabaseAdmin.from("people").delete().eq("id", a.id);
await supabaseAdmin.from("people").delete().ilike("last_name","Testimport%");
console.log("cleaned");
