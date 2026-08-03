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
  is_current: boolean;
  is_coach: boolean;
  /** Only set for the coaches and managers row: which word the chip tag shows. */
  role_label?: "coach" | "manager";
  /** Every program the person holds history in, for filtering only. The chip's
   *  team badge still resolves from board_division. */
  divisions: string[];
  state: "unclaimed" | "claimed" | "going" | "maybe" | "memorial";
};

export type BoardPhoto = {
  storage_path: string;
  alt: string | null;
  width: number | null;
  height: number | null;
};

export type BoardData = {
  people: BoardPerson[];
  /** Coach-only people with no board year: they pin to their own row. */
  coaches: BoardPerson[];
  totals: { total: number; claimed: number; going: number };
  divisions: { code: string; label: string }[];
  edition: EditionSummary;
  nextEdition: EditionSummary | null;
  /** One photograph per tagged year: the earliest uploaded one wins. */
  photosByYear: Record<string, BoardPhoto>;
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

  const [peopleRes, countsRes, divisionsRes, photosRes, coachesRes] = await Promise.all([
    supabase
      .from("board_people")
      .select(
        "id, first_name, last_name, played_as, deceased, board_year, board_division, team_label, state, is_current, is_coach, divisions",
      )
      .order("board_year", { ascending: false })
      .limit(2000),
    supabase.from("board_year_counts").select("board_year, total, claimed, going"),
    supabase.from("divisions").select("code, label, sort_order, visible").eq("visible", true),
    supabase
      .from("photos")
      .select("storage_path, alt, width, height, board_year, uploaded_at")
      .not("board_year", "is", null)
      .order("board_year", { ascending: true })
      .order("uploaded_at", { ascending: true }),
    supabase
      .from("board_coaches")
      .select("id, first_name, last_name, played_as, deceased, state, role_label")
      .limit(200),
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

  const photosByYear: Record<string, BoardPhoto> = {};
  for (const row of photosRes.data ?? []) {
    const year = String(row.board_year);
    if (photosByYear[year]) continue;
    photosByYear[year] = {
      storage_path: row.storage_path as string,
      alt: (row.alt as string | null) ?? null,
      width: (row.width as number | null) ?? null,
      height: (row.height as number | null) ?? null,
    };
  }

  const edition: EditionSummary = {
    event_year: current.event_year,
    title: current.title,
    starts_on: current.starts_on,
    ends_on: current.ends_on,
    published: current.published,
    lodging_note: current.lodging_note,
    travel_note: current.travel_note,
  };

  return {
    people: ((peopleRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      ...(row as unknown as BoardPerson),
      divisions: ((row.divisions as string[] | null) ?? []) as string[],
    })),
    coaches: ((coachesRes.data ?? []) as Array<Record<string, unknown>>).map((row) => ({
      id: row.id as string,
      first_name: row.first_name as string,
      last_name: (row.last_name as string | null) ?? null,
      played_as: (row.played_as as string | null) ?? null,
      deceased: Boolean(row.deceased),
      board_year: 0,
      board_division: null,
      team_label: null,
      is_current: false,
      is_coach: true,
      divisions: [],
      role_label: row.role_label === "manager" ? "manager" : "coach",
      state: row.state as BoardPerson["state"],
    })),
    totals,
    divisions,
    edition,
    photosByYear,
    nextEdition: next
      ? {
          event_year: next.event_year,
          title: next.title,
          starts_on: next.starts_on,
          ends_on: next.ends_on,
          published: next.published,
        }
      : null,
  };
});
