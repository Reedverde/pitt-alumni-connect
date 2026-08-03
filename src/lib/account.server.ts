import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { SELF_ADDED_SEED_PREFIX, teamLabel } from "./rsvp.server";

export type LinkResult = { linked: boolean; personId: string | null };

/** Runs on first (and every) login. Links the auth user to the identity row,
 *  verifies it, consumes a preapproval, and auto-approves anyone a peer
 *  already vouched for. Never creates an account on its own. */
export async function linkAuthUser(
  authUserId: string,
  email: string,
  provider: "magic" | "google",
): Promise<LinkResult> {
  const lower = email.trim().toLowerCase();

  const { data: identity } = await supabaseAdmin
    .from("identities")
    .select("id, person_id, verified_at, auth_user_id, is_primary")
    .eq("email", lower)
    .maybeSingle();

  if (!identity) {
    // No person record yet. They may still be a preapproved Google Group
    // address, or someone whose new-person request is still in the queue.
    // Clicking the link proves the inbox, so the pending request is marked
    // verified and the address attaches for real once it is approved.
    await markPendingRequestVerified(lower);
    return { linked: false, personId: null };
  }

  const personId = identity.person_id as string;

  const verifiedAt = (identity.verified_at as string | null) ?? new Date().toISOString();

  await supabaseAdmin
    .from("identities")
    .update({
      auth_user_id: authUserId,
      provider,
      verified_at: verifiedAt,
    })
    .eq("id", identity.id as string);

  // The address someone proves they hold becomes the address we write to. One
  // atomic call: the partial unique index would reject two primaries, and two
  // separate statements would leave a window with none. A manual choice made
  // on /me outranks this and is left alone by the function.
  await supabaseAdmin.rpc("promote_verified_primary", {
    _identity_id: identity.id as string,
  });

  // A record created by the anonymous RSVP endpoint joins the board only once
  // its email is verified. Clearing the marker means this happens exactly once,
  // so an admin hiding the chip later is never undone.
  const { data: person } = await supabaseAdmin
    .from("people")
    .select("seed_id, show_on_board")
    .eq("id", personId)
    .maybeSingle();

  if (
    typeof person?.seed_id === "string" &&
    person.seed_id.startsWith(SELF_ADDED_SEED_PREFIX)
  ) {
    await supabaseAdmin
      .from("people")
      .update({ show_on_board: true, seed_id: null })
      .eq("id", personId);
  }

  // Inbox possession on a preapproved address proves membership.
  const { data: preapproved } = await supabaseAdmin
    .from("preapproved_emails")
    .select("email, consumed_by")
    .eq("email", lower)
    .maybeSingle();

  if (preapproved && !preapproved.consumed_by) {
    await supabaseAdmin
      .from("preapproved_emails")
      .update({ consumed_by: personId, consumed_at: new Date().toISOString() })
      .eq("email", lower);
    await supabaseAdmin.from("people").update({ needs_review: false }).eq("id", personId);
  }

  // Already peer-verified before signing up -> auto-approved.
  const { count: vouches } = await supabaseAdmin
    .from("verifications")
    .select("id", { count: "exact", head: true })
    .eq("person_id", personId);
  if ((vouches ?? 0) > 0) {
    await supabaseAdmin.from("people").update({ needs_review: false }).eq("id", personId);
  }

  return { linked: true, personId };
}

/** Records that the address behind a pending new_person request has now been
 *  proven. Never throws: it is bookkeeping on a successful login. */
async function markPendingRequestVerified(email: string) {
  try {
    const { data } = await supabaseAdmin
      .from("suggestions")
      .select("id, payload")
      .eq("type", "new_person")
      .eq("status", "pending")
      .eq("payload->>email", email)
      .limit(20);
    for (const row of data ?? []) {
      const payload = (row.payload ?? {}) as Record<string, unknown>;
      if (payload.email_verified === true) continue;
      await supabaseAdmin
        .from("suggestions")
        .update({ payload: { ...payload, email_verified: true } as never })
        .eq("id", row.id as string);
    }
  } catch (err) {
    console.error(`[account] could not mark a request verified: ${String(err)}`);
  }
}

