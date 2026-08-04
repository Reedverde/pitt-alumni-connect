/** Shared three-tier name matching used by the board search and the claim
 *  dialog, so the two can never drift.
 *
 *  Tier 0  direct substring
 *  Tier 1  nickname equivalence (given names only)
 *  Tier 2  fuzzy, by edit distance against individual name parts
 */
import { equivalentNames } from "./name-equivalence";

export const TIER_DIRECT = 0;
export const TIER_EQUIVALENT = 1;
export const TIER_FUZZY = 2;
export type MatchTier = 0 | 1 | 2;

export function normalizeName(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function tokenizeQuery(query: string) {
  return normalizeName(query).split(" ").filter(Boolean);
}

/** Name parts are split on whitespace AND hyphens, so Ranii-Dropcho is two
 *  comparable parts rather than one long one. */
function nameParts(value: string) {
  return value.split(/[^a-z0-9]+/).filter(Boolean);
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = row;
  }
  return prev[b.length];
}

/** Tight budget. Tokens of three characters or fewer never fuzzy match, so
 *  "ben" can never reach "ken". */
function allowedDistance(token: string, part: string) {
  if (token.length <= 3) return -1;
  return Math.max(token.length, part.length) >= 7 ? 2 : 1;
}

export type Candidate = {
  first_name: string;
  last_name?: string | null;
  played_as?: string | null;
};

function haystacks(person: Candidate) {
  const full = normalizeName(
    [person.first_name, person.last_name, person.played_as].filter(Boolean).join(" "),
  );
  // Nickname equivalence applies to given names only, never surnames.
  const given = normalizeName([person.first_name, person.played_as].filter(Boolean).join(" "));
  return { full, given, parts: nameParts(full) };
}

function tokenTier(
  token: string,
  h: { full: string; given: string; parts: string[] },
): MatchTier | null {
  if (h.full.includes(token)) return TIER_DIRECT;
  if (equivalentNames(token).some((alt) => new RegExp(`(^| )${alt}`).test(h.given)))
    return TIER_EQUIVALENT;
  for (const part of h.parts) {
    // The first character must agree. Kills most false positives for free.
    if (part[0] !== token[0]) continue;
    const budget = allowedDistance(token, part);
    if (budget < 1) continue;
    if (levenshtein(token, part) <= budget) return TIER_FUZZY;
  }
  return null;
}

/** The tier a person matches at, or null. A person's tier is the worst tier any
 *  of its tokens needed, and at most ONE token may be satisfied fuzzily. */
export function matchTier(
  tokens: string[],
  person: Candidate,
  opts: { allowFuzzy?: boolean } = {},
): MatchTier | null {
  if (tokens.length === 0) return TIER_DIRECT;
  const allowFuzzy = opts.allowFuzzy !== false;
  const h = haystacks(person);
  let worst: MatchTier = TIER_DIRECT;
  let fuzzyUsed = 0;
  for (const token of tokens) {
    const tier = tokenTier(token, h);
    if (tier === null) return null;
    if (tier === TIER_FUZZY) {
      if (!allowFuzzy) return null;
      fuzzyUsed += 1;
      if (fuzzyUsed > 1) return null;
    }
    if (tier > worst) worst = tier;
  }
  return worst;
}

/** Runs the tiers in order and only pays for the fuzzy pass when the direct and
 *  equivalence tiers came up thin. Results are ordered by tier, never
 *  interleaved; `order` breaks ties within a tier. */
export function rankMatches<T extends Candidate>(
  query: string,
  people: T[],
  opts: { fuzzyBelow?: number } = {},
): { item: T; tier: MatchTier }[] {
  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return people.map((item) => ({ item, tier: TIER_DIRECT as MatchTier }));
  const fuzzyBelow = opts.fuzzyBelow ?? 5;

  const strict: { item: T; tier: MatchTier }[] = [];
  const rest: T[] = [];
  for (const item of people) {
    const tier = matchTier(tokens, item, { allowFuzzy: false });
    if (tier === null) rest.push(item);
    else strict.push({ item, tier });
  }

  if (strict.length >= fuzzyBelow) return sortByTier(strict);

  const fuzzy: { item: T; tier: MatchTier }[] = [];
  for (const item of rest) {
    const tier = matchTier(tokens, item);
    if (tier !== null) fuzzy.push({ item, tier });
  }
  return [...sortByTier(strict), ...fuzzy];
}

function sortByTier<T>(rows: { item: T; tier: MatchTier }[]) {
  return rows.slice().sort((a, b) => a.tier - b.tier);
}
