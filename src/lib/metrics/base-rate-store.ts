import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BaseRateRead } from "./base-rates";

/**
 * The measured file, read back. Nothing else lives here.
 *
 * It also held the function that turns a row of figures into a sentence,
 * which needed no filesystem and was imported by a client component — so
 *  went into the browser bundle and sixteen of eighteen pages
 * returned a 500. The sentence moved to  beside the numbers
 * it describes; this file is the only thing in the project that reads the
 * measurement off disk, and that is now the whole of it.
 *
 * The file is written by `scripts/build-base-rates.ts` on a schedule. The
 * site never measures during a request: ten years of candles for a
 * hundred and twenty-three names is minutes of work.
 */

type File = { builtAt: string; reads: Record<string, BaseRateRead> };

let cache: File | null = null;

export async function getBaseRates(): Promise<File> {
  if (cache) return cache;
  try {
    const raw = await readFile(
      join(process.cwd(), "content/base-rates/latest.json"),
      "utf8",
    );
    cache = JSON.parse(raw) as File;
  } catch {
    cache = { builtAt: "", reads: {} };
  }
  return cache;
}

/**
 * Trading days the file may fall behind before it is saying something
 * false rather than something old.
 *
 * `activeNow` means "this condition fired on the LAST bar". One stale
 * session makes that claim wrong by a day; a week of them makes it a
 * different stock. Three is the width of a long weekend plus a failed
 * run, which is the gap worth tolerating in silence.
 */
const STALE_AFTER_DAYS = 5;

export async function baseRatesFor(
  ticker: string,
): Promise<BaseRateRead | null> {
  const file = await getBaseRates();
  const read = file.reads[ticker.toUpperCase()] ?? null;
  if (!read) return null;

  /* A STALE FILE USED TO LOOK EXACTLY LIKE A FRESH ONE.
     Measured on 2026-10-25: nothing in the repository ran
     `build:baserates`, the file was seventeen days old, and every page
     quoted it as current — "no measured condition fired on the last
     bar" on 35 names where one had. The age was in the file the whole
     time and no reader could see it. It rides out as a caveat now, so
     the panels that already print caveats say it on their own. */
  const age = sessionsSince(read.to);
  if (age !== null && age > STALE_AFTER_DAYS) {
    return {
      ...read,
      caveats: [
        `שיעורי הבסיס נספרו עד ${read.to}, שהם כ-${age} ימי מסחר אחורה. ` +
          "״תנאי שפעל בנר האחרון״ מתייחס לנר ההוא ולא להיום, והבנייה " +
          "הלילית כנראה לא רצה.",
        ...(read.caveats ?? []),
      ],
    };
  }
  return read;
}

/** Rough trading days between a date and today. Weekends removed,
 *  holidays not — close enough to decide whether a file is days or
 *  weeks behind, which is the only question being asked. */
function sessionsSince(date: string): number | null {
  const then = Date.parse(`${date}T00:00:00Z`);
  if (Number.isNaN(then)) return null;
  const days = Math.floor((Date.now() - then) / 86_400_000);
  if (days <= 0) return 0;
  return days - Math.floor(days / 7) * 2;
}
