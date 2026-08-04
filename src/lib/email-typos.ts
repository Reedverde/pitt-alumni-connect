/** Quiet email hygiene: structural validation plus a nearest-neighbour
 *  domain suggestion. A suggestion is never a block. */

const COMMON_DOMAINS = [
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "hotmail.com",
  "outlook.com",
  "live.com",
  "msn.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "aol.com",
  "comcast.net",
  "verizon.net",
  "att.net",
  "protonmail.com",
  "proton.me",
  "pitt.edu",
];

/** TLD slips we correct outright when the second level name is a known one. */
const BAD_TLDS = ["con", "cmo", "cm", "co", "ocm", "comm", "vom", "xom", "clm", "cin", "om"];

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

/** Exactly one @, a dot in the domain, no spaces, no trailing punctuation. */
export function isStructurallyValidEmail(raw: string) {
  const value = raw.trim();
  if (!value) return false;
  if (/\s/.test(value)) return false;
  if (/[.,;:'"!?-]$/.test(value)) return false;
  const parts = value.split("@");
  if (parts.length !== 2) return false;
  const [local, domain] = parts;
  if (!local || !domain) return false;
  if (/[.]{2}/.test(value)) return false;
  if (local.startsWith(".") || local.endsWith(".")) return false;
  if (domain.startsWith(".") || domain.startsWith("-") || domain.endsWith(".")) return false;
  if (!domain.includes(".")) return false;
  const tld = domain.split(".").pop() ?? "";
  if (tld.length < 2 || !/^[a-z]+$/i.test(tld)) return false;
  return true;
}

/** Returns a corrected address when the domain looks mistyped, else null. */
export function suggestEmailCorrection(raw: string): string | null {
  const value = raw.trim();
  if (!isStructurallyValidEmail(value)) return null;
  const at = value.lastIndexOf("@");
  const local = value.slice(0, at);
  const domain = value.slice(at + 1).toLowerCase();

  if (COMMON_DOMAINS.includes(domain)) return null;

  const dot = domain.lastIndexOf(".");
  const base = domain.slice(0, dot);
  const tld = domain.slice(dot + 1);

  // A known provider with a slipped TLD: gmail.con, yahoo.co, icloud.cm
  if (BAD_TLDS.includes(tld)) {
    const fixed = COMMON_DOMAINS.find((d) => d.slice(0, d.lastIndexOf(".")) === base);
    if (fixed) return `${local}@${fixed}`;
  }

  // A misspelled provider name: gmial.com, yahooo.com, hotmial.com
  let best: { domain: string; distance: number } | null = null;
  for (const candidate of COMMON_DOMAINS) {
    const distance = levenshtein(domain, candidate);
    if (!best || distance < best.distance) best = { domain: candidate, distance };
  }
  if (!best) return null;
  const threshold = domain.length <= 8 ? 1 : 2;
  if (best.distance > 0 && best.distance <= threshold) return `${local}@${best.domain}`;
  return null;
}
