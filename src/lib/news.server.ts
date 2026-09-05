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

const ADMIN_NEWS_COLUMNS = `${NEWS_COLUMNS}, discord_posted_at, discord_message_id, discord_delivery_status, discord_delivery_error`;

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
    .select(ADMIN_NEWS_COLUMNS)
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

// -------------------------------------------------------- discord delivery

/**
 * Fires the one time Discord post for a freshly published item. Never throws
 * and never blocks publication: the news item is already saved.
 */
export async function deliverPublishedItem(newsId: string) {
  try {
    const { deliverNewsToDiscord } = await import("./discord-news.server");
    await deliverNewsToDiscord(newsId);
  } catch {
    // Delivery state is recorded on the row; publication is unaffected.
  }
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

export type BulletinPreview = {
  /** Net public schedule changes since each event was last announced. */
  changeLines: string[];
  /** Manually queued organizer items still awaiting a bulletin. */
  items: PendingUpdate[];
  /** Event ids whose announced baseline this bulletin would move forward. */
  eventIds: string[];
  /** The exact snapshot each line describes, so the baseline recorded after
   *  publication is the state that actually appeared in the article. */
  snapshots: { eventId: string; state: unknown }[];
  count: number;
  title: string;
  summary: string;
  body: string;
};

/**
 * What the next bulletin would say right now. Never writes.
 *
 * Schedule lines are the *net* difference between the live schedule and what
 * the public was last told, so several edits to one event collapse into one
 * line and an edit that was undone produces nothing.
 */
export async function previewDigest(): Promise<BulletinPreview> {
  const { computeNetChanges } = await import("./schedule-news.server");
  const [changes, pending] = await Promise.all([
    computeNetChanges(),
    listPending(false).then((rows) => rows.filter((p) => p.status === "pending")),
  ]);

  const changeLines = changes.map((c) => c.line);
  const lines = [...changeLines, ...pending.map(bulletLine)];
  const count = lines.length;

  const title =
    count === 0
      ? "Nothing to report"
      : count === 1
        ? (changeLines[0] ?? pending[0]!.title.trim())
        : `${count} weekend updates`;
  const summary =
    count === 0
      ? ""
      : count === 1
        ? (changeLines[0] ?? (pending[0]!.summary.trim() || pending[0]!.title.trim()))
        : `${count} things changed on the Alumni Weekend schedule.`;

  return {
    changeLines,
    items: pending,
    eventIds: changes.map((c) => c.eventId),
    snapshots: changes.map((c) => ({ eventId: c.eventId, state: c.state })),
    count,
    title: title.slice(0, 160),
    summary: summary.slice(0, 400),
    body: lines.map((l) => (l.startsWith("•") ? l : `• ${l}`)).join("\n"),
  };
}

/**
 * Creates at most one bulletin. Publishes nothing when nothing net-new has
 * happened. `dedupeKey` is unique in the database, so a retry, a second cron
 * tick or two overlapping runs can only ever produce one article, and Discord
 * delivery is keyed off that single row.
 */
export async function publishDigest(opts: {
  actorPersonId?: string | null;
  author?: string | null;
  /** Extra section appended to the same article, never a second post. */
  extraSection?: { heading: string; lines: string[] } | null;
  dedupeKey?: string | null;
}): Promise<{ created: boolean; newsId: string | null; reason: string }> {
  const preview = await previewDigest();
  const extra = opts.extraSection && opts.extraSection.lines.length > 0 ? opts.extraSection : null;
  if (preview.count === 0 && !extra)
    return { created: false, newsId: null, reason: "Nothing new to report." };

  const bodyParts = [preview.body].filter(Boolean);
  if (extra) bodyParts.push(`${extra.heading}\n${extra.lines.join("\n")}`);

  const title = preview.count === 0 && extra ? extra.heading : preview.title;
  const summary =
    preview.count === 0 && extra
      ? `${extra.lines.length} more on the board for Alumni Weekend.`
      : preview.summary;

  const edition = await loadCurrentEdition().catch(() => null);
  const { data, error } = await supabaseAdmin
    .from("news_items")
    .insert({
      title,
      summary,
      body: bodyParts.join("\n\n"),
      category: "Weekend",
      post_type: "daily_digest",
      status: "published",
      published_at: new Date().toISOString(),
      related_url: `${SITE_ORIGIN}/schedule`,
      author: opts.author ?? null,
      event_year: edition?.event_year ?? null,
      created_by: opts.actorPersonId ?? null,
      dedupe_key: opts.dedupeKey ?? null,
    } as never)
    .select("id")
    .single();
  if (error || !data) {
    // 23505 means another run already published this slot. Not a failure.
    if (error?.code === "23505")
      return { created: false, newsId: null, reason: "Already published for this slot." };
    return { created: false, newsId: null, reason: error?.message ?? "Insert failed." };
  }

  const newsId = (data as { id: string }).id;

  // Move each announced baseline forward only after the article exists, so a
  // crash mid-run leaves the change still owed rather than silently swallowed.
  const { markEventAnnounced } = await import("./schedule-news.server");
  for (const eventId of preview.eventIds) {
    await markEventAnnounced(eventId, newsId).catch((err) =>
      console.error("[news] baseline update failed", eventId, err),
    );
  }

  if (preview.items.length > 0) {
    await supabaseAdmin
      .from("news_pending_updates")
      .update({ status: "consumed", consumed_at: new Date().toISOString(), consumed_news_id: newsId } as never)
      .in("id", preview.items.map((i) => i.id));
  }

  await deliverPublishedItem(newsId);

  return { created: true, newsId, reason: `Published ${preview.count} updates.` };
}


// ----------------------------------------------------------- weekly going

function displayName(row: { first_name: string; last_name: string | null; played_as: string | null }) {
  const base = [row.first_name, row.last_name].filter(Boolean).join(" ");
  return row.played_as?.trim() ? `${base} (${row.played_as.trim()})` : base;
}

/**
 * The window this run covers. After a previous weekly run it starts at that
 * run's local date. The very first run of an edition has no cutoff at all: it
 * introduces everyone who is going right now, and news_roundup_members keeps
 * every later run from repeating a name.
 */
export async function weeklyRoundupCutoff(
  _now = new Date(),
): Promise<{ iso: string | null; firstRun: boolean }> {
  const settings = await loadSettings();
  if (settings.last_weekly_date) {
    return { iso: new Date(`${settings.last_weekly_date}T00:00:00Z`).toISOString(), firstRun: false };
  }
  return { iso: null, firstRun: true };
}

/**
 * One item a week listing people who said going during this week's window and
 * still read as going right now. Anyone already listed for this edition is
 * skipped forever, so retries add nobody twice. Dry runs take this same path.
 */
export async function publishWeeklyRoundup(opts: {
  actorPersonId?: string | null;
  dryRun?: boolean;
  now?: Date;
}): Promise<{ created: boolean; newsId: string | null; names: string[]; reason: string }> {
  const now = opts.now ?? new Date();
  const edition = await loadCurrentEdition();
  const { iso: cutoff, firstRun } = await weeklyRoundupCutoff(now);

  const goingQuery = supabaseAdmin
    .from("rsvps")
    .select("person_id, responded_at, status")
    .eq("event_year", edition.event_year)
    .eq("status", "going");

  const [recentRes, seenRes] = await Promise.all([
    cutoff ? goingQuery.gte("responded_at", cutoff) : goingQuery,
    supabaseAdmin
      .from("news_roundup_members")
      .select("person_id")
      .eq("event_year", edition.event_year),
  ]);

  const seen = new Set((seenRes.data ?? []).map((r) => r.person_id as string));
  const candidates = [...new Set((recentRes.data ?? []).map((r) => r.person_id as string))].filter(
    (id) => !seen.has(id),
  );

  // The board view is the public display convention and the only source of the
  // shown name. It also drops archived and memorial records for us.
  const boardRes = candidates.length
    ? await supabaseAdmin
        .from("board_people")
        .select("id, first_name, last_name, played_as, board_year, state")
        .eq("state", "going")
        .in("id", candidates)
    : { data: [] as Record<string, unknown>[] };

  const fresh = (boardRes.data ?? []) as Record<string, unknown>[];
  const windowLabel = firstRun ? "everyone going so far" : `since ${cutoff!.slice(0, 10)}`;

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

  if (opts.dryRun)
    return { created: false, newsId: null, names, reason: `Dry run, window: ${windowLabel}.` };

  // "alumni" was wrong: current players answer too, and they are on the board.
  const title =
    names.length === 1 ? "One more person is coming" : `${names.length} more people are coming`;
  const lines = sorted.map((r) => {
    const year = r.board_year ? ` ${r.board_year}` : "";
    return `${displayName(r as never)}${year}`;
  });
  const body = `${lines.join("\n")}\n\nSee everyone on the board at ${SITE_ORIGIN}/`;

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

  await deliverPublishedItem(newsId);

  return { created: true, newsId, names, reason: `Listed ${names.length} people.` };
}

/**
 * The roundup as a *section*, for folding into the single daily bulletin.
 * Reads only. Names are recorded as listed by recordRoundupMembers once the
 * one article actually exists, so nobody is ever listed twice.
 */
export async function collectRoundup(now = new Date()): Promise<{
  eventYear: number;
  personIds: string[];
  lines: string[];
}> {
  const edition = await loadCurrentEdition();
  const { iso: cutoff } = await weeklyRoundupCutoff(now);

  const goingQuery = supabaseAdmin
    .from("rsvps")
    .select("person_id, responded_at, status")
    .eq("event_year", edition.event_year)
    .eq("status", "going");

  const [recentRes, seenRes] = await Promise.all([
    cutoff ? goingQuery.gte("responded_at", cutoff) : goingQuery,
    supabaseAdmin.from("news_roundup_members").select("person_id").eq("event_year", edition.event_year),
  ]);

  const seen = new Set((seenRes.data ?? []).map((r) => r.person_id as string));
  const candidates = [...new Set((recentRes.data ?? []).map((r) => r.person_id as string))].filter(
    (id) => !seen.has(id),
  );
  if (candidates.length === 0) return { eventYear: edition.event_year, personIds: [], lines: [] };

  const { data } = await supabaseAdmin
    .from("board_people")
    .select("id, first_name, last_name, played_as, board_year, state")
    .eq("state", "going")
    .in("id", candidates);

  const sorted = [...((data ?? []) as Record<string, unknown>[])].sort(
    (a, b) =>
      Number(a.board_year ?? 9999) - Number(b.board_year ?? 9999) ||
      String(a.last_name ?? "").localeCompare(String(b.last_name ?? "")),
  );

  return {
    eventYear: edition.event_year,
    personIds: sorted.map((r) => r.id as string),
    lines: sorted.map((r) => `${displayName(r as never)}${r.board_year ? ` ${r.board_year}` : ""}`),
  };
}

async function recordRoundupMembers(eventYear: number, personIds: string[], newsId: string | null) {
  if (personIds.length === 0) return;
  await supabaseAdmin
    .from("news_roundup_members")
    .insert(personIds.map((person_id) => ({ event_year: eventYear, person_id, news_id: newsId })) as never);
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
 * The scheduled entry point, called every fifteen minutes.
 *
 * Exactly one automated bulletin per local calendar day, at the configured
 * hour (9:00 AM America/New_York), and only when there is something net-new to
 * say. There is no evening or intraday post: the weekly attendance roundup is
 * folded into the same single article on its day rather than becoming a second
 * one. An empty day publishes nothing.
 *
 * Timing follows the named timezone through Intl, so daylight saving is
 * handled by the calendar rather than by an offset we would have to maintain.
 *
 * Concurrency: the day is claimed with a conditional update on
 * last_digest_date before anything is built. A second tick, a retry or two
 * overlapping cron runs find the day already claimed and do nothing, and the
 * unique dedupe key on the article is the second guard behind that.
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

  if (settings.last_digest_date === date) {
    skipped.push("already ran today");
    return { ran, skipped, createdIds, localTime: time, localDate: date };
  }
  if (!atOrPast(time, settings.daily_digest_time)) {
    skipped.push("not due yet");
    return { ran, skipped, createdIds, localTime: time, localDate: date };
  }

  // Claim the day before building anything. Only one caller wins this update.
  const { data: claim } = await supabaseAdmin
    .from("news_settings")
    .update({ last_digest_date: date } as never)
    .eq("id", true)
    .or(`last_digest_date.is.null,last_digest_date.neq.${date}`)
    .select("id");
  if ((claim ?? []).length === 0) {
    skipped.push("another run claimed today");
    return { ran, skipped, createdIds, localTime: time, localDate: date };
  }

  // The roundup rides along inside today's single article when it is due.
  const daysSinceWeekly = settings.last_weekly_date
    ? Math.floor(
        (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${settings.last_weekly_date}T00:00:00Z`)) /
          86400000,
      )
    : 999;
  const roundupDue = dow === settings.weekly_day && daysSinceWeekly >= 6;
  const roundup = roundupDue
    ? await collectRoundup(now)
    : { eventYear: 0, personIds: [], lines: [] as string[] };
  if (!roundupDue) skipped.push("roundup not scheduled today");

  const extraSection =
    roundup.lines.length > 0
      ? {
          heading:
            roundup.lines.length === 1
              ? "One more person is coming"
              : `${roundup.lines.length} more people are coming`,
          lines: roundup.lines,
        }
      : null;

  const result = await publishDigest({
    author: "Automation",
    extraSection,
    dedupeKey: `auto:${date}`,
  });

  if (result.created) {
    ran.push("daily_bulletin");
    if (result.newsId) createdIds.push(result.newsId);
    if (roundup.lines.length > 0) {
      await recordRoundupMembers(roundup.eventYear, roundup.personIds, result.newsId);
      await supabaseAdmin.from("news_settings").update({ last_weekly_date: date } as never).eq("id", true);
      ran.push("weekly_going");
    }
  } else {
    skipped.push(result.reason);
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
