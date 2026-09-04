import { createFileRoute } from "@tanstack/react-router";

import { BoardExperience, boardQuery } from "@/components/board/BoardExperience";
import { V2Hero } from "@/components/v2/V2Hero";
import { V2Nav } from "@/components/v2/V2Nav";
import { V2Story } from "@/components/v2/V2Story";

const TITLE = "Still in the Game | Pitt Ultimate Alumni";
const DESCRIPTION =
  "An editorial look at Pitt Club Ultimate alumni: the climb back to Nationals, Alumni Weekend in Pittsburgh, and every name on the board.";

/**
 * Experimental homepage. The claim board, search, filters, dialogs and person
 * panel are the exact shared implementation used by "/" and are not restyled
 * here: this route only supplies its own hero and its own storytelling block.
 */
export const Route = createFileRoute("/v2")({
  loader: ({ context }) => context.queryClient.ensureQueryData(boardQuery),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: V2Page,
});

function V2Page() {
  return <BoardExperience renderNav={() => <V2Nav />} renderHero={(args) => <V2Hero {...args} />} story={<V2Story />} />;
}
