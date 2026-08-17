/** Client safe shapes for the news bulletin. No server code imported here. */

export const NEWS_CATEGORIES = [
  "Weekend",
  "Schedule",
  "Travel",
  "Lodging",
  "RSVP",
  "Photos",
  "General",
] as const;

export type NewsCategory = (typeof NEWS_CATEGORIES)[number];

export const NEWS_POST_TYPES = ["daily_digest", "weekly_going", "manual", "urgent"] as const;
export type NewsPostType = (typeof NEWS_POST_TYPES)[number];

export type NewsStatus = "draft" | "published" | "archived";

export type NewsItem = {
  id: string;
  title: string;
  summary: string;
  body: string;
  category: NewsCategory;
  post_type: NewsPostType;
  status: NewsStatus;
  published_at: string | null;
  related_url: string | null;
  author: string | null;
  created_at: string;
  /** Discord delivery state. Never carries webhook details. */
  discord_posted_at?: string | null;
  discord_message_id?: string | null;
  discord_delivery_status?: "not_sent" | "sent" | "failed" | null;
  discord_delivery_error?: string | null;
};

export type PendingUpdate = {
  id: string;
  kind: string;
  title: string;
  summary: string;
  category: NewsCategory;
  related_url: string | null;
  status: "pending" | "suppressed" | "consumed";
  created_at: string;
};

export type NewsSettings = {
  enabled: boolean;
  timezone: string;
  daily_digest_time: string;
  weekly_day: number;
  weekly_time: string;
  last_digest_date: string | null;
  last_weekly_date: string | null;
};

export type NewsAdminPayload = {
  isAdmin: boolean;
  pending: PendingUpdate[];
  published: NewsItem[];
  settings: NewsSettings | null;
};

export type AutomationResult = {
  ran: string[];
  skipped: string[];
  createdIds: string[];
  localTime: string;
  localDate: string;
};
