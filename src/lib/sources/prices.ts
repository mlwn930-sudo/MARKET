/**
 * Daily price history.
 *
 * Source is Yahoo's chart endpoint. It is not a documented public API, and
 * that is a real caveat: it can change or start refusing requests without
 * notice. It is used anyway because every documented alternative either
 * charges for history (Finnhub returns 403 on the free tier) or blocks
 * automated requests outright (Stooq returns 403).
 *
 * Everything here therefore degrades to null rather than throwing upward.
 * A company page with no chart is a page missing one section; a company page
 * that fails to render is a broken site.
 */

import { unstable_cache } from "next/cache";

export type Candle = { date: string; close: number };

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
    const closes: (number | null)[] =
      result?.indicators?.quote?.[0]?.close ?? [];

    if (timestamps.length === 0 || timestamps.length !== closes.length) {
      return null;
    }

    const candles: Candle[] = [];
    for (let i = 0; i < timestamps.length; i++) {
      const close = closes[i];
      // Holidays and halts come back as null. Dropping them is correct —
      // carrying the previous price forward would invent trading days and
      // shift every moving average.
      if (close === null || !Number.isFinite(close)) continue;
      candles.push({
        date: new Date(timestamps[i] * 1000).toISOString().slice(0, 10),
        close,
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
    ["price-history", ticker, range],
    { revalidate: 3600, tags: ["prices", `prices:${ticker}`] },
  )();
}

/* ------------------------------------------------------------------ */
/* Technical measures                                                  */
/* ------------------------------------------------------------------ */

/** Simple moving average, aligned to the candles. The first `period - 1`
 *  entries are null: an average over fewer days than the period is a
 *  different measure wearing the same name. */
export function sma(candles: Candle[], period: number): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

export type TrendRead = {
  /** Where price sits against the long average, as a percentage. */
  vsAveragePercent: number | null;
  /** Whether the long average itself is rising, over the last month. */
  averageDirection: "rising" | "falling" | "flat" | null;
  /** Combined read, which is what the label on the chart shows. */
  verdict: "uptrend" | "downtrend" | "mixed" | null;
  high52: number | null;
  low52: number | null;
  fromHighPercent: number | null;
};

/**
 * Trend as two separate questions, because they can disagree and the
 * disagreement is the interesting case.
 *
 * Price above a rising long average is the textbook uptrend. Price above a
 * falling average usually means a bounce inside a decline, and price below
 * a rising average usually means a pullback inside an advance — both are
 * reported as "mixed" rather than being forced into one of the two clean
 * answers, because calling either of them a trend would be a guess.
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
  };
  if (candles.length === 0) return empty;

  const lastClose = candles[candles.length - 1].close;
  const lastAverage = longAverage[longAverage.length - 1];

  // Roughly one trading month back.
  const monthAgoIndex = Math.max(0, longAverage.length - 22);
  const averageThen = longAverage[monthAgoIndex];

  const window = candles.slice(-252);
  const closes = window.map((c) => c.close);
  const high52 = closes.length ? Math.max(...closes) : null;
  const low52 = closes.length ? Math.min(...closes) : null;

  if (lastAverage === null) {
    return {
      ...empty,
      high52,
      low52,
      fromHighPercent:
        high52 && high52 > 0 ? ((lastClose - high52) / high52) * 100 : null,
    };
  }

  const vsAveragePercent = ((lastClose - lastAverage) / lastAverage) * 100;

  let averageDirection: TrendRead["averageDirection"] = null;
  if (averageThen !== null && averageThen !== undefined && averageThen > 0) {
    const change = ((lastAverage - averageThen) / averageThen) * 100;
    averageDirection =
      change > 1 ? "rising" : change < -1 ? "falling" : "flat";
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
    fromHighPercent:
      high52 && high52 > 0 ? ((lastClose - high52) / high52) * 100 : null,
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
    note: "המחיר והממוצע לא מצביעים לאותו כיוון",
  },
};
