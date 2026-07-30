import { createClient } from "@supabase/supabase-js";
const url = process.env.SUPABASE_URL!, svc = process.env.SUPABASE_SERVICE_ROLE_KEY!, pub = process.env.SUPABASE_PUBLISHABLE_KEY!;
const admin = createClient(url, svc, { auth: { persistSession: false } });

// pick a non-admin person with an identity and no auth_user_id
const { data: cand } = await admin.rpc as any;
const { data: rows } = await admin.from("identities").select("id,email,person_id,auth_user_id").is("auth_user_id", null).limit(50);
const { data: admins } = await admin.from("admins").select("person_id");
const adminIds = new Set((admins ?? []).map((a: any) => a.person_id));
const pick = (rows ?? []).find((r: any) => !adminIds.has(r.person_id))!;
console.log("test identity:", pick.email, pick.person_id);

const email = pick.email as string;
const { data: created, error: cerr } = await admin.auth.admin.createUser({ email, email_confirm: true });
if (cerr) console.log("createUser err", cerr.message);
const uid = created?.user?.id ?? (await admin.auth.admin.listUsers()).data.users.find(u => u.email === email)?.id!;
await admin.from("identities").update({ auth_user_id: uid }).eq("id", pick.id);

// mint a session
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email });
const hashed = (link as any)?.properties?.hashed_token;
const anon = createClient(url, pub, { auth: { persistSession: false } });
const { data: sess, error: verr } = await anon.auth.verifyOtp({ type: "email", token_hash: hashed });
if (verr) console.log("verify err", verr.message);
const token = sess?.session?.access_token!;
const u = createClient(url, pub, { global: { headers: { Authorization: `Bearer ${token}` } }, auth: { persistSession: false } });

const q = async (label: string, p: Promise<any>) => { const r = await p; console.log(label, "count=", Array.isArray(r.data) ? r.data.length : r.count ?? (r.data?1:0), "err=", r.error?.message ?? "none"); };
await q("identities SELECT", u.from("identities").select("id,email,person_id"));
await q("people SELECT", u.from("people").select("id").limit(1000));
await q("people deceased_note", u.from("people").select("deceased_note").limit(1));
await q("people is_anchor", u.from("people").select("is_anchor").limit(1));
await q("preapproved_emails", u.from("preapproved_emails").select("*"));
await q("suppressions", u.from("suppressions").select("*"));
await q("sends", u.from("sends").select("*"));
await q("audit_log", u.from("audit_log").select("*"));
await q("sequences", u.from("sequences").select("*"));
await q("throttle_events", u.from("throttle_events").select("*"));
await q("stints", u.from("stints").select("id"));
await q("rsvps", u.from("rsvps").select("id"));
await q("verifications", u.from("verifications").select("id"));
await q("suggestions", u.from("suggestions").select("id"));
await q("admins", u.from("admins").select("person_id"));
await q("identities_needing_second_email", u.from("identities_needing_second_email").select("*"));
// write test: someone else's people row
const { data: other } = await admin.from("people").select("id,first_name").neq("id", pick.person_id).limit(1).single();
const w = await u.from("people").update({ first_name: other!.first_name }).eq("id", other!.id).select("id");
console.log("UPDATE other people row -> rows:", w.data?.length ?? 0, "err:", w.error?.message ?? "none");
const w2 = await u.from("people").update({ current_city: "TestCity" }).eq("id", pick.person_id).select("id");
console.log("UPDATE own people row -> rows:", w2.data?.length ?? 0, "err:", w2.error?.message ?? "none");
const w3 = await u.from("identities").update({ email: "hacked@example.com" }).neq("person_id", pick.person_id).select("id");
console.log("UPDATE other identities -> rows:", w3.data?.length ?? 0, "err:", w3.error?.message ?? "none");

// anon checks
const a = createClient(url, pub, { auth: { persistSession: false } });
for (const t of ["board_people","board_year_counts","divisions","team_names","events","editions","photos","photo_slots","people","identities","rsvps","stints","suggestions","sends","suppressions","preapproved_emails","audit_log","current_players","person_board_placement","identities_needing_second_email"]) {
  const r = await a.from(t).select("*").limit(5);
  console.log("anon", t, "rows=", r.data?.length ?? 0, "err=", r.error?.message ?? "none");
}
const ae = await a.from("identities").select("email").limit(1);
console.log("anon identities.email err:", ae.error?.message ?? "NONE - LEAK", ae.data);

// cleanup
await admin.from("people").update({ current_city: null }).eq("id", pick.person_id);
await admin.from("identities").update({ auth_user_id: null }).eq("id", pick.id);
if (uid) await admin.auth.admin.deleteUser(uid);
console.log("cleaned up");
