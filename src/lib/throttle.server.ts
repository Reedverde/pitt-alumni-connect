import { createHash } from "crypto";

import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type ThrottleKind = "rsvp_ip" | "rsvp_email" | "rsvp_global";

export const HOUR = 60 * 60 * 1000;
export const DAY = 24 * HOUR;

/** Limits live here so the numbers are readable in one place. */
export const THROTTLE = {
  ipSoft: { limit: 5, windowMs: HOUR },
  ipHard: { limit: 30, windowMs: HOUR },
  emailSoft: { limit: 3, windowMs: HOUR },
  emailHard: { limit: 8, windowMs: DAY },
  globalSoft: { limit: 200, windowMs: HOUR },
  globalHard: { limit: 600, windowMs: HOUR },
};

export function hashIp(ip: string) {
  return createHash("sha256").update(`pitt-alumni:${ip}`).digest("hex").slice(0, 32);
}

export async function countRecent(kind: ThrottleKind, bucket: string, windowMs: number) {
  const since = new Date(Date.now() - windowMs).toISOString();
  const { count } = await supabaseAdmin
    .from("throttle_events")
    .select("id", { count: "exact", head: true })
    .eq("kind", kind)
    .eq("bucket", bucket)
    .gte("created_at", since);
  return count ?? 0;
}

export async function recordThrottleEvent(kind: ThrottleKind, bucket: string) {
  await supabaseAdmin.from("throttle_events").insert({ kind, bucket });
}

export type ThrottleVerdict =
  | { level: "ok" }
  | { level: "soft"; reason: string }
  | { level: "hard" };

/** Three dimensions, checked together. Hard rejects before any write, soft keeps
 *  the record but holds the mail back. */
export async function evaluateRsvpThrottle(ipHash: string, email: string): Promise<ThrottleVerdict> {
  const [ipHour, emailHour, emailDay, globalHour] = await Promise.all([
    countRecent("rsvp_ip", ipHash, HOUR),
    countRecent("rsvp_email", email, HOUR),
    countRecent("rsvp_email", email, DAY),
    countRecent("rsvp_global", "all", HOUR),
  ]);

  if (
    ipHour >= THROTTLE.ipHard.limit ||
    emailDay >= THROTTLE.emailHard.limit ||
    globalHour >= THROTTLE.globalHard.limit
  ) {
    return { level: "hard" };
  }

  if (ipHour >= THROTTLE.ipSoft.limit) return { level: "soft", reason: "rsvp_ip soft limit" };
  if (emailHour >= THROTTLE.emailSoft.limit)
    return { level: "soft", reason: "rsvp_email soft limit" };
  if (globalHour >= THROTTLE.globalSoft.limit)
    return { level: "soft", reason: "rsvp_global soft limit" };

  return { level: "ok" };
}

/** Admin mail counts against the global bucket so it cannot escape the cap. */
export async function globalMailAllowed() {
  const used = await countRecent("rsvp_global", "all", HOUR);
  return used < THROTTLE.globalHard.limit;
}
