import { createServerFn } from "@tanstack/react-start";

import type { EditionSummary } from "./edition-format";

export type EditionContext = {
  current: EditionSummary;
  next: EditionSummary | null;
};

export type PastEdition = EditionSummary & { going: number };

const summary = (e: {
  event_year: number;
  title: string;
  starts_on: string;
  ends_on: string;
}): EditionSummary => ({
  event_year: e.event_year,
  title: e.title,
  starts_on: e.starts_on,
  ends_on: e.ends_on,
});

/** Current edition plus the next published one, for countdowns and copy. */
export const getEditionContext = createServerFn({ method: "GET" }).handler(
  async (): Promise<EditionContext> => {
    const { loadCurrentEdition, loadNextPublishedEdition } = await import("./editions.server");
    const current = await loadCurrentEdition();
    const next = await loadNextPublishedEdition(current.event_year);
    return { current: summary(current), next: next ? summary(next) : null };
  },
);

/** Published editions other than the current one, with their going counts. */
export const getPastEditions = createServerFn({ method: "GET" }).handler(
  async (): Promise<PastEdition[]> => {
    const { loadEditions, goingCounts } = await import("./editions.server");
    const [editions, counts] = await Promise.all([loadEditions(), goingCounts()]);
    return editions
      .filter((e) => e.published && !e.is_current)
      .map((e) => ({ ...summary(e), going: counts.get(e.event_year) ?? 0 }));
  },
);
