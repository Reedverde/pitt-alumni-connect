import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { EditionSummary } from "./edition-format";

export type BoardPerson = {
  id: string;
  first_name: string;
  last_name: string | null;
  played_as: string | null;
  deceased: boolean;
  board_year: number;
  board_division: string | null;
  team_label: string | null;
  state: "unclaimed" | "claimed" | "going" | "maybe" | "memorial";
};

export type BoardData = {
  people: BoardPerson[];
  totals: { total: number; claimed: number; going: number };
  divisions: { code: string; label: string }[];
  edition: EditionSummary;
  nextEdition: EditionSummary | null;
};

export const getBoard = createServerFn({ method: "GET" }).handler(async (): Promise<BoardData> => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

  const { loadCurrentEdition, loadNextPublishedEdition } = await import("./editions.server");
  const current = await loadCurrentEdition();
  const next = await loadNextPublishedEdition(current.event_year);

  const [peopleRes, countsRes, divisionsRes] = await Promise.all([
    supabase
      .from("board_people")
      .select("id, first_name, last_name, played_as, deceased, board_year, board_division, team_label, state")
      .order("board_year", { ascending: false })
      .limit(2000),
    supabase.from("board_year_counts").select("board_year, total, claimed, going"),
    supabase.from("divisions").select("code, label, sort_order, visible").eq("visible", true),
  ]);

  if (peopleRes.error) throw peopleRes.error;
  if (countsRes.error) throw countsRes.error;

  const totals = (countsRes.data ?? []).reduce(
    (acc, row) => ({
      total: acc.total + (row.total ?? 0),
      claimed: acc.claimed + (row.claimed ?? 0),
      going: acc.going + (row.going ?? 0),
    }),
    { total: 0, claimed: 0, going: 0 },
  );

  const divisions = (divisionsRes.data ?? [])
    .slice()
    .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
    .map((d) => ({ code: d.code as string, label: (d.label as string) ?? (d.code as string) }));

  const edition: EditionSummary = {
    event_year: current.event_year,
    title: current.title,
    starts_on: current.starts_on,
    ends_on: current.ends_on,
  };

  return {
    people: (peopleRes.data ?? []) as BoardPerson[],
    totals,
    divisions,
    edition,
    nextEdition: next
      ? {
          event_year: next.event_year,
          title: next.title,
          starts_on: next.starts_on,
          ends_on: next.ends_on,
        }
      : null,
  };
});
