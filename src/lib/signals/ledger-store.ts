import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { LedgerEntry, LedgerFile } from "./ledger";

/**
 * The ledger, read off disk. Server only.
 *
 * Its own file for the reason every store in this project has one: a
 * client component that imported a store once dragged
 * `node:fs/promises` into the browser bundle and five hundred'd sixteen
 * of eighteen routes. `ledger.ts` is pure arithmetic and safe anywhere;
 * this touches the filesystem.
 */

export async function getLedger(): Promise<LedgerFile | null> {
  try {
    const raw = await readFile(
      resolve(process.cwd(), "content/signals/ledger.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as LedgerFile;
    if (!Array.isArray(parsed?.entries)) return null;
    return parsed;
  } catch {
    /* Absent until the first nightly run writes it. The panel says the
       record has not started rather than rendering a zero, which reads
       as "nothing worked". */
    return null;
  }
}

/** The most recently resolved stances, newest first. The scorecard is a
 *  single number; this is what it is made of, and a reader who cannot
 *  see the rows has been asked to trust an average. */
export function recentlyResolved(
  entries: LedgerEntry[],
  limit = 12,
): LedgerEntry[] {
  return entries
    .filter((e) => e.resolvedAt)
    .sort((a, b) => (a.resolvedAt! < b.resolvedAt! ? 1 : -1))
    .slice(0, limit);
}
