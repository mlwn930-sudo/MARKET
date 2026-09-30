/**
 * Where a price has turned before, and who was trading when it did.
 *
 * Two questions a chart is usually asked and this site could not answer.
 * The first is which prices matter: not a line someone drew, but a price
 * the stock has actually reversed at more than once. The second is whether
 * the volume behind a move looks like a crowd or like a few large orders.
 *
 * Both are computed here and nowhere else, and both are reported as what
 * they measure rather than as what they suggest. A level is a count of
 * times price turned within a band. A heavy day is a day whose volume
 * cleared a stated multiple of its own average and closed in a stated part
 * of its range. Neither is a claim about who was on the other side, and
 * the labels say so — a metric that quietly promises to identify
 * institutions is a guess with a decimal point.
 */

import type { Candle } from "@/lib/sources/prices";

/* ── Levels ──────────────────────────────────────────────────────────── */

export type PriceLevel = {
  /** The middle of the band, in price. */
  price: number;
  /** Above the last close or below it. A level is not inherently one or
   *  the other — it becomes support or resistance depending on which side
   *  the price is currently on, which is why this is derived last. */
  kind: "support" | "resistance";
  /** Separate swings that reversed inside the band. */
  touches: number;
  /** The most recent of them. */
  lastTouch: string;
  /** Times the band turned price back, and times a close went through it.
   *  A level with four touches and three breaks is a level the market has
   *  stopped respecting, and that is worth seeing next to the count. */
  held: number;
  broke: number;
  /** Volume on the touch days as a multiple of the 50-day average at the
   *  time. Null when there is not enough history behind the earliest
   *  touch to form that average. */
  volumeRatio: number | null;
  /** Distance from the last close, signed, as a percentage. */
  distancePercent: number;
};

/** Half-width of the swing window. A pivot must be the extreme of the five
 *  bars either side of it, which is tight enough to catch a two-week
 *  reversal and loose enough to ignore a single wide bar. */
const SWING = 5;

/** How close two swings have to be to count as the same level, as a share
 *  of price. Fixed rather than volatility-scaled on purpose: a band that
 *  widens with volatility swallows every swing in a fast market and
 *  reports one enormous level, which is the opposite of useful. */
const BAND = 0.018;

/** Below this a band is one swing that happened twice by coincidence. */
const MIN_TOUCHES = 2;

type Pivot = { index: number; price: number; date: string; high: boolean };

function pivots(candles: Candle[]): Pivot[] {
  const found: Pivot[] = [];
  for (let i = SWING; i < candles.length - SWING; i++) {
    const window = candles.slice(i - SWING, i + SWING + 1);
    const bar = candles[i];
    if (window.every((c) => c.high <= bar.high)) {
      found.push({ index: i, price: bar.high, date: bar.date, high: true });
    } else if (window.every((c) => c.low >= bar.low)) {
      found.push({ index: i, price: bar.low, date: bar.date, high: false });
    }
  }
  return found;
}

/** Average volume over the 50 bars before `index`, or null when there are
 *  not 50 of them. */
function averageVolumeBefore(candles: Candle[], index: number): number | null {
  const from = index - 50;
  if (from < 0) return null;
  const window = candles.slice(from, index);
  const total = window.reduce((sum, c) => sum + c.volume, 0);
  return window.length > 0 ? total / window.length : null;
}

/**
 * The price levels this stock has actually reversed at.
 *
 * Swing highs and lows are clustered into bands, and a band is reported
 * only if two or more separate swings landed in it. Every band is then
 * measured against the whole history: how often price turned there, how
 * often it closed straight through, and how heavy the volume was on the
 * days it turned.
 *
 * Returned nearest-first, because the level a reader wants is the one the
 * price is closest to.
 */
export function readLevels(candles: Candle[], limit = 6): PriceLevel[] {
  if (candles.length < SWING * 2 + 20) return [];

  const close = candles[candles.length - 1].close;
  const found = pivots(candles);
  if (found.length === 0) return [];

  /* Cluster by price. Sorted first so a single pass can walk the list and
     start a new band the moment the gap opens wider than the tolerance. */
  const sorted = [...found].sort((a, b) => a.price - b.price);
  const bands: Pivot[][] = [];
  let current: Pivot[] = [sorted[0]];
  for (const pivot of sorted.slice(1)) {
    const anchor = current[0].price;
    if (Math.abs(pivot.price - anchor) / anchor <= BAND) current.push(pivot);
    else {
      bands.push(current);
      current = [pivot];
    }
  }
  bands.push(current);

  const levels: PriceLevel[] = [];

  for (const band of bands) {
    if (band.length < MIN_TOUCHES) continue;

    const prices = band.map((p) => p.price).sort((a, b) => a - b);
    const price = prices[Math.floor(prices.length / 2)];
    const width = price * BAND;

    /* Held or broke, counted in episodes across everything that happened
       after the band formed.

       The obvious version of this is wrong and was written first: for each
       swing, look at the next few bars and see whether price closed
       through. A swing is by construction the extreme of the bars around
       it, so price almost never closes through it immediately — that test
       returns "held" for every level on every stock, which is a column of
       zeros dressed up as evidence.

       So this tracks which side of the band the close is on and counts the
       times it changed. Price enters the band, then either leaves on the
       side it came from — held — or closes clear of the far side, which is
       a break. A wick through is neither: the market has to close beyond
       the band for it to count, which is the whole reason the band has a
       width. */
    let held = 0;
    let broke = 0;
    const first = Math.min(...band.map((p) => p.index));
    const sideOf = (close: number): -1 | 0 | 1 =>
      close > price + width ? 1 : close < price - width ? -1 : 0;

    let side = sideOf(candles[first].close);
    let entered = false;

    for (let i = first; i < candles.length; i++) {
      const candle = candles[i];
      if (candle.high >= price - width && candle.low <= price + width) entered = true;

      const now = sideOf(candle.close);
      if (now === 0) continue;

      if (side === 0) side = now;
      else if (now !== side) {
        if (entered) broke++;
        side = now;
        entered = false;
      } else if (entered) {
        held++;
        entered = false;
      }
    }

    const ratios = band
      .map((pivot) => {
        const average = averageVolumeBefore(candles, pivot.index);
        return average && average > 0 ? candles[pivot.index].volume / average : null;
      })
      .filter((r): r is number => r !== null);

    levels.push({
      price,
      kind: price < close ? "support" : "resistance",
      touches: band.length,
      lastTouch: band.reduce((latest, p) => (p.date > latest ? p.date : latest), band[0].date),
      held,
      broke,
      volumeRatio: ratios.length
        ? ratios.reduce((a, b) => a + b, 0) / ratios.length
        : null,
      distancePercent: ((price - close) / close) * 100,
    });
  }

  return levels
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent))
    .slice(0, limit);
}

