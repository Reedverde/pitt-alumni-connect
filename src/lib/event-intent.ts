import { safeGet, safeSet, safeStorage } from "./safe-storage";

/** A tap on an event toggle made before signing in. Held for the round trip
 *  through the sign-in link so the person never has to tap twice. */
export type EventIntent = {
  eventId: string;
  status: "yes" | "no";
  partySize: number;
  returnTo: string;
};

const KEY = "pcu.event.intent";
const RETURN_KEY = "pcu.auth.returnTo";

export function saveEventIntent(intent: EventIntent): void {
  if (typeof window === "undefined") return;
  try {
    safeSet("session", KEY, JSON.stringify(intent));
    safeSet("session", RETURN_KEY, intent.returnTo);
  } catch {
    /* storage disabled: they will just tap again after signing in */
  }
}

export function readEventIntent(): EventIntent | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = safeGet("session", KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<EventIntent>;
    if (!parsed?.eventId || (parsed.status !== "yes" && parsed.status !== "no")) return null;
    return {
      eventId: String(parsed.eventId),
      status: parsed.status,
      partySize: Math.min(10, Math.max(1, Number(parsed.partySize ?? 1) || 1)),
      returnTo: typeof parsed.returnTo === "string" ? parsed.returnTo : "/schedule",
    };
  } catch {
    return null;
  }
}

export function clearEventIntent(): void {
  if (typeof window === "undefined") return;
  try {
    safeStorage("session")?.removeItem(KEY);
  } catch {
    /* nothing to clear */
  }
}

/** Where the sign-in page should land someone. Same origin paths only: an
 *  absolute URL here would be an open redirect. */
export function readAuthReturnTo(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = safeGet("session", RETURN_KEY);
    if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return null;
    return raw;
  } catch {
    return null;
  }
}

export function clearAuthReturnTo(): void {
  if (typeof window === "undefined") return;
  try {
    safeStorage("session")?.removeItem(RETURN_KEY);
  } catch {
    /* nothing to clear */
  }
}

const CONFIRMED_KEY = "pcu.auth.confirmed";

/** A one-time flag set the moment an email link finishes signing someone in.
 *  /me reads it once and uses it to lead with the current year's question.
 *  It is a stored intent rather than a hash jump because the profile loads
 *  asynchronously and an anchor can fire before the card exists. */
export function markSignInConfirmed(): void {
  if (typeof window === "undefined") return;
  try {
    safeSet("session", CONFIRMED_KEY, "1");
  } catch {
    /* storage disabled: the page simply lands normally */
  }
}

export function consumeSignInConfirmed(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const raw = safeGet("session", CONFIRMED_KEY);
    safeStorage("session")?.removeItem(CONFIRMED_KEY);
    return raw === "1";
  } catch {
    return false;
  }
}
