import { createFileRoute } from "@tanstack/react-router";

import { BoardExperience, boardQuery } from "@/components/board/BoardExperience";
import { V2Hero } from "@/components/v2/V2Hero";
import { V2Nav } from "@/components/v2/V2Nav";
import { V2Story } from "@/components/v2/V2Story";

const TITLE = "Still in the Game | Pitt Ultimate Alumni";
const DESCRIPTION =
  "An editorial look at Pitt Club Ultimate alumni: the climb back to Nationals, Alumni Weekend in Pittsburgh, and every name on the board.";

/**
 * Primary homepage. "/v2" stays live as a noindex alias of this page so older
 * preview links keep working; both render the same components. The previous
 * homepage is preserved at src/legacy/homepage-v1.tsx.bak for rollback.
 */
export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [{ rel: "canonical", href: "https://alumni.pittultimate.org/" }],
  }),
  component: HomePage,
});

function HomePage() {
  return <BoardExperience renderNav={() => <V2Nav />} renderHero={(args) => <V2Hero {...args} />} story={<V2Story />} />;
}
