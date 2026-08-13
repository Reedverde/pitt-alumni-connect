/**
 * The one place the public origin is defined.
 * Move to alumni.pittultimate.org by changing this line (or setting
 * VITE_PUBLIC_SITE_URL); nothing else hardcodes a domain.
 */
export const SITE_ORIGIN = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://alumni.pittultimate.org"
).replace(/\/+$/, "");

/** Absolute URL for a site-relative path. Unfurlers reject relative og:image. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const OG_IMAGE = absoluteUrl("/og-card.jpg");

/**
 * The one place the Discord invite is defined. Site chrome and every outbound
 * message read it from here; it is never written out a second time.
 */
export const DISCORD_INVITE_URL = "https://discord.gg/zTzdreH5jT";
