import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

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
};

export const getBoard = createServerFn({ method: "GET" }).handler(async (): Promise<BoardData> => {
  const supabase = createClient<Database>(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    { auth: { storage: undefined, persistSession: false, autoRefreshToken: false } },
  );

  const [peopleRes, countsRes] = await Promise.all([
    supabase
      .from("board_people")
      .select("id, first_name, last_name, played_as, deceased, board_year, board_division, team_label, state")
      .order("board_year", { ascending: false })
      .limit(2000),
    supabase.from("board_year_counts").select("board_year, total, claimed, going"),
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

  return { people: (peopleRes.data ?? []) as BoardPerson[], totals };
});
