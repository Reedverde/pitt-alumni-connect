import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_ORIGIN } from "./site-url";
import { loadCurrentEdition } from "./editions.server";
import type {
  AutomationResult,
  NewsCategory,
  NewsItem,
  NewsSettings,
  PendingUpdate,
} from "./news-types";

const NEWS_COLUMNS =
  "id, title, summary, body, category, post_type, status, published_at, related_url, author, created_at";

const PENDING_COLUMNS = "id, kind, title, summary, category, related_url, status, created_at";

// ------------------------------------------------------------------ reads

/** Published items only. The one read the public site and the feed share. */
export async function listPublished(limit = 50): Promise<NewsItem[]> {
  const { data } = await supabaseAdmin
    .from("news_items")
    .select(NEWS_COLUMNS)
    .eq("status", "published")
    .not("published_at", "is", null)
    .lte("published_at", new Date().toISOString())
    .order("published_at", { ascending: false })
    .limit(Math.min(200, Math.max(1, limit)));
  return (data ?? []) as NewsItem[];
}

export async function loadSettings(): Promise<NewsSettings> {
  const { data } = await supabaseAdmin
    .from("news_settings")
    .select("enabled, timezone, daily_digest_time, weekly_day, weekly_time, last_digest_date, last_weekly_date")
    .eq("id", true)
    .maybeSingle();
  return (data as NewsSettings | null) ?? {
    enabled: false,
    timezone: "America/New_York",
    daily_digest_time: "19:00",
    weekly_day: 1,
    weekly_time: "09:00",
    last_digest_date: null,
    last_weekly_date: null,
  };
}

export async function listPending(includeAll = true): Promise<PendingUpdate[]> {
  let q = supabaseAdmin.from("news_pending_updates").select(PENDING_COLUMNS);
  if (!includeAll) q = q.eq("status", "pending");
  const { data } = await q.order("created_at", { ascending: true }).limit(200);
  return (data ?? []) as PendingUpdate[];
}

