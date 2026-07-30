import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type Edition = {
  event_year: number;
  title: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  published: boolean;
  lodging_note: string | null;
  travel_note: string | null;
};

const EDITION_COLUMNS =
  "event_year, title, starts_on, ends_on, is_current, published, lodging_note, travel_note";

/** The single row with is_current. A database constraint guarantees there is at most one. */
export async function loadCurrentEdition(): Promise<Edition> {
  const { data, error } = await supabaseAdmin
    .from("editions")
    .select(EDITION_COLUMNS)
    .eq("is_current", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("No current edition is set.");
  return data as Edition;
}

/** event_year of the current edition. Never a literal in code. */
export async function currentEditionYear(): Promise<number> {
  return (await loadCurrentEdition()).event_year;
}

/** The next published edition after a year, used once the current one has ended. */
export async function loadNextPublishedEdition(afterYear: number): Promise<Edition | null> {
  const { data } = await supabaseAdmin
    .from("editions")
    .select(EDITION_COLUMNS)
    .eq("published", true)
    .gt("event_year", afterYear)
    .order("event_year", { ascending: true })
    .limit(1)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

export async function loadEdition(eventYear: number): Promise<Edition | null> {
  const { data } = await supabaseAdmin
    .from("editions")
    .select(EDITION_COLUMNS)
    .eq("event_year", eventYear)
    .maybeSingle();
  return (data as Edition | null) ?? null;
}

export async function loadEditions(): Promise<Edition[]> {
  const { data, error } = await supabaseAdmin
    .from("editions")
    .select(EDITION_COLUMNS)
    .order("event_year", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as Edition[];
}

/** going counts per edition year, straight out of rsvps. No snapshot table. */
export async function goingCounts(): Promise<Map<number, number>> {
  const { data } = await supabaseAdmin.from("rsvps").select("event_year, status").eq("status", "going");
  const counts = new Map<number, number>();
  for (const row of data ?? []) {
    const y = row.event_year as number;
    counts.set(y, (counts.get(y) ?? 0) + 1);
  }
  return counts;
}

/** First weekend of October: Friday through Sunday. */
export function firstOctoberWeekend(year: number): { starts_on: string; ends_on: string } {
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  const oct1 = new Date(Date.UTC(year, 9, 1));
  // Walk forward to the first Friday on or after Oct 1.
  const friday = new Date(oct1);
  friday.setUTCDate(oct1.getUTCDate() + ((5 - oct1.getUTCDay() + 7) % 7));
  const sunday = new Date(friday);
  sunday.setUTCDate(friday.getUTCDate() + 2);
  return { starts_on: iso(friday), ends_on: iso(sunday) };
}