/* ── Flow ────────────────────────────────────────────────────────────── */

export type FlowRead = {
  /** Bars the window covers. */
  window: number;
  /** Share of the window's total volume that traded on up days, 0–1. Above
   *  0.5 means more shares changed hands on days the stock rose. */
  upVolumeShare: number | null;
  /** Days whose volume cleared the threshold and closed in the top third of
   *  their own range. Named for the pattern, not for the participant. */
  heavyUpDays: number;
  /** The same, closing in the bottom third. */
  heavyDownDays: number;
  /** The multiple of the 50-day average a day has to clear to count. */
  heavyThreshold: number;
  /** The most recent bar's volume against the 50-day average. */
  latestRatio: number | null;
  /** Average daily volume over the window. */
  averageVolume: number | null;
  /** The single heaviest day in the window and what it did. */
  heaviest: { date: string; ratio: number; changePercent: number } | null;
};

/** A day has to trade half again its own average before it is worth
 *  separating from the noise. Lower and ordinary Mondays qualify. */
const HEAVY = 1.5;

/** How much of the day's range the close has to sit inside to count as a
 *  day that was bought or sold rather than one that drifted. */
const THIRD = 1 / 3;

/**
 * What the volume did over the last `window` bars.
 *
 * Three readings, none of which names a participant.
 *
 * The up-volume share is the plainest: of all the shares that traded, what
 * fraction traded on days the stock closed higher. It is a measure of
 * where the activity was, not of who caused it.
 *
 * Heavy days are the ones that cleared 1.5x their own 50-day average and
 * closed in the top or bottom third of their range. That combination is
 * the usual proxy for size arriving, because a large order that has to be
 * worked through a day tends to leave both marks. It remains a proxy: the
 * tape does not say who traded, 13F says so a quarter late, and a metric
 * that claims otherwise is inventing its own evidence.
 */
export function readFlow(candles: Candle[], window = 60): FlowRead {
  const empty: FlowRead = {
    window,
    upVolumeShare: null,
    heavyUpDays: 0,
    heavyDownDays: 0,
    heavyThreshold: HEAVY,
    latestRatio: null,
    averageVolume: null,
    heaviest: null,
  };
  if (candles.length < 20) return empty;

  const start = Math.max(0, candles.length - window);
  const rows = candles.slice(start);

  let upVolume = 0;
  let totalVolume = 0;
  let heavyUpDays = 0;
  let heavyDownDays = 0;
  let heaviest: FlowRead["heaviest"] = null;

  rows.forEach((candle, i) => {
    const index = start + i;
    const previous = candles[index - 1];
    if (!previous) return;

    const rose = candle.close > previous.close;
    totalVolume += candle.volume;
    if (rose) upVolume += candle.volume;

    const average = averageVolumeBefore(candles, index);
    if (!average || average <= 0) return;
    const ratio = candle.volume / average;

    const range = candle.high - candle.low;
    /* A bar with no range cannot say where it closed inside itself, and
       dividing by it would say so with great confidence. */
    const position = range > 0 ? (candle.close - candle.low) / range : 0.5;

    if (ratio >= HEAVY) {
      if (position >= 1 - THIRD) heavyUpDays++;
      else if (position <= THIRD) heavyDownDays++;
    }

    if (!heaviest || ratio > heaviest.ratio) {
      heaviest = {
        date: candle.date,
        ratio,
        changePercent: ((candle.close - previous.close) / previous.close) * 100,
      };
    }
  });

  const last = candles.length - 1;
  const latestAverage = averageVolumeBefore(candles, last);

  return {
    window: rows.length,
    upVolumeShare: totalVolume > 0 ? upVolume / totalVolume : null,
    heavyUpDays,
    heavyDownDays,
    heavyThreshold: HEAVY,
    latestRatio:
      latestAverage && latestAverage > 0
        ? candles[last].volume / latestAverage
        : null,
    averageVolume: rows.length
      ? rows.reduce((sum, c) => sum + c.volume, 0) / rows.length
      : null,
    heaviest,
  };
}
