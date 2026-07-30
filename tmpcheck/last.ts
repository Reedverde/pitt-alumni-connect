import { searchPeopleServer } from "../src/lib/rsvp.server";
import { supabaseAdmin } from "../src/integrations/supabase/client.server";
import { linkAuthUser } from "../src/lib/account.server";
const { data } = await supabaseAdmin.from("people").select("first_name,last_name").eq("deceased", true).limit(1);
const d = data![0]; const name = `${d.first_name} ${d.last_name ?? ""}`.trim();
const res = await searchPeopleServer(name);
console.log("deceased name:", name, "-> matches:", res.map(r=>r.first_name+" "+(r.last_name??"")));
// admin hides the previously self-added person; re-login must not re-show
await supabaseAdmin.from("people").update({ show_on_board: false }).eq("first_name","Zztestperson");
await linkAuthUser(crypto.randomUUID(), "zztest.alpha@example.com", "magic");
const { data: p } = await supabaseAdmin.from("people").select("show_on_board").eq("first_name","Zztestperson").single();
console.log("after admin-hide + relogin, show_on_board:", p!.show_on_board);
