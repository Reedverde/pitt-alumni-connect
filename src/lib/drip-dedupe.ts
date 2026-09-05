/**
 * One mailbox, one copy.
 *
 * Two alumni records can legitimately share an address (a couple, an old work
 * address kept on both), and a run that was resumed must not write to an
 * address this campaign already reached. The mailbox, not the record, is what
 * receives the mail, so deduplication happens on the normalized address.
 *
 * Kept free of any database or network access so the rule can be tested on its
 * own and reused by the dispatcher without ceremony.
 */

export function normalizeEmail(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

export function dedupeAddresses<T extends { email: string }>(
  rows: T[],
  alreadyEmailed: Set<string>,
): { keep: T[]; skipped: number } {
  const seen = new Set(alreadyEmailed);
  const keep: T[] = [];
  let skipped = 0;
  for (const row of rows) {
    const address = normalizeEmail(row.email);
    if (!address || seen.has(address)) {
      skipped += 1;
      continue;
    }
    seen.add(address);
    keep.push(row);
  }
  return { keep, skipped };
}
