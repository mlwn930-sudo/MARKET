/**
 * Rank the universe against itself, once a night.
 *
 * A rank cannot be computed inside a request. It needs every name's price
 * history at once, and pulling a hundred and twenty-three series to render
 * one company page would be slow, rude to the source and wrong — ranks
 * taken at different moments are not comparable. So it is built ahead of
 * time, on one date, and the page reads the file.
 *
 * ALL OR NOTHING ON THE DATE. If a name's last candle is older than the
 * rest, it is left out of the ranking rather than ranked on stale data.
 * A ranking is a comparison, and a comparison between Friday's close and
 * Tuesday's is not one.
 *
 *   npx tsx scripts/build-ranks.ts
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rankUniverse } from "../src/lib/metrics/rank";
import { buildCorrelations } from "../src/lib/metrics/correlation";
import { UNIVERSE } from "../src/lib/universe";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/ranks/latest.json");
/* A separate file from the ranks. The matrix is 123x123 and the ranks are
   read on every company page; keeping them together would make every one
   of those reads parse forty kilobytes it has no use for. */
const CORRELATION_OUT = resolve(ROOT, "content/correlation/latest.json");

/* Yahoo refuses a default user agent. The same header the price source
   uses, for the same reason. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
};

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Two years, which is more than the longest window needs.
 *
 * The score reaches back 252 sessions and the ranking needs every name to
 * clear that. Asking for exactly a year would leave no margin for the
 * holidays and halts that get dropped below, and a name that came up four
 * sessions short would silently fall out of the universe.
 */
async function history(symbol: string, attempt = 0): Promise<Candle[] | null> {
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}` +
    `?range=2y&interval=1d`;

  try {
    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(30_000),
    });
    /* Yahoo throttles datacentre addresses far harder than home ones, and
       a 429 is the most recoverable error there is — the same backoff the
       scanner learned to need. */
    if (res.status === 429 && attempt < 3) {
      await sleep(2_000 * (attempt + 1));
      return history(symbol, attempt + 1);
    }
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
      /* Halts and holidays arrive as null. Carrying the previous price
         forward would invent trading days and shift every window. */
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
  const symbols = asked.length ? asked : UNIVERSE.map((c) => c.ticker);

  const series = new Map<string, Candle[]>();
  let failed = 0;

  for (const symbol of symbols) {
    await sleep(350);
    const candles = await history(symbol);
    if (!candles || candles.length < 60) {
      failed++;
      process.stdout.write(`${symbol}:fail `);
      continue;
    }
    series.set(symbol, candles);
    process.stdout.write(`${symbol} `);
  }

  console.log(`\n\n${series.size} pulled, ${failed} unreachable`);

  if (series.size < 20) {
    console.error(
      "fewer than twenty names — a rank over this is not a rank, leaving any existing file alone",
    );
    process.exit(1);
  }

  /* The common date. Anything whose last candle is behind it is dropped
     before ranking rather than compared across days. */
  const dates = [...series.values()].map((c) => c[c.length - 1].date);
  const latest = dates.sort().at(-1)!;
  let stale = 0;
  for (const [symbol, candles] of [...series]) {
    if (candles[candles.length - 1].date !== latest) {
      series.delete(symbol);
      stale++;
    }
  }
  if (stale) console.log(`${stale} dropped for not closing on ${latest}`);

  const ranked = rankUniverse(series);

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify({ builtAt: new Date().toISOString(), ...ranked }, null, 0),
    "utf8",
  );
  console.log(`wrote ${OUT}`);

  /* The correlation matrix, from the same candles. Two years of weekly
     returns for every pair, which is the only expensive thing this script
     does that is not a network request — and it is free here because
     nothing else in the project holds all 123 series at once. */
  const correlations = buildCorrelations(series);
  await mkdir(dirname(CORRELATION_OUT), { recursive: true });
  await writeFile(
    CORRELATION_OUT,
    JSON.stringify({ builtAt: new Date().toISOString(), ...correlations }, null, 0),
    "utf8",
  );
  console.log(
    `wrote ${CORRELATION_OUT} (${correlations.symbols.length} names, ` +
      `thinnest pair ${correlations.weeks} shared weeks)`,
  );

  /* What was actually learned, printed, because a build that reports only
     counts hides the thing worth seeing. */
  const rows = Object.values(ranked.reads)
    .filter((r) => r.strengthRank !== null)
    .sort((a, b) => (b.strengthRank ?? 0) - (a.strengthRank ?? 0));
  console.log(
    `\nranked ${ranked.universe} on ${ranked.asOf}` +
      `\nstrongest: ${rows.slice(0, 5).map((r) => `${r.symbol} ${r.strengthRank}`).join(", ")}` +
      `\nweakest:   ${rows.slice(-5).map((r) => `${r.symbol} ${r.strengthRank}`).join(", ")}`,
  );
  const strong = rows.filter((r) => (r.strengthRank ?? 0) >= 70).length;
  console.log(
    `${strong} of ${rows.length} clear the trend template's eighth criterion (rank 70+).`,
  );
}

main();
