import type { Candle } from "@/lib/sources/prices";

/**
 * The overlays a reader can switch on.
 *
 * These live in `metrics/` with every other formula in the project rather
 * than inside the chart component, for the reason the whole directory
 * exists: a moving average computed in a chart and a moving average
 * computed in an analysis are the same thing, and once they are written
 * twice they eventually disagree.
 *
 * `sma` and `rsi` are already in `technical.ts` — this file adds only the
 * two the charts introduced.
 */

/**
 * Exponential moving average.
 *
 * Seeded from a simple average of the first `period` bars rather than from
 * the first close. Seeding from one price lets that single bar dominate the
 * early series, and on a short range — where the visible window IS the
 * early series — the line starts visibly wrong.
 */
export function ema(
  candles: Candle[],
  period: number,
  pick: (c: Candle) => number = (c) => c.close,
): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  const k = 2 / (period + 1);

  let seed = 0;
  for (let i = 0; i < period; i++) seed += pick(candles[i]);
  let value = seed / period;
  out[period - 1] = value;

  for (let i = period; i < candles.length; i++) {
    value = pick(candles[i]) * k + value * (1 - k);
    out[i] = value;
  }

  return out;
}

export type MacdSeries = {
  macd: (number | null)[];
  signal: (number | null)[];
  histogram: (number | null)[];
};

/**
 * MACD: the gap between two exponential averages, and how that gap is
 * itself trending.
 *
 * The histogram is the part worth watching. The line crossing its signal is
 * the textbook event, but by the time it crosses the histogram has usually
 * been shrinking for several bars — the crossing is the confirmation, and
 * the narrowing is the information.
 */
export function macd(
  candles: Candle[],
  fast = 12,
  slow = 26,
  smoothing = 9,
): MacdSeries {
  const length = candles.length;
  const empty = () => new Array<number | null>(length).fill(null);

  if (length < slow + smoothing) {
    return { macd: empty(), signal: empty(), histogram: empty() };
  }

  const fastLine = ema(candles, fast);
  const slowLine = ema(candles, slow);

  const line: (number | null)[] = empty();
  for (let i = 0; i < length; i++) {
    const f = fastLine[i];
    const s = slowLine[i];
    line[i] = f !== null && s !== null ? f - s : null;
  }

  // The signal is an EMA of the MACD line, which only exists from the bar
  // the slow average starts. Smoothing across the nulls before it would
  // average a gap.
  const firstValid = line.findIndex((v) => v !== null);
  const signal: (number | null)[] = empty();

  if (firstValid >= 0 && length - firstValid >= smoothing) {
    const k = 2 / (smoothing + 1);
    let seed = 0;
    for (let i = firstValid; i < firstValid + smoothing; i++) {
      seed += line[i] as number;
    }
    let value = seed / smoothing;
    signal[firstValid + smoothing - 1] = value;

    for (let i = firstValid + smoothing; i < length; i++) {
      value = (line[i] as number) * k + value * (1 - k);
      signal[i] = value;
    }
  }

  const histogram: (number | null)[] = empty();
  for (let i = 0; i < length; i++) {
    const m = line[i];
    const s = signal[i];
    histogram[i] = m !== null && s !== null ? m - s : null;
  }

  return { macd: line, signal, histogram };
}
