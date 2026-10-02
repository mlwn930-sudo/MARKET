import { detectTickers } from "@/lib/company-names";
import { getPriceHistory } from "@/lib/sources/prices";
import { readLevels } from "@/lib/metrics/levels";
import type { ChartRead } from "./chart-reader";

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
  };
}
