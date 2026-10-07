/**
 * Is a convergence worth anything, or did I just assert that it was?
 *
 * `analysis/setup.ts` stays silent below three independent families and
 * mails the reader above it. That threshold is the single most
 * consequential number in the alert pipeline — it decides what reaches an
 * inbox — and I picked it because three felt like the point where a reader
 * would find more than one thing to say. Which is exactly the kind of
 * number this project does not accept anywhere else: every rate on the
 * site is counted, printed with its sample, and shown against a baseline,
 * and then the rule deciding what gets sent was a hunch.
 *
 * This counts it.
 *
 * WHAT IS MEASURED, AND WHAT IS LEFT OUT. The setup read counts five
 * families: trend, level, volume, contraction and rank. Four of them are
 * computable from the instrument's own history at any past bar. Rank is
 * not — it is a position against the universe ON THAT DATE, and
 * reconstructing the universe at every historical bar is a different and
 * much larger job. The conditions that "fired on the last bar" are also
 * excluded, because the stored base-rate file reports them as of its own
 * build date rather than as of the bar being evaluated.
 *
 * So this measures a FOUR-family convergence, and the number it produces
 * is a lower bound on the five-family one rather than the same thing. The
 * output says so, and so should anything that quotes it.
 *
 * The honest outcome is allowed to be "it makes no difference". That is
 * the result the site prints in words everywhere else, and if the
 * threshold turns out to be worth nothing, the right response is to say so
 * next to it rather than to quietly pick a different number.
 *
 *   npx tsx scripts/measure-convergence.ts            a sample of the universe
 *   npx tsx scripts/measure-convergence.ts NVDA AAPL  just those
 */
import { writeFile, mkdir } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readSetup } from "../src/lib/analysis/setup";
import { UNIVERSE } from "../src/lib/universe";
import type { Candle } from "../src/lib/sources/prices";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const OUT = resolve(ROOT, "content/convergence/latest.json");

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Trading days forward. The same horizon every panel on the site quotes,
 *  so this number can be read beside them. */
const HORIZON = 21;

/** Every fifth bar. Evaluating every one would multiply the work by five
 *  and add almost nothing: consecutive bars share their levels, their
 *  averages and most of their volume window, so they are not independent
 *  observations of anything. */
const STEP = 5;

/** Enough history behind a bar for the slowest input — the 200-day average
 *  and the year the volume percentile ranks against. */
const WARMUP = 300;

