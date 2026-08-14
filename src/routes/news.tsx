import { createFileRoute, Link } from "@tanstack/react-router";
import { queryOptions, useSuspenseQuery } from "@tanstack/react-query";

import { getPublishedNews } from "@/lib/news.functions";
import { SITE_ORIGIN } from "@/lib/site-url";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import { SlashEyebrow } from "@/components/board/SlashEyebrow";
import { DiscordCta } from "@/components/DiscordCta";
import type { NewsItem } from "@/lib/news-types";

const newsQuery = queryOptions({
  queryKey: ["news", "published"],
  queryFn: () => getPublishedNews({ data: { limit: 50 } }),
});

export const Route = createFileRoute("/news")({
  loader: ({ context }) => context.queryClient.ensureQueryData(newsQuery),
  head: () => ({
    meta: [
      { title: "Alumni Weekend News — Pitt Club Ultimate" },
      {
        name: "description",
        content:
          "Short bulletins about Alumni Weekend: schedule changes, travel, lodging, photos, and who is coming.",
      },
      { property: "og:title", content: "Alumni Weekend News — Pitt Club Ultimate" },
      {
        property: "og:description",
        content: "Short bulletins about Alumni Weekend. Schedule, travel, lodging, and who is coming.",
      },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${SITE_ORIGIN}/news` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [
      {
        rel: "alternate",
        type: "application/rss+xml",
        title: "Pitt Club Ultimate Alumni News",
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
  })
    .format(d)
    .toUpperCase();
}

function Bulletin({ item }: { item: NewsItem }) {
  return (
    <article
      id={item.id}
      className="py-6"
      style={{ borderTop: "1px solid var(--chalk)" }}
    >
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
          fontSize: 22,
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
  return (
    <div style={{ background: "var(--field-white)" }} className="min-h-screen">
      <SiteNav />
      <main className="mx-auto w-full max-w-[860px] px-5 pb-20">
        <header className="pt-10 pb-6 md:pt-14">
          <SlashEyebrow>Alumni Weekend · Bulletins</SlashEyebrow>
          <h1 className="display-64 mt-3" style={{ color: "var(--sabah-black)" }}>
            NEWS
          </h1>
          <p className="mt-4 max-w-[600px]" style={{ fontSize: 16, color: "var(--steel-ink)" }}>
            Short notes when something actually changes. Nothing else. You can also follow this as a
            feed at{" "}
            <a href="/news.xml" style={{ color: "var(--pitt-royal)" }}>
              /news.xml
            </a>
            .
          </p>
        </header>

        {data.length === 0 ? (
          <p className="py-10" style={{ fontSize: 16, color: "var(--sterling)" }}>
            Nothing posted yet. When the schedule, travel, or lodging changes, it shows up here.{" "}
            <Link to="/weekend" style={{ color: "var(--pitt-royal)" }}>
              See the weekend
            </Link>
            .
          </p>
        ) : (
          <div>
            {data.map((item) => (
              <Bulletin key={item.id} item={item} />
            ))}
          </div>
        )}

        <div className="mt-12">
          <DiscordCta />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
