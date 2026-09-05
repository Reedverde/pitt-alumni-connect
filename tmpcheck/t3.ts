import { runNewsAutomation } from "@/lib/news.server";
console.log(await runNewsAutomation());
console.log(await runNewsAutomation(new Date("2026-09-06T12:30:00Z"))); // 8:30 ET, before 9
