/** Small, dependency-free fuzzy matching tuned for misspelled surnames
 *  (Thorne, DeGirolamo, McComb, Vatz, Kaczmarek). */

import { equivalentNames } from "./name-equivalence";

export function normalize(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function levenshtein(a: string, b: string) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) {
      row[j] = Math.min(
        prev[j] + 1,
        row[j - 1] + 1,
        prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = row;
  }
  return prev[b.length];
}

function ratio(a: string, b: string) {
  if (!a || !b) return 0;
  const distance = levenshtein(a, b);
  return 1 - distance / Math.max(a.length, b.length);
}

function trigrams(value: string) {
  const padded = `  ${value} `;
  const out = new Set<string>();
  for (let i = 0; i < padded.length - 2; i++) out.add(padded.slice(i, i + 3));
  return out;
}

function trigramSimilarity(a: string, b: string) {
  const ta = trigrams(a);
  const tb = trigrams(b);
  if (!ta.size || !tb.size) return 0;
  let shared = 0;
  for (const g of ta) if (tb.has(g)) shared++;
  return shared / (ta.size + tb.size - shared);
}

/** 0 (no match) to 1 (exact). Compares the whole query against the whole
 *  candidate and each token against each token, taking the best signal. */
export function nameScore(query: string, candidate: string) {
  const q = normalize(query);
  const c = normalize(candidate);
  if (!q || !c) return 0;
  if (c === q) return 1;
  if (c.startsWith(q) || c.includes(` ${q}`)) return 0.95;

  let best = Math.max(ratio(q, c), trigramSimilarity(q, c));
  const qTokens = q.split(" ");
  const cTokens = c.split(" ");
  for (const qt of qTokens) {
    for (const ct of cTokens) {
      if (qt.length < 2 || ct.length < 2) continue;
      let tokenScore = Math.max(ratio(qt, ct), trigramSimilarity(qt, ct));
      if (ct.startsWith(qt)) tokenScore = Math.max(tokenScore, 0.88);
      best = Math.max(best, tokenScore * (qTokens.length > 1 ? 0.9 : 1));
    }
  }
  return best;
}

function damerauRatio(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const al = a.length;
  const bl = b.length;
  const d: number[][] = Array.from({ length: al + 1 }, () => new Array(bl + 1).fill(0));
  for (let i = 0; i <= al; i++) d[i][0] = i;
  for (let j = 0; j <= bl; j++) d[0][j] = j;
  for (let i = 1; i <= al; i++) {
    for (let j = 1; j <= bl; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
      }
    }
  }
  return 1 - d[al][bl] / Math.max(al, bl);
}

function jaroWinkler(a: string, b: string) {
  if (a === b) return 1;
  if (!a || !b) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aFlags = new Array(a.length).fill(false);
  const bFlags = new Array(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    const start = Math.max(0, i - window);
    const end = Math.min(i + window + 1, b.length);
    for (let j = start; j < end; j++) {
      if (bFlags[j] || a[i] !== b[j]) continue;
      aFlags[i] = true;
      bFlags[j] = true;
      matches++;
      break;
    }
  }
  if (!matches) return 0;
  let transpositions = 0;
  let k = 0;
  for (let i = 0; i < a.length; i++) {
    if (!aFlags[i]) continue;
    while (!bFlags[k]) k++;
    if (a[i] !== b[k]) transpositions++;
    k++;
  }
  transpositions /= 2;
  const jaro =
    (matches / a.length + matches / b.length + (matches - transpositions) / matches) / 3;
  let prefix = 0;
  while (prefix < 4 && prefix < a.length && prefix < b.length && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Surname-only similarity. Tolerant of single-character misspellings and
 *  letter transpositions, which is how real surname typos look. */
export function surnameSimilarity(a: string, b: string) {
  const x = normalize(a ?? "");
  const y = normalize(b ?? "");
  if (!x || !y) return 0;
  if (x === y) return 1;
  return Math.max(damerauRatio(x, y), jaroWinkler(x, y), trigramSimilarity(x, y));
}

/** Hard gate applied BEFORE any other duplicate signal. Different surnames are
 *  never duplicate candidates. Short surnames must match exactly, because fuzzy
 *  comparison scores deceptively high on 2 to 4 character strings (Wu vs Xu). */
export function surnameGate(a: string | null | undefined, b: string | null | undefined) {
  const x = normalize(a ?? "");
  const y = normalize(b ?? "");
  if (!x || !y) return false;
  if (x.length < 5 || y.length < 5) return x === y;
  return surnameSimilarity(x, y) >= 0.85;
}

/** nameScore, plus a slightly discounted pass over nickname equivalents of the
 *  query's given-name tokens. Direct matches always outrank equivalence ones. */
export function nameScoreWithNicknames(query: string, candidate: string) {
  const direct = nameScore(query, candidate);
  if (direct >= 1) return direct;
  const tokens = normalize(query).split(" ").filter(Boolean);
  let best = direct;
  for (let i = 0; i < tokens.length; i++) {
    for (const alt of equivalentNames(tokens[i])) {
      if (alt === tokens[i]) continue;
      const variant = tokens.slice();
      variant[i] = alt;
      const score = nameScore(variant.join(" "), candidate) * 0.99;
      if (score > best) best = score;
    }
  }
  return best;
}