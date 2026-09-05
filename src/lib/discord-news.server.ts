import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SITE_ORIGIN } from "./site-url";

/**
 * Direct Discord delivery for published news. The webhook lives only in the
 * server environment as DISCORD_NEWS_WEBHOOK_URL. It is never returned to a
 * caller, never logged, never written to a row, and never put in an audit
 * payload. Everything here is best effort: publishing must succeed even when
 * Discord does not.
 */

export type DiscordDeliveryStatus = "not_sent" | "sent" | "failed";

export type DiscordDeliveryResult = {
  attempted: boolean;
  ok: boolean;
  status: DiscordDeliveryStatus;
  reason: string;
};

const EMBED_COLOR = 0x003594; // Pitt Royal. Discord is outside the site palette rules.
const DESCRIPTION_LIMIT = 3800;
const FIELD_LIMIT = 1000;
const MAX_FIELDS = 20;

type NewsRow = {
  id: string;
  title: string;
  summary: string | null;
  body: string | null;
  category: string | null;
  status: string;
  related_url: string | null;
  discord_posted_at: string | null;
  discord_delivery_status: string | null;
};

function webhookUrl(): string | null {
  const raw = process.env["DISCORD_NEWS_WEBHOOK_URL"];
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!/^https:\/\/(canary\.|ptb\.)?discord(app)?\.com\/api\/webhooks\//i.test(trimmed)) return null;
  return trimmed;
}

/** True when a replacement webhook is configured. Never reveals the value. */
export function discordWebhookConfigured(): boolean {
  return webhookUrl() !== null;
}

/** Anything the webhook itself might echo back must never reach an admin screen. */
function scrubError(message: string): string {
  const url = webhookUrl();
  let out = message.slice(0, 300);
  if (url) out = out.split(url).join("[webhook]");
  return out.replace(/https:\/\/\S*discord(app)?\.com\/api\/webhooks\/\S*/gi, "[webhook]");
}

/** Splits a long block into embed fields so a big roundup stays one message. */
function chunkBody(body: string): { description: string; fields: { name: string; value: string }[] } {
  const trimmed = body.trim();
  if (trimmed.length <= DESCRIPTION_LIMIT) return { description: trimmed, fields: [] };

  const lines = trimmed.split("\n");
  const chunks: string[] = [];
  let current = "";
  for (const line of lines) {
    const piece = line.length > FIELD_LIMIT ? `${line.slice(0, FIELD_LIMIT - 1)}…` : line;
    if (current.length + piece.length + 1 > FIELD_LIMIT) {
      chunks.push(current);
      current = piece;
    } else {
      current = current ? `${current}\n${piece}` : piece;
    }
  }
  if (current) chunks.push(current);

  const kept = chunks.slice(0, MAX_FIELDS);
  const dropped = chunks.length - kept.length;
  const fields = kept.map((value, i) => ({
    name: i === 0 ? "Details" : "Continued",
    value,
  }));
  if (dropped > 0) {
    fields.push({ name: "More", value: `Read the rest at ${SITE_ORIGIN}/news` });
  }
  return { description: "", fields };
}

