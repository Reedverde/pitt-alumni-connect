import { createServerFn } from "@tanstack/react-start";

import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  AdminDashboard,
  AdminPerson,
  PeopleFilter,
  RosterLine,
} from "./admin.server";

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
  .inputValidator(
    (input: { query?: string; filter?: PeopleFilter; division?: string | null }) => input,
  )
  .handler(async ({ data, context }): Promise<AdminPerson[]> => {
    const mod = await import("./admin.server");
    const actor = await mod.adminActor(context.supabase);
    if (!actor) return [];
    return mod.listPeople({
      query: String(data.query ?? "").slice(0, 120),
      filter: (data.filter ?? "all") as PeopleFilter,
      division: data.division ?? null,
    });
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
