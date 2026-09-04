import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useQuery, useSuspenseQuery } from "@tanstack/react-query";

import { getPublishedNews } from "@/lib/news.functions";
import { getWeekendPage } from "@/lib/schedule.functions";
import { SITE_ORIGIN } from "@/lib/site-url";
import { PageShell } from "@/components/layout/PageShell";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { DiscordCta } from "@/components/DiscordCta";
import { DiscordDayOf } from "@/components/DiscordDayOf";
import type { NewsItem } from "@/lib/news-types";

const newsQuery = queryOptions({
  queryKey: ["news", "published"],
  queryFn: () => getPublishedNews({ data: { limit: 50 } }),
});

const weekendQuery = queryOptions({
  queryKey: ["schedule-page"],
  queryFn: () => getWeekendPage(),
});

export const Route = createFileRoute("/news")({
  loader: ({ context }) => context.queryClient.ensureQueryData(newsQuery),
  head: () => ({
    meta: [
      { title: "Weekend Updates — Pitt Club Ultimate Alumni" },
      {
        name: "description",
        content:
          "What changed for Alumni Weekend: confirmed venues and times, schedule and location changes, lodging, travel, and who is coming.",
      },
      { property: "og:title", content: "Weekend Updates — Pitt Club Ultimate Alumni" },
      {
        property: "og:description",
        content:
          "The public change log for Alumni Weekend. Confirmed venues and times, schedule changes, lodging and travel.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/news` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Pitt Club Ultimate Alumni Weekend Updates",
        href: `${SITE_ORIGIN}/news.xml`,
      },
    ],
  }),
  component: NewsPage,
});

function stamp(iso: string | null) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })
    .format(d)
    .toUpperCase();
}

/** A change to the public plan, as opposed to an RSVP rollup. */
function isChange(item: NewsItem) {
  return !(item.category === "RSVP" || item.post_type === "weekly_going");
}

/** Only ever a site path we published ourselves. Organizer notes never appear. */
function scheduleLink(item: NewsItem) {
  const url = item.related_url?.trim();
  if (!url) return null;
  if (!url.startsWith(SITE_ORIGIN)) return null;
  const path = url.slice(SITE_ORIGIN.length) || "/";
  if (!path.startsWith("/schedule")) return null;
  return path;
}

function Bulletin({ item, quiet = false }: { item: NewsItem; quiet?: boolean }) {
  const link = scheduleLink(item);
  return (
    <article id={item.id} className={quiet ? "py-4" : "py-6"} style={{ borderTop: "1px solid var(--chalk)" }}>
      <p
        style={{
          fontFamily: '"Space Mono", monospace',
          fontSize: 12,
          color: "var(--sterling)",
          letterSpacing: "0.06em",
        }}
      >
        {stamp(item.published_at)} · {item.category.toUpperCase()}
      </p>
      <h2
        className="mt-2"
        style={{
          fontFamily: '"Archivo", sans-serif',
          fontWeight: 800,
          fontSize: quiet ? 18 : 22,
          letterSpacing: "-0.02em",
          color: "var(--sabah-black)",
        }}
      >
        {item.title}
      </h2>
      {item.summary ? (
        <p className="mt-2 max-w-[640px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
          {item.summary}
        </p>
      ) : null}
      {item.body ? (
        <p
          className="mt-2 max-w-[640px]"
          style={{ fontSize: 15, color: "var(--sterling)", whiteSpace: "pre-line" }}
        >
          {item.body}
        </p>
      ) : null}
      {link ? (
        <p className="mt-3">
          <a href={link} style={{ fontSize: 15, fontWeight: 600, color: "var(--pitt-royal)" }}>
            See it on the Schedule
          </a>
        </p>
      ) : null}
      {item.author ? (
        <p className="mt-2" style={{ fontSize: 13, color: "var(--sterling)" }}>
          Posted by {item.author}
        </p>
      ) : null}
    </article>
  );
}

function NewsPage() {
  const { data } = useSuspenseQuery(newsQuery);
  const { data: weekend } = useQuery(weekendQuery);
  const edition = weekend?.edition ?? null;

  const changes = data.filter(isChange);
  const rollups = data.filter((item) => !isChange(item));

  return (
    <PageShell bare>
      <main id="main" className="mx-auto w-full max-w-[860px] px-5 pb-20">
        <header className="pt-10 pb-6 md:pt-14">
          <SlashEyebrow>Alumni Weekend · What changed</SlashEyebrow>
          <h1 className="display-64 mt-3" style={{ color: "var(--sabah-black)" }}>
            WEEKEND UPDATES
          </h1>
          <p className="mt-4 max-w-[620px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Every change we make to the public plan lands here: a venue getting confirmed, a TBD
            becoming a real time, a location moving, an event added or cancelled.{" "}
            <Link to="/schedule" style={{ color: "var(--pitt-royal)" }}>
              The Schedule
            </Link>{" "}
            is always the current truth. This page explains what changed and when. You can follow it
            as a feed at{" "}
            <a href="/news.xml" style={{ color: "var(--pitt-royal)" }}>
              /news.xml
            </a>
            .
          </p>
        </header>

        <DiscordDayOf startsOn={edition?.starts_on} endsOn={edition?.ends_on} />

        <section className="mt-10">
          {changes.length === 0 ? (
            <p className="py-8" style={{ fontSize: 16, color: "var(--sterling)" }}>
              Nothing has changed yet. When a time, place, or plan moves, it shows up here.{" "}
              <Link to="/schedule" style={{ color: "var(--pitt-royal)" }}>
                See the weekend
              </Link>
              .
            </p>
          ) : (
            <div>
              {changes.map((item) => (
                <Bulletin key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>

        {rollups.length > 0 ? (
          <section className="mt-14">
            <SlashEyebrow>Also</SlashEyebrow>
            <h2 className="display-30 mt-2" style={{ color: "var(--sabah-black)" }}>
              WHO IS COMING
            </h2>
            <div className="mt-3">
              {rollups.map((item) => (
                <Bulletin key={item.id} item={item} quiet />
              ))}
            </div>
          </section>
        ) : null}

        <div className="mt-12">
          <DiscordCta />
        </div>
      </main>
    </PageShell>
  );
}