function buildPayload(item: NewsRow) {
  const link = item.related_url?.trim() || `${SITE_ORIGIN}/news#${item.id}`;
  const summary = (item.summary ?? "").trim();
  const body = (item.body ?? "").trim();
  const combined = [summary, body].filter(Boolean).join("\n\n");
  const { description, fields } = chunkBody(combined);

  return {
    username: "Pitt Alumni Weekend",
    allowed_mentions: { parse: [] as string[] },
    embeds: [
      {
        title: item.title.slice(0, 250),
        url: link,
        description: description || summary.slice(0, DESCRIPTION_LIMIT) || undefined,
        color: EMBED_COLOR,
        fields: fields.length ? fields : undefined,
        footer: {
          text: item.category
            ? `${item.category} · Pitt Club Ultimate Alumni Weekend`
            : "Pitt Club Ultimate Alumni Weekend",
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };
}

async function postToWebhook(payload: unknown): Promise<{ ok: boolean; messageId: string | null; reason: string }> {
  const url = webhookUrl();
  if (!url) return { ok: false, messageId: null, reason: "Discord webhook is not configured." };
  try {
    const res = await fetch(`${url}?wait=true`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      return { ok: false, messageId: null, reason: scrubError(`Discord returned ${res.status}. ${text}`) };
    }
    const json = (await res.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, messageId: json?.id ?? null, reason: "Sent." };
  } catch (err) {
    return { ok: false, messageId: null, reason: scrubError(err instanceof Error ? err.message : "Network error.") };
  }
}

async function markDelivery(
  newsId: string,
  patch: {
    discord_delivery_status: DiscordDeliveryStatus;
    discord_delivery_error: string | null;
    discord_posted_at?: string | null;
    discord_message_id?: string | null;
  },
) {
  await supabaseAdmin.from("news_items").update(patch as never).eq("id", newsId);
}

/**
 * Posts a published item once. Anything already sent is left alone, so retries
 * and republishes can never produce a second message. Never throws.
 */
export async function deliverNewsToDiscord(newsId: string): Promise<DiscordDeliveryResult> {
  try {
    const { data } = await supabaseAdmin
      .from("news_items")
      .select(
        "id, title, summary, body, category, status, related_url, discord_posted_at, discord_delivery_status",
      )
      .eq("id", newsId)
      .maybeSingle();
    const item = data as NewsRow | null;
    if (!item) return { attempted: false, ok: false, status: "not_sent", reason: "No such news item." };

    if (item.discord_posted_at || item.discord_delivery_status === "sent")
      return { attempted: false, ok: true, status: "sent", reason: "Already posted." };

    if (item.status !== "published")
      return { attempted: false, ok: false, status: "not_sent", reason: "Not published." };

    if (!discordWebhookConfigured()) {
      await markDelivery(newsId, {
        discord_delivery_status: "failed",
        discord_delivery_error: "Discord webhook is not configured.",
      });
      return { attempted: false, ok: false, status: "failed", reason: "Discord webhook is not configured." };
    }

    // Claim the post before making it. Whoever wins this conditional update owns
    // the delivery; a concurrent run, a retry or a second automation tick sees
    // the row already stamped and stops. A claim that then fails to post clears
    // the stamp again, so a deliberate retry is still possible.
    const { data: claimed } = await supabaseAdmin
      .from("news_items")
      .update({
        discord_posted_at: new Date().toISOString(),
        discord_delivery_status: "sent",
        discord_delivery_error: null,
      } as never)
      .eq("id", newsId)
      .is("discord_posted_at", null)
      .neq("discord_delivery_status", "sent")
      .select("id");
    if ((claimed ?? []).length === 0)
      return { attempted: false, ok: true, status: "sent", reason: "Already posted." };

    const result = await postToWebhook(buildPayload(item));
    if (!result.ok) {
      await markDelivery(newsId, {
        discord_delivery_status: "failed",
        discord_delivery_error: result.reason,
        discord_posted_at: null,
      });
      return { attempted: true, ok: false, status: "failed", reason: result.reason };
    }

    await markDelivery(newsId, {
      discord_delivery_status: "sent",
      discord_delivery_error: null,
      discord_posted_at: new Date().toISOString(),
      discord_message_id: result.messageId,
    });
    return { attempted: true, ok: true, status: "sent", reason: "Sent." };
  } catch (err) {
    const reason = scrubError(err instanceof Error ? err.message : "Delivery failed.");
    await markDelivery(newsId, {
      discord_delivery_status: "failed",
      discord_delivery_error: reason,
      discord_posted_at: null,
    }).catch(() => undefined);
    return { attempted: true, ok: false, status: "failed", reason };
  }
}

/** A short, obviously labelled test message. Creates no news item. */
export async function sendDiscordTest(): Promise<{ ok: boolean; reason: string }> {
  if (!discordWebhookConfigured())
    return { ok: false, reason: "Discord webhook is not configured. Add DISCORD_NEWS_WEBHOOK_URL as a project secret." };
  const result = await postToWebhook({
    username: "Pitt Alumni Weekend",
    allowed_mentions: { parse: [] as string[] },
    content: "Test message from the Pitt Club Ultimate alumni site. No action needed.",
  });
  return { ok: result.ok, reason: result.ok ? "Test message sent." : result.reason };
}
