/** Where a visitor came from. The list mirrors the rsvps_src_check constraint
 *  exactly. A value that is not on this list is never written: an unknown
 *  source is recorded as NULL, because a guessed source poisons the analytics
 *  this field exists to produce. */
export const RSVP_SOURCES = [
  "text",
  "email",
  "discord",
  "groupme",
  "facebook",
  "instagram",
  "x",
  "esn",
  "qr",
] as const;

export type RsvpSource = (typeof RSVP_SOURCES)[number];

/** Readable labels for admin reporting. The GroupMe A side and B side split is
 *  retired: GroupMe is one platform with one shared link, and the single row
 *  that carried groupme_a was backfilled to groupme on 2026-09-03. */
export const RSVP_SOURCE_LABELS: Record<string, string> = {
  text: "Text message",
  email: "Email",
  discord: "Discord",
  groupme: "GroupMe",
  facebook: "Facebook",
  instagram: "Instagram",
  x: "X",
  esn: "esnultimate.org",
  qr: "QR code",
  // Retired values. Not writable, label only, so historical rows still read as
  // words in admin reporting instead of a raw slug.
  groupme_a: "GroupMe (retired split, A side)",
  groupme_b: "GroupMe (retired split, B side)",
  groupme_alumni: "GroupMe (retired, alumni group)",
  groupme_all: "GroupMe (retired, all group)",
  website: "Website (retired)",
};



export function rsvpSourceLabel(src: string | null): string {
  if (!src) return "unknown";
  return RSVP_SOURCE_LABELS[src] ?? src;
}

export function normalizeRsvpSource(raw: unknown): RsvpSource | null {
  if (typeof raw !== "string") return null;
  const v = raw.trim().toLowerCase();
  return (RSVP_SOURCES as readonly string[]).includes(v) ? (v as RsvpSource) : null;
}

import { safeGet, safeSet } from "./safe-storage";

const KEY = "pcu.rsvp.src";

/** First touch wins. Captured from any route, kept in sessionStorage so it
 *  survives navigation between pages within the visit. Browser only: called
 *  from an effect, never during SSR. */
export function captureRsvpSource(search: string): void {
  if (typeof window === "undefined") return;
  try {
    if (safeGet("session", KEY)) return;
    const value = normalizeRsvpSource(new URLSearchParams(search).get("src"));
    if (value) safeSet("session", KEY, value);
  } catch {
    /* storage disabled; the RSVP still works, the source is just unknown */
  }
}

export function readRsvpSource(): RsvpSource | null {
  if (typeof window === "undefined") return null;
  try {
    return normalizeRsvpSource(safeGet("session", KEY));
  } catch {
    return null;
  }
}