/** True when this signed-in address is one the organizers preapproved. */
export async function isPreapprovedEmail(email: string) {
  const { data } = await supabaseAdmin
    .from("preapproved_emails")
    .select("email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();
  return Boolean(data);
}

/** The signed-in, already verified caller says which name on the board is
 *  theirs. Their address attaches to that person as a verified identity and
 *  any preapproval is consumed. Refused when that name already belongs to a
 *  verified account. */
export async function attachMeToPerson(args: {
  authUserId: string;
  email: string;
  personId: string;
}) {
  const email = args.email.trim().toLowerCase();

  const { data: mine } = await supabaseAdmin
    .from("identities")
    .select("id, person_id")
    .eq("email", email)
    .maybeSingle();
  if (mine) return { ok: true, personId: mine.person_id as string };

  const { data: person } = await supabaseAdmin
    .from("people")
    .select("id, deceased")
    .eq("id", args.personId)
    .maybeSingle();
  if (!person || person.deceased) throw new Error("That name can't be claimed.");

  const { data: owners } = await supabaseAdmin
    .from("identities")
    .select("id, verified_at")
    .eq("person_id", args.personId);
  if ((owners ?? []).some((o) => o.verified_at)) {
    throw new Error("That name is already claimed by a verified account.");
  }

  const { error } = await supabaseAdmin.from("identities").insert({
    person_id: args.personId,
    email,
    provider: "magic",
    is_primary: (owners ?? []).length === 0,
    auth_user_id: args.authUserId,
    verified_at: new Date().toISOString(),
  } as never);
  if (error) throw new Error("We couldn't attach your email to that name.");

  await supabaseAdmin
    .from("preapproved_emails")
    .update({ consumed_by: args.personId, consumed_at: new Date().toISOString() })
    .eq("email", email)
    .is("consumed_by", null);

  await supabaseAdmin.from("people").update({ needs_review: false }).eq("id", args.personId);

  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: args.personId,
    action: "identity_self_attached",
    table_name: "identities",
    record_id: args.personId,
  });

  return { ok: true, personId: args.personId };
}

/** The signed-in caller is on no roster at all. Same new-person path as
 *  everyone else, except the request is auto-approved: possession of the inbox
 *  already proved membership, so there is nothing for an organizer to check. */
export async function addMeAsNewPerson(args: {
  authUserId: string;
  email: string;
  firstName: string;
  lastName: string | null;
  gradYear: number | null;
}) {
  const email = args.email.trim().toLowerCase();
  const firstName = args.firstName.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!firstName) throw new Error("Please enter your name.");

  const { data: mine } = await supabaseAdmin
    .from("identities")
    .select("person_id")
    .eq("email", email)
    .maybeSingle();
  if (mine) return { ok: true, personId: mine.person_id as string };

  const { data: created, error } = await supabaseAdmin
    .from("people")
    .insert({
      first_name: firstName,
      last_name: args.lastName ? args.lastName.replace(/\s+/g, " ").trim().slice(0, 80) : null,
      grad_year: args.gradYear,
      needs_review: false,
      show_on_board: true,
    } as never)
    .select("id")
    .single();
  if (error || !created) throw new Error("We couldn't add you. Try again.");
  const personId = created.id as string;

  await supabaseAdmin.from("identities").insert({
    person_id: personId,
    email,
    provider: "magic",
    is_primary: true,
    auth_user_id: args.authUserId,
    verified_at: new Date().toISOString(),
  } as never);

  await supabaseAdmin.from("suggestions").insert({
    type: "new_person",
    status: "approved",
    submitted_by: personId,
    reviewed_at: new Date().toISOString(),
    payload: {
      first_name: firstName,
      last_name: args.lastName,
      grad_year: args.gradYear,
      email,
      email_verified: true,
      auto_approved: "verified_email",
    } as never,
  } as never);

  await supabaseAdmin
    .from("preapproved_emails")
    .update({ consumed_by: personId, consumed_at: new Date().toISOString() })
    .eq("email", email)
    .is("consumed_by", null);

  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: personId,
    action: "self_added_verified",
    table_name: "people",
    record_id: personId,
  });

  return { ok: true, personId };
}

export type PendingSuggestion = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  grad_year: number | null;
  division: string | null;
  team_label: string | null;
  note: string | null;
  created_at: string | null;
};

async function viewerYearRange(personId: string) {
  const { data: stints } = await supabaseAdmin
    .from("stints")
    .select("year")
    .eq("person_id", personId);
  const years = (stints ?? []).map((s) => s.year as number);
  if (years.length > 0) return { from: Math.min(...years) - 3, to: Math.max(...years) + 3 };

  const { data: person } = await supabaseAdmin
    .from("people")
    .select("grad_year")
    .eq("id", personId)
    .maybeSingle();
  const grad = person?.grad_year as number | null | undefined;
  if (!grad) return null;
  return { from: grad - 4 - 3, to: grad + 3 };
}

/** Pending new_person suggestions whose playing years overlap the viewer's,
 *  plus or minus three. Never returns an email. */
