import { previewDigest } from "@/lib/news.server";
import { computeNetChanges } from "@/lib/schedule-news.server";
const c = await computeNetChanges();
console.log("net changes:", JSON.stringify(c, null, 1));
const p = await previewDigest();
console.log("preview:", JSON.stringify({count:p.count,title:p.title,body:p.body}, null, 1));
