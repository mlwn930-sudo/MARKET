import { detectTickers } from "@/lib/company-names";
import { getPriceHistory } from "@/lib/sources/prices";
import { readLevels } from "@/lib/metrics/levels";
import { readTape, type TapeRead } from "@/lib/metrics/tape";
import { readSetup, type SetupRead } from "@/lib/analysis/setup";
import { rankFor } from "@/lib/metrics/rank-store";
import type { ChartRead } from "./chart-reader";
import type { BaseRateRead } from "@/lib/metrics/base-rates";
import { baseRatesFor } from "@/lib/metrics/base-rate-store";

/**
 * Checks a read of a picture against the data the site already holds.
 *
 * This is the one thing a chart reader attached to a research site can do
 * that a chart reader on its own cannot. Everything the model says comes
 * from pixels: it reads a number off an axis and reports a level. Whether
 * that level exists is a separate question, and this site can answer it —
 * it has the real candles, and `metrics/levels.ts` already finds the bands
 * price actually turned at, from swing pivots rather than from a drawing.
 *
 * So the read stops being a second opinion about an image and becomes a
 * claim with a test attached. A level the model saw that the candles also
 * show is corroborated. One the candles do not show is not called wrong —
 * a chart screenshot can be an index, a crypto pair, an intraday window or
 * a timeframe this site does not carry — it is called unconfirmed, and the
 * reason is printed.
 *
 * Nothing here grades the read or scores it. It reports agreement and
 * disagreement, which is rule 8: the reader is handed the argument, not a
 * verdict about it.
 */

export type LevelCheck = {
  /** What the model read off the picture. */
  read: number;
  kind: "support" | "resistance" | "pivot";
  /** The nearest band the real candles support, when there is one close
   *  enough to be the same level rather than a different one. */
  matched: number | null;
  /** How far apart, as a percentage of the matched price. */
  driftPercent: number | null;
  /** Separate swings that reversed inside the matched band. */
  touches: number | null;
};

export type Corroboration = {
  ticker: string;
  /** Candles the check was run against, so the reader knows the window. */
  candleCount: number;
  lastClose: number;
  /** Every level the model named, with its test. */
  levels: LevelCheck[];
  /** Bands the candles show that the model did not mention. Not a failure
   *  — a screenshot may simply not reach back far enough to show them. */
  missedByRead: { price: number; kind: string; touches: number }[];
  confirmed: number;
  unconfirmed: number;
  /**
   * What this instrument's own history did after the conditions that are
   * true on it today, and after the ones that are not yet.
   *
   * This is the half of the read the model is structurally unable to
   * supply. It is looking at pixels: it can say "price is testing the
   * fifty-day" and it cannot say what that has been followed by, because
   * nothing it has access to counted. The site counted — ten years of
   * closes per name, every occurrence, against the baseline of a random
   * day in the same window.
   *
   * It is also the only honest way to answer the question a reader
   * actually brings to a chart, which is "what are the odds". A model
   * asked that produces a number from nowhere, which is why
   * `scrubStatistic` deletes percentages out of the read. A number with a
   * sample behind it is a different object, and it is allowed to be shown.
   */
  baseRates: BaseRateRead | null;
  /**
   * The volume underneath the picture, read bar by bar.
   *
   * The half of a chart a screenshot carries worst and a model reads
   * worst. Volume sits in a strip an eighth the height of the price panel,
   * often cropped out of the image entirely, and even when it is there a
   * model can see that one bar is taller than its neighbours and cannot
   * say whether that is the ninety-eighth percentile of the year or a
   * Tuesday. Both of those require the series, and the site has it.
   *
   * So this is not a second opinion on what the model saw. It is the
   * measurement the model structurally cannot make, in the same way the
   * base rates are — and like them, every threshold is a rank within the
   * instrument's own trailing year, and every reading is a shape rather
   * than a claim about who was trading.
   */
  tape: TapeRead | null;
  /**
   * The convergence read — how many independent measured families are
   * true on this instrument at once, and where they disagree.
   *
   * The reader could already say what the picture showed, test its levels
   * against real candles, and quote a base rate for each condition it
   * named. What it could not do is the thing a person actually wants from
   * a chart: put those together and say whether anything is converging.
   * Four panels each reporting one true thing leaves that work to the
   * reader, and that work is what the site exists to do.
   *
   * The same engine the watchlist agent uses, deliberately. A setup
   * described one way in an email and another way on the page would be
   * two opinions with no way to tell which one is the site's.
   */
  setup: SetupRead | null;
};

