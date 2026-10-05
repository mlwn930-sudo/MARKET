/**
 * Measure every condition against ten years of history, for the universe.
 *
 * Built ahead of time and written to a file for the same reason the
 * fundamentals are: a hundred and twenty-three ten-year pulls is minutes
 * of work and several megabytes of candles, and none of it belongs in a
 * request. The page reads the file.
 *
 * Ten years rather than the two the charts use. Two years of daily bars
 * gives three or four golden crosses, and a rate measured on four
 * observations is noise with a percent sign on it. Ten gives enough
 * occurrences for the common conditions to clear the sample floor, and
 * for the rare ones it is honest about still being under it.
 *
 *   npx tsx scripts/build-base-rates.ts            the whole universe
 *   npx tsx scripts/build-base-rates.ts NVDA TTWO  just those
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readBaseRates, type BaseRateRead } from "../src/lib/metrics/base-rates";
import { UNIVERSE } from "../src/lib/universe";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/base-rates/latest.json");

/* Yahoo refuses a default user agent. The same header the price source
   uses, for the same reason. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function history(symbol: string): Promise<Candle[] | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=10y&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const stamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];
    if (!quote || stamps.length === 0) return null;

    const candles: Candle[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];
      // Halts and holidays arrive as null. Carrying the previous price
      // forward would invent trading days and shift every average.
      if (![open, high, low, close].every((v) => Number.isFinite(v))) continue;
      candles.push({
        date: new Date(stamps[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      });
    }
    return candles;
  } catch {
    return null;
  }
}

async function main() {
  const asked = process.argv.slice(2).map((s) => s.toUpperCase());
  const symbols = asked.length
    ? asked
    : UNIVERSE.map((c) => c.ticker);

  const reads: Record<string, BaseRateRead> = {};
  let measured = 0;
  let short = 0;
  let failed = 0;

  for (const symbol of symbols) {
    // Yahoo is not a paid feed and this loop is the only thing asking.
    await sleep(350);
    const candles = await history(symbol);
    if (!candles) {
      failed++;
      process.stdout.write(`${symbol}:fail `);
      continue;
    }

    const read = readBaseRates(symbol, candles);
    if (!read) {
      short++;
      process.stdout.write(`${symbol}:short `);
      continue;
    }

    reads[symbol] = read;
    measured++;
    process.stdout.write(`${symbol} `);
  }

  console.log(
    `\n\n${measured} measured, ${short} too short, ${failed} unreachable\n`,
  );

  if (measured === 0) {
    console.error("nothing measured — leaving any existing file alone");
    process.exit(1);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ builtAt: new Date().toISOString(), reads }, null, 0),
    "utf8",
  );

  console.log(`wrote ${OUT}`);

  /* One line of what was actually learned, because a build that prints
     only counts hides the thing worth knowing: on most names most of
     these conditions do nothing, and the operator should see that. */
  let strong = 0;
  let total = 0;
  for (const read of Object.values(reads)) {
    for (const condition of read.conditions) {
      const o = condition.outcomes.find((x) => x.days === 21);
      if (!o || o.n < 8) continue;
      total++;
      if (Math.abs(o.liftPp) >= 10) strong++;
    }
  }
  console.log(
    `${strong} of ${total} measurable conditions moved the rate by 10pp or more against their own baseline.`,
  );
}

main();
