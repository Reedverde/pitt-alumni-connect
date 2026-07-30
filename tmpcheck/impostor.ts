import { submitRsvpServer } from "../src/lib/rsvp.server";
const r = await submitRsvpServer({
  personId: "6c2d11ea-7c96-4bf7-a4da-138d5b3c9817",
  status: "not_this_year",
  email: "impostor@example.com",
  src: "email",
}, "203.0.113.9");
console.log(JSON.stringify(r));
// two back-to-back new people (member_no race)
const a = submitRsvpServer({ firstName: "Zzseq", lastName: "One", status: "maybe", email: "zzseq1@example.com" }, "203.0.113.10");
const b = submitRsvpServer({ firstName: "Zzseq", lastName: "Two", status: "maybe", email: "zzseq2@example.com" }, "203.0.113.11");
console.log(JSON.stringify(await Promise.all([a,b])));
