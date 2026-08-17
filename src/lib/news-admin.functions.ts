import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AutomationResult, NewsAdminPayload, NewsItem, NewsSettings } from "./news-types";

export const getNewsAdmin = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<NewsAdminPayload> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { isAdmin: false, pending: [], published: [], settings: null };
    const news = await import("./news.server");
    const [pending, published, settings] = await Promise.all([
      news.listPending(true),
      news.listAllNews(100),
      news.loadSettings(),
    ]);
    return { isAdmin: true, pending, published, settings };
  });

export const adminPreviewDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return null;
    const news = await import("./news.server");
    return news.previewDigest();
  });

export const adminPublishDigest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { created: false, newsId: null, reason: "Not permitted." };
    const news = await import("./news.server");
    const result = await news.publishDigest({ actorPersonId: actor });
    await admin.auditNews(actor, "news.publish_digest", result.newsId, result);
    return result;
  });

export const adminRunWeeklyRoundup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean } | undefined) => input ?? {})
  .handler(async ({ data, context }) => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { created: false, newsId: null, names: [], reason: "Not permitted." };
    const news = await import("./news.server");
    const result = await news.publishWeeklyRoundup({
      actorPersonId: actor,
      dryRun: data?.dryRun === true,
    });
    if (!data?.dryRun) await admin.auditNews(actor, "news.weekly_roundup", result.newsId, result);
    return result;
  });

export const adminSavePending = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      title?: string;
      summary?: string;
      category?: string;
      status?: "pending" | "suppressed";
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return admin.saveNewsPending(actor, data);
  });

export const adminSaveNewsItem = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id?: string | null;
      title: string;
      summary: string;
      body: string;
      category: string;
      post_type?: string;
      related_url?: string | null;
      author?: string | null;
      publish?: boolean;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<{ ok: boolean; id: string | null }> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { ok: false, id: null };
    return admin.saveNewsItem(actor, data);
  });

export const adminSetNewsStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string; status: "draft" | "published" | "archived" }) => input)
  .handler(async ({ data, context }) => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return admin.setNewsStatus(actor, data.id, data.status);
  });

export const adminSaveNewsSettings = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      enabled: boolean;
      daily_digest_time: string;
      weekly_day: number;
      weekly_time: string;
    }) => input,
  )
  .handler(async ({ data, context }): Promise<NewsSettings | null> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return null;
    return admin.saveNewsSettings(actor, data);
  });

export const adminRunNewsAutomation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AutomationResult | null> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return null;
    const news = await import("./news.server");
    const result = await news.runNewsAutomation();
    await admin.auditNews(actor, "news.automation_manual", null, result);
    return result;
  });

export type { NewsItem };

export const adminRetryDiscord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }): Promise<{ ok: boolean; reason: string }> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { ok: false, reason: "Not permitted." };
    const { deliverNewsToDiscord } = await import("./discord-news.server");
    const result = await deliverNewsToDiscord(data.id);
    await admin.auditNews(actor, "news.discord_retry", data.id, {
      ok: result.ok,
      status: result.status,
      reason: result.reason,
    });
    return { ok: result.ok, reason: result.reason };
  });

export const adminTestDiscord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean; reason: string }> => {
    const admin = await import("./admin.server");
    const actor = await admin.adminActor(context.supabase);
    if (!actor) return { ok: false, reason: "Not permitted." };
    const { sendDiscordTest } = await import("./discord-news.server");
    const result = await sendDiscordTest();
    await admin.auditNews(actor, "news.discord_test", null, { ok: result.ok, reason: result.reason });
    return result;
  });
