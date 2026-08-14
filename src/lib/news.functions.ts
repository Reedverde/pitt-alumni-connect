import { createServerFn } from "@tanstack/react-start";

import type { NewsItem } from "./news-types";

/** Public read. Published items only, enforced server side. */
export const getPublishedNews = createServerFn({ method: "GET" })
  .inputValidator((input: { limit?: number } | undefined) => input ?? {})
  .handler(async ({ data }): Promise<NewsItem[]> => {
    const { listPublished } = await import("./news.server");
    return listPublished(Number(data?.limit) || 50);
  });
