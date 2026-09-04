/** The three things this project refuses to blur together:
 *
 *  1. an address is on file (someone typed it, or we matched it to a record),
 *  2. an inbox is proven (a sign in link was actually opened),
 *  3. the person read their permanent roster facts and said something about
 *     them.
 *
 *  Only the third is a profile review, and it is only ever recorded when the
 *  person presses a control themselves. Nothing here is inferred or backfilled.
 */

export type ProfileReviewState =
  | "never"
  | "confirmed"
  | "correction_pending"
  | "correction_handled";

export type ProfileReviewSummary = {
  state: ProfileReviewState;
  /** When they last reviewed, ISO. Null when they never have. */
  lastReviewedAt: string | null;
};

export const PROFILE_REVIEW_LABELS: Record<ProfileReviewState, string> = {
  never: "Not reviewed yet",
  confirmed: "Reviewed and confirmed",
  correction_pending: "Reviewed, correction pending",
  correction_handled: "Reviewed, correction handled",
};

/** Plain sentence for the person themselves. Never says confirmed unless they
 *  said so. */
export function profileReviewSentence(summary: ProfileReviewSummary): string {
  const when = summary.lastReviewedAt ? formatReviewDate(summary.lastReviewedAt) : null;
  switch (summary.state) {
    case "confirmed":
      return `You confirmed this looked right on ${when}.`;
    case "correction_pending":
      return `You sent a correction on ${when}. The organizers have not applied it yet, so this is not confirmed.`;
    case "correction_handled":
      return `You sent a correction on ${when} and the organizers have handled it. Confirm it looks right now.`;
    default:
      return "Nobody has confirmed this information with you yet.";
  }
}

export function formatReviewDate(iso: string) {
  try {
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso.slice(0, 10);
  }
}

/** Email language, kept honest. "On file" is not "verified". */
export function emailStateLabel(args: { onFile: boolean; verified: boolean }) {
  if (args.verified) return "Verified inbox";
  if (args.onFile) return "On file, not verified";
  return "No address on file";
}
