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
import { writeFile, mkdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { rankUniverse } from "../src/lib/metrics/rank";
import { buildCorrelations } from "../src/lib/metrics/correlation";
import { readSetup } from "../src/lib/analysis/setup";
import { buildChartStance } from "../src/lib/analysis/stance";
import { compareScans } from "../src/lib/signals/scan-diff";
import {
  recordStances,
  resolveEntries,
  scoreLedger,
} from "../src/lib/signals/ledger";
import type { LedgerEntry, StanceToRecord } from "../src/lib/signals/ledger";
import { baseRatesFor } from "../src/lib/metrics/base-rate-store";
import { UNIVERSE } from "../src/lib/universe";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/ranks/latest.json");
/* A separate file from the ranks. The matrix is 123x123 and the ranks are
   read on every company page; keeping them together would make every one
   of those reads parse forty kilobytes it has no use for. */
const CORRELATION_OUT = resolve(ROOT, "content/correlation/latest.json");
/* The daily scan. Written here because this is the one place in the
   project that already holds every name's candles at once — computing
   it anywhere else would mean 123 more price requests for figures that
   are sitting in memory. */
const SCAN_OUT = resolve(ROOT, "content/signals/scan.json");
const LEDGER_OUT = resolve(ROOT, "content/signals/ledger.json");

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

  /* ---- The daily scan ----

     Every name in the universe put through the same function the chart
     reader uses, from the candles already in memory. The point is not
     to find the best stock; it is to answer, once a day, which names
     had a counted condition fire with a sample and a gap worth
     printing.

     EXPECT ROUGHLY TWENTY, EVERY DAY. Measured on the first real run:
     21 of 123. `measure-selection.ts` implied ten, and the difference
     is that it measured one horizon while a name lands here when
     either fires. So this file is a FILTER and not a discovery, and
     the stored denominator is what keeps it honest — a list of names
     with no 'out of 123' beside it is a leaderboard. */
  type ScanRow = {
    symbol: string;
    asOf: string;
    lastClose: number;
    horizons: { horizon: string; direction: string }[];
  };
  const scanned: ScanRow[] = [];
  /* The same stances, in the shape the ledger records. Collected here
     rather than derived from `scanned` because the scan file keeps only
     the lead condition's headline and the ledger needs its sample and
     its baseline to score itself later. */
  const taken: StanceToRecord[] = [];
  let withDirection = 0;
  for (const [symbol, candles] of series) {
    const rates = await baseRatesFor(symbol).catch(() => null);
    if (!rates) continue;
    /* From the object just computed above, not from the stored file:
       the file on disk is yesterday's until this script finishes
       writing it, and a scan that ranked today's candles against
       yesterday's universe would be wrong in a way nothing reports. */
    const rank = ranked.reads[symbol] ?? null;
    const setup = readSetup(symbol, candles, rates, rank);
    const stance = buildChartStance({
      setup,
      baseRates: rates,
      lastClose: candles[candles.length - 1].close,
    });
    if (!stance) continue;
    const live = [stance.swing, stance.position].filter(
      (h) => h.direction !== "none",
    );
    if (live.length === 0) continue;
    withDirection++;
    for (const h of live) {
      const lead = h.agreeing[0] ?? null;
      taken.push({
        symbol,
        asOf: h.asOf,
        horizon: h.horizon,
        horizonDays: h.horizonDays,
        direction: h.direction as "up" | "down" | "split",
        closeAt: h.lastClose,
        leadKey: lead?.key ?? null,
        leadLabel: lead?.label ?? null,
        leadN: lead?.n ?? null,
        upShareHist: lead?.upShareHist ?? null,
        baselineUpShare: lead?.baselineUpShare ?? null,
      });
    }
    scanned.push({
      symbol,
      asOf: stance.swing.asOf,
      lastClose: stance.swing.lastClose,
      horizons: live.map((h) => ({
        horizon: h.horizon,
        direction: h.direction,
        /* The lead condition only. The panel can load the rest; a scan
           file that carried every cite for every name would be a
           megabyte of JSON for a list nobody reads in full. */
        lead: h.agreeing[0] ?? null,
        against: h.against[0] ?? null,
        ends: h.route.find((r) => r.kind === "end")?.label ?? null,
      })),
    });
  }

  /* ---- What changed since the previous session ----

     The list of what fired today answers a question nobody asks twice.
     Somebody opening this page every morning wants the difference: who
     is here that was not here yesterday, who dropped off, and who
     turned around. That is the whole reason to look daily.

     Computed by reading the file about to be overwritten, which is
     cheap and keeps the comparison in the one place that can be sure
     both sides were produced the same way.

     THE SAME-SESSION RE-RUN IS THE CASE THAT GETS THIS WRONG. Run the
     script twice in a day and a naive diff compares today against
     today, reports nothing changed, and silently erases a real
     morning's movement. So when the stored scan is already on this
     session, its comparison is carried forward untouched rather than
     recomputed against itself. */
  /* The comparison, from the file about to be overwritten. Extracted to
     `scan-diff.ts` because the same-session re-run is the case that gets
     it wrong, and inline here it had no way to be tested. */
  let prior = null;
  try {
    prior = JSON.parse(await readFile(SCAN_OUT, "utf8"));
  } catch {
    /* No previous scan. `compareScans` returns a null basis and the
       page says the comparison is not available yet. */
  }
  const change = compareScans({ asOf: latest, names: scanned }, prior);
  await mkdir(dirname(SCAN_OUT), { recursive: true });
  await writeFile(
    SCAN_OUT,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        asOf: latest,
        /* Both numbers travel together, always. */
        universe: series.size,
        withDirection,
        ...change,
        names: scanned,
      },
      null,
      0,
    ),
    "utf8",
  );
  console.log(
    `wrote ${SCAN_OUT} (${withDirection} of ${series.size} have a direction` +
      (change.previousAsOf
        ? `; vs ${change.previousAsOf}: +${change.entered.length} -${change.left.length}` +
          `${change.flipped.length ? `, ${change.flipped.length} flipped` : ""})`
        : "; no previous scan to compare)"),
  );

  /* ---- The ledger: what the site said, and whether it held ----

     This project measures ten years of history for every condition and
     has never measured itself. A stance was stated, the horizon passed,
     and nothing was written down — so there was no way to ask whether
     any of it was right, and no way to start asking about the days
     already gone. Every night without this is a night of evidence lost,
     which is the only reason it is here rather than on a list.

     Resolution uses the candles already in memory, and counts TRADING
     days because that is what the base rates counted. */
  let ledger: LedgerEntry[] = [];
  try {
    const prior = JSON.parse(await readFile(LEDGER_OUT, "utf8"));
    if (Array.isArray(prior?.entries)) ledger = prior.entries;
  } catch {
    /* First run. */
  }

  ledger = recordStances(ledger, taken);
  const scoredNow = resolveEntries(ledger, (symbol) => {
    const candles = series.get(symbol);
    return candles
      ? candles.map((c) => ({ date: c.date, close: c.close }))
      : null;
  });
  ledger = scoredNow.entries;

  await mkdir(dirname(LEDGER_OUT), { recursive: true });
  await writeFile(
    LEDGER_OUT,
    JSON.stringify({ builtAt: new Date().toISOString(), entries: ledger }, null, 0),
    "utf8",
  );
  const score = scoreLedger(ledger);
  console.log(
    `wrote ${LEDGER_OUT} (${ledger.length} stances on record, ` +
      `${scoredNow.resolved} resolved this run)`,
  );
  console.log(`  ${score.verdict}`);

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
