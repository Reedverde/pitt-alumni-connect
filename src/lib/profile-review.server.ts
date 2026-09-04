import { supabaseAdmin } from "@/integrations/supabase/client.server";

import type { ProfileReviewState, ProfileReviewSummary } from "./profile-review";

type ReviewRow = {
  person_id: string;
  outcome: "confirmed" | "correction_pending";
  created_at: string;
  suggestion_id: string | null;
};

/** Writes the review event. Called only from a path where the person pressed a
 *  control themselves; never from a login, a match, or a mail send. */
export async function recordProfileReview(args: {
  personId: string;
  outcome: "confirmed" | "correction_pending";
  source: string;
  suggestionId?: string | null;
}) {
  const { error } = await supabaseAdmin.from("profile_reviews").insert({
    person_id: args.personId,
    outcome: args.outcome,
    source: args.source.slice(0, 60),
    suggestion_id: args.suggestionId ?? null,
  } as never);
  if (error) {
    console.error(`[profile-review] could not record: ${error.message}`);
    return { ok: false };
  }
  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: args.personId,
    action:
      args.outcome === "confirmed" ? "profile_reviewed_confirmed" : "profile_reviewed_correction",
    table_name: "profile_reviews",
    record_id: args.personId,
    after: { source: args.source, suggestion_id: args.suggestionId ?? null } as never,
  });
  return { ok: true };
}

function summarize(row: ReviewRow | undefined, suggestionStillPending: boolean): ProfileReviewSummary {
  if (!row) return { state: "never", lastReviewedAt: null };
  let state: ProfileReviewState = "confirmed";
  if (row.outcome === "correction_pending")
    state = suggestionStillPending ? "correction_pending" : "correction_handled";
  return { state, lastReviewedAt: row.created_at };
}

/** The latest review for one person, with the correction's fate folded in: a
 *  correction an organizer already handled is no longer pending, but it is
 *  still not a confirmation. */
export async function loadProfileReview(personId: string): Promise<ProfileReviewSummary> {
  const { data } = await supabaseAdmin
    .from("profile_reviews")
    .select("person_id, outcome, created_at, suggestion_id")
    .eq("person_id", personId)
    .order("created_at", { ascending: false })
    .limit(1);
  const row = (data ?? [])[0] as ReviewRow | undefined;
  if (!row || row.outcome !== "correction_pending" || !row.suggestion_id)
    return summarize(row, false);
  const { data: suggestion } = await supabaseAdmin
    .from("suggestions")
    .select("status")
    .eq("id", row.suggestion_id)
    .maybeSingle();
  return summarize(row, (suggestion?.status ?? "pending") === "pending");
}

/** Every person's latest review, for the organizer views. One pass. */
export async function loadProfileReviews(): Promise<Map<string, ProfileReviewSummary>> {
  const [{ data: reviews }, { data: suggestions }] = await Promise.all([
    supabaseAdmin
      .from("profile_reviews")
      .select("person_id, outcome, created_at, suggestion_id")
      .order("created_at", { ascending: false })
      .limit(20000),
    supabaseAdmin.from("suggestions").select("id, status").eq("type", "edit").limit(20000),
  ]);
  const pending = new Set(
    (suggestions ?? []).filter((s) => s.status === "pending").map((s) => s.id as string),
  );
  const out = new Map<string, ProfileReviewSummary>();
  for (const raw of (reviews ?? []) as ReviewRow[]) {
    if (out.has(raw.person_id)) continue; // ordered newest first
    out.set(
      raw.person_id,
      summarize(raw, Boolean(raw.suggestion_id) && pending.has(raw.suggestion_id as string)),
    );
  }
  return out;
}