export async function pendingForPeer(personId: string): Promise<PendingSuggestion[]> {
  const range = await viewerYearRange(personId);
  if (!range) return [];

  const { data } = await supabaseAdmin
    .from("suggestions")
    .select("id, payload, created_at, submitted_by")
    .eq("type", "new_person")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(200);

  const out: PendingSuggestion[] = [];
  for (const row of data ?? []) {
    if ((row.submitted_by as string) === personId) continue;
    const payload = (row.payload ?? {}) as Record<string, unknown>;
    const gradYear = typeof payload.grad_year === "number" ? payload.grad_year : null;
    const startYear = typeof payload.start_year === "number" ? payload.start_year : gradYear;
    if (gradYear === null && startYear === null) continue;
    const low = Math.min(startYear ?? gradYear!, gradYear ?? startYear!);
    const high = Math.max(startYear ?? gradYear!, gradYear ?? startYear!);
    if (high < range.from || low > range.to) continue;
    const division = typeof payload.division === "string" ? payload.division : null;
    out.push({
      id: row.id as string,
      first_name: String(payload.first_name ?? ""),
      last_name: (payload.last_name as string | null) ?? null,
      played_as: (payload.played_as as string | null) ?? null,
      grad_year: gradYear,
      division,
      team_label: await teamLabel(division, gradYear),
      note: (payload.note as string | null) ?? null,
      created_at: (row.created_at as string | null) ?? null,
    });
  }
  return out;
}

/** One peer vouch is enough: thin years have nobody else to ask. */
export async function vouchForSuggestion(suggestionId: string, voucherPersonId: string) {
  const { data: suggestion } = await supabaseAdmin
    .from("suggestions")
    .select("id, type, status, payload, submitted_by")
    .eq("id", suggestionId)
    .maybeSingle();

  if (!suggestion || suggestion.type !== "new_person" || suggestion.status !== "pending") {
    throw new Error("That suggestion is no longer open.");
  }
  if ((suggestion.submitted_by as string) === voucherPersonId) {
    throw new Error("You can't vouch for your own suggestion.");
  }

  const payload = (suggestion.payload ?? {}) as Record<string, unknown>;
  const { data: created, error } = await supabaseAdmin
    .from("people")
    .insert({
      first_name: String(payload.first_name ?? "").slice(0, 80) || "Unknown",
      last_name: (payload.last_name as string | null) ?? null,
      played_as: (payload.played_as as string | null) ?? null,
      grad_year: typeof payload.grad_year === "number" ? payload.grad_year : null,
      seed_division: typeof payload.division === "string" ? payload.division : null,
      needs_review: false,
    })
    .select("id")
    .single();
  if (error || !created) throw new Error("Couldn't add that person. Try again.");

  await supabaseAdmin
    .from("suggestions")
    .update({
      status: "approved",
      peer_verified_by: voucherPersonId,
      reviewed_at: new Date().toISOString(),
    })
    .eq("id", suggestionId);

  await supabaseAdmin
    .from("verifications")
    .insert({ person_id: created.id as string, verified_by: voucherPersonId });

  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: voucherPersonId,
    action: "peer_verified",
    table_name: "suggestions",
    record_id: suggestionId,
  });

  return { ok: true };
}

/** A memorial report is never a button anyone else can approve. Filing one
 *  suppresses that person from every send immediately. */
export async function fileMemorialReport(
  submitterPersonId: string,
  personId: string,
  note: string,
) {
  await supabaseAdmin.from("suggestions").insert({
    submitted_by: submitterPersonId,
    type: "memorial",
    status: "pending",
    payload: { person_id: personId, note, private: true },
  });

  const { data: emails } = await supabaseAdmin
    .from("identities")
    .select("email")
    .eq("person_id", personId);

  for (const row of emails ?? []) {
    await supabaseAdmin
      .from("suppressions")
      .upsert(
        { email: (row.email as string).toLowerCase(), reason: "memorial_pending" },
        { onConflict: "email" },
      );
  }

  await supabaseAdmin.from("audit_log").insert({
    actor_person_id: submitterPersonId,
    action: "memorial_reported",
    table_name: "suggestions",
    record_id: personId,
  });

  return { ok: true };
}

/** Anything unverified after seven days falls to the admin queue. */
export async function staleSuggestions() {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data } = await supabaseAdmin
    .from("suggestions")
    .select("id, type, payload, status, created_at, submitted_by")
    .eq("status", "pending")
    .lte("created_at", cutoff)
    .order("created_at", { ascending: true });
  return data ?? [];
}