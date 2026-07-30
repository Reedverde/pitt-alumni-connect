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
  const groups: YearGroup[] = [];
  let buffer: number[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const groupYears = [...buffer];
    const groupPeople = groupYears.flatMap((y) => byYear.get(y) ?? []);
    groups.push({
      key: `y-${groupYears[0]}-${groupYears[groupYears.length - 1]}`,
      label:
        groupYears.length === 1
          ? String(groupYears[0])
          : `${groupYears[0]} – ${groupYears[groupYears.length - 1]}`,
      years: groupYears,
      latestYear: groupYears[groupYears.length - 1],
      people: groupPeople.sort(sortByName),
    });
    buffer = [];
  };

  for (const year of years) {
    const count = (byYear.get(year) ?? []).length;
    if (count >= THIN_YEAR_THRESHOLD) {
      flush();
      buffer = [year];
      flush();
      continue;
    }
    buffer.push(year);
    const bufferTotal = buffer.reduce((sum, y) => sum + (byYear.get(y) ?? []).length, 0);
    if (bufferTotal >= THIN_YEAR_THRESHOLD) flush();
  }
  flush();

  return groups;
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
