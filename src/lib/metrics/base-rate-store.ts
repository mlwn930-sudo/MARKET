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

export async function baseRatesFor(
  ticker: string,
): Promise<BaseRateRead | null> {
  const file = await getBaseRates();
  return file.reads[ticker.toUpperCase()] ?? null;
}
