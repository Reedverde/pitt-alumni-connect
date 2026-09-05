import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { AdminDashboard, AdminPerson, MailStatus, PersonStint, RosterLine } from "./admin.server";
import type { DripRunReport } from "./drip-types";

/** Dry run unless the caller explicitly says otherwise. Non-admins get null. */
export const adminRunDrip = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { dryRun?: boolean }) => input)
  .handler(async ({ data, context }): Promise<DripRunReport | null> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return null;
    return mod.runDripDispatch(actor, data?.dryRun !== false);
  });

/** Every read below asks is_admin() before it touches a table, and returns an
 *  empty payload — not an error — when the caller is not an admin, so the
 *  route never confirms its own existence to a signed-in member. */
export const getAdminDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminDashboard | { isAdmin: false }> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { isAdmin: false };
    return mod.dashboard();
  });

export const getAdminPeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminPerson[]> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    return mod.listPeople();
  });

export const adminUpdatePerson = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string; patch: Record<string, unknown> }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.updatePerson(actor, data.personId, data.patch ?? {});
  });

export const adminRecordMemorial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      personId: string;
      suggestionId: string | null;
      note: string;
      confirmedByName: string;
      confirmedAt: string;
      markDeceased: boolean;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.recordMemorialConfirmation(actor, data);
  });

export const adminPersonStints = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { personId: string }) => input)
  .handler(async ({ data, context }): Promise<PersonStint[]> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    return mod.listPersonStints(data.personId);
  });

export const adminAddStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { personId: string; division: string; role: string; year: number | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.addPersonStint(actor, data);
  });

export const adminDeleteStint = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.deletePersonStint(actor, data.id);
  });

export const adminResolveSuggestion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { suggestionId: string; action: "approve" | "reject" }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false, createdId: null };
    return mod.resolveSuggestion(actor, data.suggestionId, data.action);
  });

export const adminRosterDryRun = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { text: string }) => input)
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      lines: RosterLine[];
      summary: { matched: number; created: number; ambiguous: number; total: number };
    }> => {
      const mod = await import("./admin.server");
      const actor = await mod.adminActor(context.supabase);
      if (!actor)
        return { lines: [], summary: { matched: 0, created: 0, ambiguous: 0, total: 0 } };
      return mod.rosterDryRun(String(data.text ?? "").slice(0, 20000));
    },
  );

export const adminRosterCommit = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      division: string;
      year: number;
      lines: { parsed: string; personId: string | null; create: boolean }[];
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false, matched: 0, created: 0, skipped: 0 };
    return mod.rosterCommit(actor, data);
  });

export const adminMergePeople = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: { survivorId: string; loserId: string; playedAs: string | null }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.mergePeople(actor, data);
  });

export const adminMergeDuplicatePair = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { survivorId: string; loserId: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.mergeDuplicatePair(actor, data);
  });

export const adminKeepPairSeparate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { aId: string; bId: string; note?: string | null }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.rulePairSeparate(actor, {
      aId: data.aId,
      bId: data.bId,
      note: (data.note ?? null) as string | null,
    });
  });

export const adminUndoMerge = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { loserId: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) throw new Error("Admins only.");
    return mod.undoMerge(actor, data);
  });

export const adminExportCsv = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ filename: string; csv: string; rows: number } | null> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return null;
    return mod.exportCsv(actor);
  });

export const adminUpdateTeamName = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      id: string;
      name: string | null;
      start_year: number | null;
      end_year: number | null;
      confidence: string;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.updateTeamName(actor, data);
  });

export const adminSetDivisionVisible = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { code: string; visible: boolean }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.setDivisionVisible(actor, data);
  });

// ---------------------------------------------------------------- editions

export const adminCreateEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      event_year: number;
      title: string;
      starts_on?: string | null;
      ends_on?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.createEdition(actor, data);
  });

export const adminUpdateEdition = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      event_year: number;
      title: string;
      starts_on: string;
      ends_on: string;
      lodging_note?: string | null;
      travel_note?: string | null;
    }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.updateEditionDates(actor, data);
  });

export const adminSetEditionPublished = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event_year: number; published: boolean }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.setEditionPublished(actor, data.event_year, data.published);
  });

export const adminSetEditionCurrent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event_year: number }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.setEditionCurrent(actor, data.event_year);
  });

export const adminAddEditionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: import("./admin.server").EditionEventInput & { event_year: number }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.createEditionEvent(actor, data);
  });

export const adminDefaultEditionDates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { event_year: number }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return null;
    return mod.defaultEditionDates(data.event_year);
  });

export const adminDeleteEditionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.deleteEditionEvent(actor, data.id);
  });

export const adminUpdateEditionEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: import("./admin.server").EditionEventInput & { id: string; quiet?: boolean }) => input,
  )
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false, queuedNews: false, warnings: [] as string[] };
    return mod.updateEditionEvent(actor, data);
  });

// ---------------------------------------------------------------- mail

export const adminMailStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MailStatus | null> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return null;
    return mod.mailConfigStatus();
  });

export const adminSetOutboundEmailMode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { mode: "transactional_only" | "all" }) => input)
  .handler(
    async ({ data, context }): Promise<{ ok: boolean; mode: string; detail: string }> => {
      const mod = await import("./admin.server");
      const actor = await mod.adminActor(context.supabase);
      if (!actor) return { ok: false, mode: "transactional_only", detail: "Not permitted." };
      const mode = data.mode === "all" ? "all" : "transactional_only";
      return mod.setOutboundEmailMode(actor, mode);
    },
  );

export const adminTestSend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { email: string }) => input)
  .handler(
    async ({
      data,
      context,
    }): Promise<{ ok: boolean; messageId: string | null; provider: string; detail: string }> => {
      const mod = await import("./admin.server");
      const actor = await mod.adminActor(context.supabase);
      if (!actor)
        return { ok: false, messageId: null, provider: "none", detail: "Not permitted." };
      return mod.sendTestMagicLink(actor, String(data.email ?? "").slice(0, 200));
    },
  );


export const getAuthAttempts = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    return mod.recentAuthAttempts();
  });

/** One-time scheduled campaigns: read the schedule, or stop it before it runs. */
export const adminScheduledCampaigns = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    return mod.listScheduledCampaignsForAdmin();
  });

export const adminCancelScheduledCampaign = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { key: string }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return { ok: false };
    return mod.cancelScheduledCampaignForAdmin(actor, data.key);
  });

/** Targeted resend: an organizer names the exact addresses. Dry run unless
 *  the caller explicitly asks to send. Admin only. */
export const adminTargetedResend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { campaignKey: string; addresses: string; dryRun?: boolean }) => input)
  .handler(async ({ data, context }) => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return null;
    const targeted = await import("./targeted-resend.server");
    const result = await targeted.runTargetedResend({
      campaignKey: data.campaignKey,
      addresses: data.addresses,
      dryRun: data.dryRun !== false,
    });
    if (!result.dryRun) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_log").insert({
        actor_person_id: actor,
        action: "targeted_resend",
        table_name: "sends",
        record_id: null,
        before: null as never,
        after: {
          campaignKey: result.campaignKey,
          sent: result.sent,
          failed: result.failed,
          skipped: result.skipped,
          rows: result.rows,
        } as never,
      });
    }
    return result;
  });

export const adminCampaignKeys = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<string[]> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    const targeted = await import("./targeted-resend.server");
    return targeted.listCampaignKeys();
  });