export async function listAllNews(limit = 100): Promise<NewsItem[]> {
  const { data } = await supabaseAdmin
    .from("news_items")
    .select(NEWS_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as NewsItem[];
}

// ---------------------------------------------------------- pending intake

/**
 * The only way anything automatic reaches the bulletin. Conservative on
 * purpose: transactional mail, RSVP churn, and internal edits never call it.
 * A dedupe key makes every retry a no op.
 */
export async function addPendingUpdate(input: {
  kind: string;
  title: string;
  summary?: string;
  category?: NewsCategory;
  relatedUrl?: string | null;
  dedupeKey: string;
}): Promise<{ ok: boolean; created: boolean }> {
  const row = {
    kind: input.kind.slice(0, 60),
    title: input.title.trim().slice(0, 160),
    summary: (input.summary ?? "").trim().slice(0, 400),
    category: (input.category ?? "General") as string,
    related_url: input.relatedUrl ?? null,
    dedupe_key: input.dedupeKey.slice(0, 200),
  };
  const { error } = await supabaseAdmin
    .from("news_pending_updates")
    .insert(row as never);
  if (error) {
    // Only a unique violation means it is already queued or already consumed.
    if (error.code === "23505") return { ok: true, created: false };
    // Anything else is a real failure. Losing it quietly is how news goes missing.
    console.error("[news] addPendingUpdate failed", {
      kind: row.kind,
      dedupeKey: row.dedupe_key,
      code: error.code,
      message: error.message,
    });
    return { ok: false, created: false };
  }
  return { ok: true, created: true };
}

// ------------------------------------------------------------ cron token

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * The scheduled job presents a random token in a header. Only its hash lives in
 * the database, in a table no signed in user can read, so neither the admin UI
 * nor any public API can ever hand it out.
 */
export async function verifyCronToken(presented: string | null): Promise<boolean> {
  if (!presented || presented.length < 16) return false;
  const { data } = await supabaseAdmin
    .from("internal_secrets")
    .select("value_hash")
    .eq("key", "news_cron_token")
    .maybeSingle();
  const expected = (data as { value_hash: string } | null)?.value_hash;
  if (!expected) return false;
  const actual = await sha256Hex(presented);
  if (actual.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < actual.length; i += 1) diff |= actual.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

// ------------------------------------------------------------ digest build

function bulletLine(p: PendingUpdate) {
  const tail = p.summary?.trim() ? ` ${p.summary.trim()}` : "";
  return `• ${p.title.trim()}${tail}`;
}

/** What the digest would say right now. Never writes. */
export async function previewDigest(): Promise<{
  count: number;
  title: string;
  summary: string;
  body: string;
  items: PendingUpdate[];
}> {
  const items = (await listPending(false)).filter((p) => p.status === "pending");
  const count = items.length;
  const title =
    count === 0
      ? "Nothing to report"
      : count === 1
        ? items[0].title.trim()
        : `${count} weekend updates`;
  const summary =
    count === 0
      ? ""
      : count === 1
        ? items[0].summary.trim() || items[0].title.trim()
        : `${count} things changed since the last update.`;
  const body = items.map(bulletLine).join("\n");
  return { count, title, summary, body, items };
}

/** Creates at most one digest. Publishes nothing when nothing is pending. */
export async function publishDigest(opts: {
  actorPersonId?: string | null;
  author?: string | null;
}): Promise<{ created: boolean; newsId: string | null; reason: string }> {
  const preview = await previewDigest();
  if (preview.count === 0) return { created: false, newsId: null, reason: "Nothing pending." };

  const edition = await loadCurrentEdition().catch(() => null);
  const { data, error } = await supabaseAdmin
    .from("news_items")
    .insert({
      title: preview.title,
      summary: preview.summary,
      body: preview.body,
      category: "Weekend",
      post_type: "daily_digest",
      status: "published",
      published_at: new Date().toISOString(),
      related_url: `${SITE_ORIGIN}/weekend`,
      author: opts.author ?? null,
      event_year: edition?.event_year ?? null,
      created_by: opts.actorPersonId ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) return { created: false, newsId: null, reason: error?.message ?? "Insert failed." };

  const newsId = (data as { id: string }).id;
  await supabaseAdmin
    .from("news_pending_updates")
    .update({ status: "consumed", consumed_at: new Date().toISOString(), consumed_news_id: newsId } as never)
    .in("id", preview.items.map((i) => i.id));

  return { created: true, newsId, reason: `Published ${preview.count} updates.` };
}

// ----------------------------------------------------------- weekly going

function displayName(row: { first_name: string; last_name: string | null; played_as: string | null }) {
  const base = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return row.played_as?.trim() ? `${base} (${row.played_as.trim()})` : base;
}

/**
 * One item a week listing people who newly read as going. Anyone already
 * listed for this edition is skipped forever, so retries add nobody twice.
 */
export async function publishWeeklyRoundup(opts: {
  actorPersonId?: string | null;
  dryRun?: boolean;
}): Promise<{ created: boolean; newsId: string | null; names: string[]; reason: string }> {
  const edition = await loadCurrentEdition();
  const [boardRes, seenRes] = await Promise.all([
    supabaseAdmin
      .from("board_people")
      .select("id, first_name, last_name, played_as, board_year, state")
      .eq("state", "going"),
    supabaseAdmin
      .from("news_roundup_members")
      .select("person_id")
      .eq("event_year", edition.event_year),
  ]);

  const seen = new Set((seenRes.data ?? []).map((r) => r.person_id as string));
  const fresh = (boardRes.data ?? []).filter((r) => !seen.has(r.id as string));

  if (fresh.length === 0)
    return { created: false, newsId: null, names: [], reason: "Nobody new is going." };

  const sorted = [...fresh].sort(
    (a, b) =>
      (Number(a.board_year ?? 9999) - Number(b.board_year ?? 9999)) ||
      String(a.last_name ?? "").localeCompare(String(b.last_name ?? "")),
  );
  const names = sorted.map((r) =>
    displayName(r as { first_name: string; last_name: string | null; played_as: string | null }),
  );

  if (opts.dryRun) return { created: false, newsId: null, names, reason: "Dry run." };

  const title =
    names.length === 1 ? "One more alumnus is coming" : `${names.length} more alumni are coming`;
  const lines = sorted.map((r) => {
    const year = r.board_year ? ` ${r.board_year}` : "";
    return `${displayName(r as never)}${year}`;
  });
  const body = `${lines.join("\n")}\n\nSee the whole board at ${SITE_ORIGIN}/`;

  const { data, error } = await supabaseAdmin
    .from("news_items")
    .insert({
      title,
      summary: `Newly on the board for Alumni Weekend ${edition.event_year}.`,
      body,
      category: "RSVP",
      post_type: "weekly_going",
      status: "published",
      published_at: new Date().toISOString(),
      related_url: `${SITE_ORIGIN}/`,
      event_year: edition.event_year,
      created_by: opts.actorPersonId ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data)
    return { created: false, newsId: null, names, reason: error?.message ?? "Insert failed." };

  const newsId = (data as { id: string }).id;
  await supabaseAdmin.from("news_roundup_members").insert(
    sorted.map((r) => ({
      event_year: edition.event_year,
      person_id: r.id as string,
      news_id: newsId,
    })) as never,
  );

  return { created: true, newsId, names, reason: `Listed ${names.length} people.` };
}

// -------------------------------------------------------------- automation

function localParts(tz: string, now = new Date()) {
  const date = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now);
  const time = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(now);
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: tz, weekday: "short" }).format(now);
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(weekday);
  return { date, time, dow };
}

function atOrPast(nowHHMM: string, targetHHMM: string) {
  return nowHHMM >= targetHHMM;
}

/**
 * The scheduled entry point. Safe to call as often as you like: the last run
 * dates make a second call on the same local day a no op.
 */
export async function runNewsAutomation(now = new Date()): Promise<AutomationResult> {
  const settings = await loadSettings();
  const { date, time, dow } = localParts(settings.timezone, now);
  const ran: string[] = [];
  const skipped: string[] = [];
  const createdIds: string[] = [];

  if (!settings.enabled) {
    return { ran, skipped: ["automation disabled"], createdIds, localTime: time, localDate: date };
  }

  // Daily digest: at most one per local calendar day, and only if due.
  if (settings.last_digest_date === date) skipped.push("digest already ran today");
  else if (!atOrPast(time, settings.daily_digest_time)) skipped.push("digest not due yet");
  else {
    const result = await publishDigest({ author: "Automation" });
    await supabaseAdmin
      .from("news_settings")
      .update({ last_digest_date: date } as never)
      .eq("id", true);
    if (result.created) {
      ran.push("daily_digest");
      if (result.newsId) createdIds.push(result.newsId);
    } else skipped.push(`digest: ${result.reason}`);
  }

  // Weekly roundup: right day, right time, and not already run this week.
  const daysSinceWeekly = settings.last_weekly_date
    ? Math.floor(
        (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${settings.last_weekly_date}T00:00:00Z`)) /
          86400000,
      )
    : 999;
  if (dow !== settings.weekly_day) skipped.push("roundup not scheduled today");
  else if (!atOrPast(time, settings.weekly_time)) skipped.push("roundup not due yet");
  else if (daysSinceWeekly < 6) skipped.push("roundup already ran this week");
  else {
    const result = await publishWeeklyRoundup({});
    await supabaseAdmin
      .from("news_settings")
      .update({ last_weekly_date: date } as never)
      .eq("id", true);
    if (result.created) {
      ran.push("weekly_going");
      if (result.newsId) createdIds.push(result.newsId);
    } else skipped.push(`roundup: ${result.reason}`);
  }

  return { ran, skipped, createdIds, localTime: time, localDate: date };
}

// --------------------------------------------------------------------- rss

function xmlEscape(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rfc822(iso: string) {
  return new Date(iso).toUTCString();
}

/** RSS 2.0, plain enough that MonitorRSS renders it cleanly in Discord. */
export function buildRss(items: NewsItem[]): string {
  const self = `${SITE_ORIGIN}/news.xml`;
  const entries = items
    .map((item) => {
      const link = item.related_url?.trim() || `${SITE_ORIGIN}/news#${item.id}`;
      const description = [item.summary?.trim(), item.body?.trim()]
        .filter(Boolean)
        .join("\n\n");
      return [
        "    <item>",
        `      <title>${xmlEscape(item.title)}</title>`,
        `      <link>${xmlEscape(link)}</link>`,
        `      <guid isPermaLink="false">${xmlEscape(item.id)}</guid>`,
        `      <pubDate>${rfc822(item.published_at ?? item.created_at)}</pubDate>`,
        `      <category>${xmlEscape(item.category)}</category>`,
        item.author?.trim() ? `      <dc:creator>${xmlEscape(item.author.trim())}</dc:creator>` : "",
        `      <description>${xmlEscape(description)}</description>`,
        "    </item>",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">
  <channel>
    <title>Pitt Club Ultimate Alumni News</title>
    <link>${SITE_ORIGIN}/news</link>
    <atom:link href="${self}" rel="self" type="application/rss+xml" />
    <description>Short bulletins about Alumni Weekend: schedule, travel, lodging, and who is coming.</description>
    <language>en-us</language>
    <lastBuildDate>${rfc822(items[0]?.published_at ?? new Date().toISOString())}</lastBuildDate>
${entries}
  </channel>
</rss>
`;
}