/* Two readings of the same level will never be identical: one is measured
   off an axis in a screenshot, the other off closing prices. A band within
   1.5% is the same level read twice; beyond that they are two levels, and
   calling them one would manufacture an agreement that is not there. */
const SAME_LEVEL = 0.015;

/**
 * Which company the picture is of, when that can be established.
 *
 * Only the model's own `instrument` field is searched, never the summary:
 * a read of an Nvidia chart that mentions AMD as a peer must not be
 * checked against AMD's candles. A wrong corroboration is worse than none,
 * because it looks like evidence.
 */
export function tickerFromRead(read: ChartRead): string | null {
  if (!read.instrument) return null;
  const direct = read.instrument.trim().toUpperCase();
  /* A bare symbol, which is what a chart's own title usually carries. */
  if (/^[A-Z]{1,5}$/.test(direct)) return direct;
  const found = detectTickers(read.instrument, 1);
  return found[0] ?? null;
}

export async function corroborate(
  read: ChartRead,
): Promise<Corroboration | null> {
  const ticker = tickerFromRead(read);
  if (!ticker) return null;
  if (read.levels.length === 0) return null;

  const history = await getPriceHistory(ticker).catch(() => null);
  if (!history || history.candles.length === 0) return null;

  const real = readLevels(history.candles, 8);
  if (real.length === 0) return null;

  const lastClose = history.candles[history.candles.length - 1].close;

  /* The precomputed ten-year measurement, not one taken from the two years
     of candles above: four golden crosses is not a rate, and the file the
     nightly job writes already has the long window. A ticker outside the
     research universe simply has none, and the renderer says so rather
     than measuring whatever happens to be here. */
  const baseRates = await baseRatesFor(ticker).catch(() => null);
  /* The universe rank, which is one of the five families the setup read
     counts and the only one that cannot be computed from this
     instrument alone. */
  const rank = await rankFor(ticker).catch(() => null);

  const levels: LevelCheck[] = [];
  const usedReal = new Set<number>();

  for (const level of read.levels) {
    /* The model returns the price as a string because a chart axis can
       carry a currency sign, a thousands separator or a suffix. Anything
       that is not a number simply cannot be checked. */
    const value = Number(String(level.price).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      levels.push({
        read: Number.NaN,
        kind: level.kind,
        matched: null,
        driftPercent: null,
        touches: null,
      });
      continue;
    }

    let best: (typeof real)[number] | null = null;
    let bestDrift = Infinity;
    for (const band of real) {
      const drift = Math.abs(band.price - value) / band.price;
      if (drift < bestDrift) {
        bestDrift = drift;
        best = band;
      }
    }

    if (best && bestDrift <= SAME_LEVEL) {
      usedReal.add(best.price);
      levels.push({
        read: value,
        kind: level.kind,
        matched: best.price,
        driftPercent: bestDrift * 100,
        touches: best.touches,
      });
    } else {
      levels.push({
        read: value,
        kind: level.kind,
        matched: null,
        driftPercent: null,
        touches: null,
      });
    }
  }

  const missedByRead = real
    .filter((band) => !usedReal.has(band.price))
    .slice(0, 4)
    .map((band) => ({
      price: band.price,
      kind: band.kind,
      touches: band.touches,
    }));

  return {
    ticker,
    candleCount: history.candles.length,
    lastClose,
    levels,
    missedByRead,
    confirmed: levels.filter((l) => l.matched !== null).length,
    unconfirmed: levels.filter((l) => l.matched === null).length,
    baseRates,
    /* Measured from the candles pulled above rather than from the stored
       file: the tape describes the last few sessions, and a reading that
       is a day old is the wrong reading. The base rates are the opposite —
       ten years, rebuilt nightly — which is why the two come from
       different places. */
    tape: readTape(history.candles),
    setup: readSetup(ticker, history.candles, baseRates, rank),
  };
}
