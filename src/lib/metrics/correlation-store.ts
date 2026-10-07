import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { CorrelationFile } from "./correlation";

/**
 * The one file that reads the correlation matrix off disk.
 *
 * Same boundary as `rank-store.ts` and for the same reason: `correlation.ts`
 * is arithmetic and imports nothing from Node, so it is safe in a browser
 * bundle; this touches the filesystem and is not. The scar behind the rule
 * is in `base-rate-store.ts` — one client component importing a helper
 * that happened to live beside a file read dragged `node:fs/promises` into
 * the browser bundle and sixteen routes returned 500.
 */

const FILE = resolve(process.cwd(), "content/correlation/latest.json");

let cached: CorrelationFile | null = null;
let cachedAt = 0;
const TTL = 60_000;

export async function getCorrelations(): Promise<CorrelationFile | null> {
  if (cached && Date.now() - cachedAt < TTL) return cached;
  try {
    const raw = await readFile(FILE, "utf8");
    const parsed = JSON.parse(raw) as CorrelationFile;
    if (!Array.isArray(parsed?.symbols) || !Array.isArray(parsed?.matrix)) {
      return null;
    }
    cached = parsed;
    cachedAt = Date.now();
    return parsed;
  } catch {
    /* No file is a normal state: the matrix is built by a scheduled job,
       and a clone that has never run it should show the portfolio page it
       has always had rather than an error. */
    return null;
  }
}