async function history(symbol: string, attempt = 0): Promise<Candle[] | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=10y&interval=1d`,
      { headers: HEADERS, signal: AbortSignal.timeout(30_000) },
    );
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
    const rows: Candle[] = [];
    for (let i = 0; i < stamps.length; i++) {
      const [o, h, l, c] = [
        quote.open?.[i],
        quote.high?.[i],
        quote.low?.[i],
        quote.close?.[i],
      ];
      if (![o, h, l, c].every((v) => Number.isFinite(v))) continue;
      rows.push({
        date: new Date(stamps[i] * 1000).toISOString().slice(0, 10),
        open: o,
        high: h,
        low: l,
        close: c,
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      });
    }
    return rows;
  } catch {
    return null;
  }
}

type Bucket = { n: number; up: number; moves: number[] };

function emptyBucket(): Bucket {
  return { n: 0, up: 0, moves: [] };
}

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

async function main() {
  const asked = process.argv.slice(2).map((s) => s.toUpperCase());
  /* A third of the universe when none is named. The measurement is about
     the RULE rather than about any company, and 40 names over ten years
     is tens of thousands of observations — enough that another eighty
     would move nothing except the runtime. */
  const symbols = asked.length
    ? asked
    : UNIVERSE.filter((_, i) => i % 3 === 0).map((c) => c.ticker);

  /* By convergence count, and the baseline over every bar evaluated. */
  const byConvergence = new Map<number, Bucket>();
  const baseline = emptyBucket();
  let measured = 0;

  for (const symbol of symbols) {
    await sleep(300);
    const candles = await history(symbol);
    if (!candles || candles.length < WARMUP + HORIZON + 50) {
      process.stdout.write(`${symbol}:short `);
      continue;
    }

    for (let i = WARMUP; i + HORIZON < candles.length; i += STEP) {
      const prefix = candles.slice(0, i + 1);
      /* No stored rates and no rank: see the note at the top. This counts
         the four families an instrument's own history can produce. */
      const setup = readSetup(symbol, prefix, null, null);

      const from = candles[i].close;
      const to = candles[i + HORIZON].close;
      if (!(from > 0)) continue;
      const move = ((to - from) / from) * 100;

      baseline.n++;
      baseline.moves.push(move);
      if (move > 0) baseline.up++;

      const bucket = byConvergence.get(setup.convergence) ?? emptyBucket();
      bucket.n++;
      bucket.moves.push(move);
      if (move > 0) bucket.up++;
      byConvergence.set(setup.convergence, bucket);
    }

    measured++;
    process.stdout.write(`${symbol} `);
  }

  const baseUp = baseline.n ? baseline.up / baseline.n : 0;
  const baseMedian = median(baseline.moves);

  console.log(
    `\n\n${measured} names · ${baseline.n} observations · ${HORIZON} trading days forward\n`,
  );
  console.log(
    `baseline (any evaluated bar): up ${(baseUp * 100).toFixed(1)}% · median ${baseMedian.toFixed(2)}%\n`,
  );
  console.log("families  n       up%     median%   lift(pp)");

  const rows = [...byConvergence.entries()].sort((a, b) => a[0] - b[0]);
  const report = rows.map(([families, bucket]) => {
    const up = bucket.n ? bucket.up / bucket.n : 0;
    const med = median(bucket.moves);
    const lift = (up - baseUp) * 100;
    console.log(
      `${String(families).padEnd(9)} ${String(bucket.n).padEnd(7)} ` +
        `${(up * 100).toFixed(1).padStart(5)}   ${med.toFixed(2).padStart(7)}   ` +
        `${(lift >= 0 ? "+" : "") + lift.toFixed(1)}`,
    );
    return { families, n: bucket.n, upRate: up, medianPct: med, liftPp: lift };
  });

  /* The sentence the threshold has to survive. */
  const atOrAbove = (floor: number) => {
    let n = 0;
    let up = 0;
    const moves: number[] = [];
    for (const [families, bucket] of byConvergence) {
      if (families < floor) continue;
      n += bucket.n;
      up += bucket.up;
      moves.push(...bucket.moves);
    }
    return { n, upRate: n ? up / n : 0, medianPct: median(moves) };
  };

  console.log("");
  for (const floor of [2, 3, 4]) {
    const r = atOrAbove(floor);
    console.log(
      `${floor}+ families: n=${r.n} · up ${(r.upRate * 100).toFixed(1)}% ` +
        `vs baseline ${(baseUp * 100).toFixed(1)}% · ` +
        `lift ${((r.upRate - baseUp) * 100 >= 0 ? "+" : "") + ((r.upRate - baseUp) * 100).toFixed(1)}pp`,
    );
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      {
        builtAt: new Date().toISOString(),
        horizon: HORIZON,
        step: STEP,
        names: measured,
        observations: baseline.n,
        baselineUp: baseUp,
        baselineMedianPct: baseMedian,
        byConvergence: report,
        thresholds: [2, 3, 4].map((floor) => ({ floor, ...atOrAbove(floor) })),
        caveats: [
          "נמדדו ארבע משפחות בלבד — מגמה, רמה, מחזור והתכווצות. דירוג הכוח היחסי מול היקום ותנאים שירו בנר האחרון אינם ניתנים לשחזור לכל נר היסטורי.",
          "חלונות חופפים: נרות סמוכים חולקים רמות, ממוצעים ורוב חלון המחזור, ולכן התצפיות אינן בלתי תלויות.",
          "היקום הוא חברות שנמצאות במדד היום, לאורך עשור שברובו עלה — הטיית שורדים כפולה.",
        ],
      },
      null,
      0,
    ),
    "utf8",
  );
  console.log(`\nwrote ${OUT}`);
}

main();
