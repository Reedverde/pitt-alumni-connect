import { V2Nav } from "@/components/v2/V2Nav";

/**
 * One navigation for the whole site.
 *
 * The centred editorial masthead used by the homepage is now the only header
 * on the site. This module stays as the shared entry point so every route can
 * keep importing SiteNav, but it renders the masthead and nothing else. The
 * older left aligned wordmark bar has been retired: two headers made the site
 * read as two different websites.
 */
export function SiteNav(_props: { onClaim?: () => void }) {
  return <V2Nav />;
}
