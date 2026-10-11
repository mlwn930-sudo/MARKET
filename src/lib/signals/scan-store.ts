import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { ConditionCite, StanceDirection, StanceHorizon } from "@/lib/analysis/stance";

/**
 * The daily scan, read off disk.
 *
 * Server only, and in its own file for the reason `rank-store.ts` is:
 * a client component that imported a store once dragged
 * `node:fs/promises` into the browser bundle and five hundred'd sixteen
 * of eighteen routes. Arithmetic and labels live in `stance.ts`, which
 * imports nothing from Node; this touches the filesystem.
 *
 * The file is written by `scripts/build-ranks.ts`, which is the only
 * place in the project holding every name's candles at once — so the
 * scan costs no requests of its own.
 */

export type ScanHorizon = {
  horizon: StanceHorizon;
  direction: StanceDirection;
  lead: ConditionCite | null;
  against: string | null;
  ends: string | null;
};

export type ScanName = {
  symbol: string;
  asOf: string;
  lastClose: number;
  /** Only the horizons that have a direction. A name with none is not in
   *  the file at all. */
  horizons: ScanHorizon[];
};

export type ScanFile = {
  builtAt: string;
  asOf: string;
  /**
   * How many names were measured, and how many produced a direction.
   *
   * BOTH, ALWAYS. A count with no denominator beside it is a
   * leaderboard, and this is not one: the first real run produced 21 of
   * 123, and a comparable number will appear every day whatever the
   * market did. The pair is what makes the list a filter rather than a
   * finding.
   */
  universe: number;
  withDirection: number;
  /**
   * The session this was compared against, and the difference.
   *
   * The list of what fired today answers a question nobody asks twice.
   * Somebody opening the page every morning wants the difference, and
   * that is the whole reason to look daily.
   *
   * `previousAsOf` is null before the second run ever happens, and the
   * page says the comparison is not available rather than rendering
   * three empty lists, which read as "nothing moved".
   */
  previousAsOf?: string | null;
  entered?: string[];
  left?: string[];
  /** Present on both days with a different set of directions — the
   *  turn, which is the one a holder cares about most. */
  flipped?: { symbol: string; from: string; to: string }[];
  names: ScanName[];
};

export async function getScan(): Promise<ScanFile | null> {
  try {
    const raw = await readFile(
      resolve(process.cwd(), "content/signals/scan.json"),
      "utf8",
    );
    const parsed = JSON.parse(raw) as ScanFile;
    if (!Array.isArray(parsed?.names)) return null;
    return parsed;
  } catch {
    /* Absent before the first nightly run, and the page says so rather
       than rendering an empty list that looks like a quiet market. */
    return null;
  }
}
