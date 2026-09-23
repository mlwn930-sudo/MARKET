/**
 * Daily OHLC price history, and the technical measures drawn from it.
 *
 * Source is Yahoo's chart endpoint. It is not a documented public API, and
 * that is a real caveat: it can change or start refusing requests without
 * notice. It is used anyway because every documented alternative either
 * charges for history (Finnhub returns 403 on the free tier) or blocks
 * automated requests outright (Stooq returns 403).
 *
 * Everything here degrades to null rather than throwing upward. A company
 * page with no chart is a page missing one section; a company page that
 * fails to render is a broken site.
 */

import { unstable_cache } from "next/cache";

export type Candle = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type PriceHistory = {
  symbol: string;
  currency: string;
  candles: Candle[];
};

/** Yahoo rejects requests without a browser user agent. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

async function fetchHistory(
  symbol: string,
  range: string,
): Promise<PriceHistory | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(symbol)}?range=${range}&interval=1d`;

    const res = await fetch(url, {
      headers: HEADERS,
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = await res.json();
    const result = json?.chart?.result?.[0];
    const timestamps: number[] = result?.timestamp ?? [];
    const quote = result?.indicators?.quote?.[0];

    if (!quote || timestamps.length === 0) return null;

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open?.[i];
      const high = quote.high?.[i];
      const low = quote.low?.[i];
      const close = quote.close?.[i];

      // Holidays and halts come back as null. Dropping them is correct —
      // carrying the previous price forward would invent trading days and
      // shift every moving average.
      if (
        !Number.isFinite(open) ||
        !Number.isFinite(high) ||
        !Number.isFinite(low) ||
        !Number.isFinite(close)
      ) {
        continue;
      }

      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      });
    }

    if (candles.length < 30) return null;

    return {
      symbol: result?.meta?.symbol ?? symbol.toUpperCase(),
      currency: result?.meta?.currency ?? "USD",
      candles,
    };
  } catch {
    return null;
  }
}

/** Cached for an hour. Daily candles do not change intraday, and the live
 *  price shown beside the chart comes from Finnhub in real time anyway. */
export function getPriceHistory(
  symbol: string,
  range = "2y",
): Promise<PriceHistory | null> {
  const ticker = symbol.toUpperCase();
  return unstable_cache(
    () => fetchHistory(ticker, range),
    ["price-history-ohlc", ticker, range],
    { revalidate: 3600, tags: ["prices", `prices:${ticker}`] },
  )();
}

/* ------------------------------------------------------------------ */
/* Indicators                                                          */
/* ------------------------------------------------------------------ */

/** Simple moving average, aligned to the candles. The first `period - 1`
 *  entries are null: an average over fewer days than the period is a
 *  different measure wearing the same name. */
export function sma(
  candles: Candle[],
  period: number,
  pick: (c: Candle) => number = (c) => c.close,
): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += pick(candles[i]);
    if (i >= period) sum -= pick(candles[i - period]);
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Relative strength index, Wilder's smoothing.
 *
 * Above 70 is conventionally "overbought" and below 30 "oversold", but the
 * convention misleads in a strong trend: a stock in a real advance can hold
 * above 70 for months, and selling it on that basis is a common way to be
 * early and wrong. The site shows the number and the trend together for
 * exactly that reason.
 */
export function rsi(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

/** Annualised volatility from daily returns, as a percentage. */
export function volatility(candles: Candle[], window = 60): number | null {
  if (candles.length < window + 1) return null;
  const slice = candles.slice(-(window + 1));

  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i].close / slice[i - 1].close));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

export type Cross = { kind: "golden" | "death"; date: string; ago: number };

/**
 * The most recent crossing of the short average over the long one.
 *
 * Reported with how long ago it happened, because the age is the whole
 * story: a cross that happened two days ago is news, and one from eight
 * months ago is just the current state described in a dramatic way.
 */
