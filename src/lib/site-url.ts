/**
 * The one place the public origin is defined.
 * Move to alumni.pittultimate.org by changing this line (or setting
 * VITE_PUBLIC_SITE_URL); nothing else hardcodes a domain.
 */
export const SITE_ORIGIN = (
  import.meta.env.VITE_PUBLIC_SITE_URL || "https://pitt.everde.co"
).replace(/\/+$/, "");

/** Absolute URL for a site-relative path. Unfurlers reject relative og:image. */
export function absoluteUrl(path: string): string {
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export const OG_IMAGE = absoluteUrl("/og-card.jpg");
