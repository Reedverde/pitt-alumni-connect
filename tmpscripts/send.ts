import { sendMagicLinkEmail, mailStatus } from "../src/lib/mail.server";
const st = await mailStatus();
console.log("STATUS", JSON.stringify(st, null, 2));
const r = await sendMagicLinkEmail({ to: "reed@verdesoto.me", personId: null, firstName: "Reed", status: "going", kind: "admin_test" });
console.log("SEND", JSON.stringify(r, null, 2));
