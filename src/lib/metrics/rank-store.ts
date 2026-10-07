import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { RankFile, RankRead } from "./rank";

/**
 * The one file in the project that reads the ranking off disk.
 *
 * Separated from `rank.ts` on purpose, and the purpose has a scar behind
 * it. `base-rate-store.ts` once held two things that looked related — the
 * function that reads a measurement off disk and the function that turns
 * its figures into a sentence — and a client component importing the
 * second dragged `node:fs/promises` into the browser bundle. Webpack
 * refuses the scheme, the module fails to build, and sixteen of eighteen
 * routes returned 500 for two commits before anyone loaded a page.
 *
 * So the rule is a file boundary rather than a convention: arithmetic and
 * labels live in `rank.ts`, which imports nothing from Node and is safe
 * anywhere; this file touches the filesystem and is safe only on the
 * server. Nothing that renders may import this one.
 */

const FILE = resolve(process.cwd(), "content/ranks/latest.json");

let cached: RankFile | null = null;
let cachedAt = 0;

/** A minute. The file is rewritten once a night, so this is not about
 *  freshness — it is about not reading and parsing the same megabyte for
 *  every company card on a page that lists sixteen of them. */
const TTL = 60_000;

export async function getRanks(): Promise<RankFile | null> {
  if (cached && Date.now() - cachedAt < TTL) return cached;
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as RankFile;
    if (!parsed?.reads || typeof parsed.universe !== "number") return null;
    cached = parsed;
    cachedAt = Date.now();
    return parsed;
  } catch {
    /* No file is a normal state, not an error: the ranking is built by a
       scheduled job, and a clone that has never run it should render the
       site with "not ranked" rather than with a stack trace. */
    return null;
  }
}

export async function rankFor(symbol: string): Promise<RankRead | null> {
  const file = await getRanks();
  return file?.reads[symbol.toUpperCase()] ?? null;
}
