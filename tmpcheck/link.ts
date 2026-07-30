import { linkAuthUser } from "../src/lib/account.server";
console.log(JSON.stringify(await linkAuthUser(crypto.randomUUID(), process.argv[2], "magic")));