export function lastCross(
  candles: Candle[],
  short: (number | null)[],
  long: (number | null)[],
): Cross | null {
  for (let i = candles.length - 1; i > 0; i--) {
    const s = short[i];
    const l = long[i];
    const prevS = short[i - 1];
    const prevL = long[i - 1];
    if (s === null || l === null || prevS === null || prevL === null) continue;

    const crossedUp = prevS <= prevL && s > l;
    const crossedDown = prevS >= prevL && s < l;
    if (crossedUp || crossedDown) {
      return {
        kind: crossedUp ? "golden" : "death",
        date: candles[i].date,
        ago: candles.length - 1 - i,
      };
    }
  }
  return null;
}

export type TrendRead = {
  vsAveragePercent: number | null;
  averageDirection: "rising" | "falling" | "flat" | null;
  verdict: "uptrend" | "downtrend" | "mixed" | null;
  high52: number | null;
  low52: number | null;
  fromHighPercent: number | null;
  fromLowPercent: number | null;
};

/**
 * Trend as two separate questions, because they can disagree and the
 * disagreement is the interesting case.
 *
 * Price above a rising long average is the textbook uptrend. Price above a
 * falling average usually means a bounce inside a decline, and price below
 * a rising average usually means a pullback inside an advance — both are
 * reported as "mixed" rather than forced into one of the two clean answers,
 * because calling either of them a trend would be a guess.
 */
export function readTrend(
  candles: Candle[],
  longAverage: (number | null)[],
): TrendRead {
  const empty: TrendRead = {
    vsAveragePercent: null,
    averageDirection: null,
    verdict: null,
    high52: null,
    low52: null,
    fromHighPercent: null,
    fromLowPercent: null,
  };
  if (candles.length === 0) return empty;

  const lastClose = candles[candles.length - 1].close;
  const lastAverage = longAverage[longAverage.length - 1];
  const monthAgoIndex = Math.max(0, longAverage.length - 22);
  const averageThen = longAverage[monthAgoIndex];

  const window = candles.slice(-252);
  const high52 = window.length ? Math.max(...window.map((c) => c.high)) : null;
  const low52 = window.length ? Math.min(...window.map((c) => c.low)) : null;

  const fromHighPercent =
    high52 && high52 > 0 ? ((lastClose - high52) / high52) * 100 : null;
  const fromLowPercent =
    low52 && low52 > 0 ? ((lastClose - low52) / low52) * 100 : null;

  if (lastAverage === null) {
    return { ...empty, high52, low52, fromHighPercent, fromLowPercent };
  }

  const vsAveragePercent = ((lastClose - lastAverage) / lastAverage) * 100;

  let averageDirection: TrendRead["averageDirection"] = null;
  if (averageThen !== null && averageThen !== undefined && averageThen > 0) {
    const change = ((lastAverage - averageThen) / averageThen) * 100;
    averageDirection = change > 1 ? "rising" : change < -1 ? "falling" : "flat";
  }

  const above = vsAveragePercent > 0;
  let verdict: TrendRead["verdict"] = "mixed";
  if (above && averageDirection === "rising") verdict = "uptrend";
  else if (!above && averageDirection === "falling") verdict = "downtrend";

  return {
    vsAveragePercent,
    averageDirection,
    verdict,
    high52,
    low52,
    fromHighPercent,
    fromLowPercent,
  };
}

export const TREND_LABELS: Record<
  NonNullable<TrendRead["verdict"]>,
  { he: string; note: string }
> = {
  uptrend: {
    he: "מגמה עולה",
    note: "המחיר מעל הממוצע הארוך, והממוצע עצמו עולה",
  },
  downtrend: {
    he: "מגמה יורדת",
    note: "המחיר מתחת לממוצע הארוך, והממוצע עצמו יורד",
  },
  mixed: {
    he: "מגמה מעורבת",
    note: "המחיר והממוצע אינם מצביעים לאותו כיוון",
  },
};
