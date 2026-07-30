import type { BoardPerson } from "./board.functions";

export type YearGroup = {
  key: string;
  label: string;
  years: number[];
  latestYear: number;
  people: BoardPerson[];
};

const THIN_YEAR_THRESHOLD = 6;

/** Groups people by board year, merging any year with fewer than 6 people into
 *  an adjacent year so the board never shows a near-empty row. */
export function buildYearGroups(people: BoardPerson[]): YearGroup[] {
  const byYear = new Map<number, BoardPerson[]>();
  for (const person of people) {
    const list = byYear.get(person.board_year) ?? [];
    list.push(person);
    byYear.set(person.board_year, list);
  }

  const years = [...byYear.keys()].sort((a, b) => a - b);
  const runs: number[][] = [];
  let buffer: number[] = [];

  const bufferTotal = () => buffer.reduce((sum, y) => sum + (byYear.get(y) ?? []).length, 0);

  // Accumulate years until a run reaches the threshold. A thin run that runs
  // into a dense year absorbs that year (merge forward) instead of standing
  // alone as an undersized row.
  for (const year of years) {
    buffer.push(year);
    if (bufferTotal() >= THIN_YEAR_THRESHOLD) {
      runs.push(buffer);
      buffer = [];
    }
  }

  // A thin tail merges backward into the previous run; it only stands alone
  // when it is the only run on the board.
  if (buffer.length > 0) {
    if (runs.length > 0) runs[runs.length - 1].push(...buffer);
    else runs.push(buffer);
    buffer = [];
  }

  return runs.map((groupYears) => ({
    key: `y-${groupYears[0]}-${groupYears[groupYears.length - 1]}`,
    label:
      groupYears.length === 1
        ? String(groupYears[0])
        : `${groupYears[0]} – ${groupYears[groupYears.length - 1]}`,
    years: groupYears,
    latestYear: groupYears[groupYears.length - 1],
    people: groupYears.flatMap((y) => byYear.get(y) ?? []).sort(sortByName),
  }));
}

function sortByName(a: BoardPerson, b: BoardPerson) {
  const an = `${a.last_name ?? a.first_name} ${a.first_name}`.toLowerCase();
  const bn = `${b.last_name ?? b.first_name} ${b.first_name}`.toLowerCase();
  return an.localeCompare(bn);
}

export function sortPeopleByName(people: BoardPerson[]) {
  return [...people].sort(sortByName);
}

export const CLAIMED_STATES = new Set(["claimed", "going", "maybe"]);

export function claimedCount(people: BoardPerson[]) {
  return people.filter((p) => CLAIMED_STATES.has(p.state)).length;
}
