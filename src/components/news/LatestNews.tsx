import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { getPublishedNews } from "@/lib/news.functions";
import { LabelRow } from "@/components/board/LabelRow";

/** The three most recent bulletins. Renders nothing when there are none. */
export function LatestNews({ limit = 3 }: { limit?: number }) {
  const { data } = useQuery({
    queryKey: ["news", "latest", limit],
    queryFn: () => getPublishedNews({ data: { limit: limit + 6 } }),
  });
  const all = data ?? [];
  // Changes to the public plan lead. RSVP rollups only fill leftover slots.
  const changes = all.filter((i) => !(i.category === "RSVP" || i.post_type === "weekly_going"));
  const rest = all.filter((i) => i.category === "RSVP" || i.post_type === "weekly_going");
  const items = [...changes, ...rest].slice(0, limit);
  if (items.length === 0) return null;

  return (
    <section className="mt-14">
      <LabelRow label="Weekend updates" right="What changed, and when" />

      <div className="mt-3 flex flex-col">
        {items.map((item) => (
          <article key={item.id} className="py-4" style={{ borderTop: "1px solid var(--chalk)" }}>
            <p
              style={{
                fontFamily: '"Space Mono", monospace',
                fontSize: 12,
                color: "var(--sterling)",
              }}
            >
              {item.category.toUpperCase()}
            </p>
            <h3
              className="mt-1"
              style={{
                fontFamily: '"Archivo", sans-serif',
                fontWeight: 800,
                fontSize: 18,
                color: "var(--sabah-black)",
              }}
            >
              {item.title}
            </h3>
            {item.summary ? (
              <p className="mt-1 max-w-[620px]" style={{ fontSize: 15, color: "var(--sterling)" }}>
                {item.summary}
              </p>
            ) : null}
          </article>
        ))}
      </div>
      <p className="mt-3">
        <Link to="/news" style={{ fontSize: 15, color: "var(--pitt-royal)" }}>
          View all news
        </Link>
      </p>
    </section>
  );
}
