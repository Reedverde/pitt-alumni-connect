/** Small, dependency-free fuzzy matching tuned for misspelled surnames
 *  (Thorne, DeGirolamo, McComb, Vatz, Kaczmarek). */

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