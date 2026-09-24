/**
 * Daily OHLC price history.
 *
 * Fetching only. Everything derived from these candles — averages, trend,
 * stage, the contraction pattern — lives in `metrics/technical.ts`, because
 * a formula computed in two places eventually disagrees with itself.
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
  interval = "1d",
): Promise<PriceHistory | null> {
  try {
    const url =
      `https://query1.finance.yahoo.com/v8/finance/chart/` +
      `${encodeURIComponent(symbol)}?range=${range}&interval=${interval}`;

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
        // Intraday bars need the time as well, or every bar in a session
        // collapses onto the same key. Daily bars keep the plain date.
        date:
          interval === "1d"
            ? new Date(timestamps[i] * 1000).toISOString().slice(0, 10)
            : new Date(timestamps[i] * 1000).toISOString(),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(quote.volume?.[i]) ? quote.volume[i] : 0,
      });
    }

    // A two-year daily series too short to carry a moving average is not
    // useful. Shorter ranges legitimately hold fewer bars — a session two
    // hours old has a couple of dozen — so the floor applies only to the
    // long daily pull the analysis is built on.
    if (interval === "1d" && range === "2y" && candles.length < 30) return null;
    if (candles.length < 2) return null;

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

/**
 * The ranges a reader can switch a chart to.
 *
 * Each one pairs a window with a bar size, because the two are not
 * independent: a year of five-minute bars is seventy thousand candles that
 * render as a smear, and a day of daily bars is one candle. The interval is
 * chosen so every range lands between roughly 80 and 500 bars, which is the
 * band where a candle chart is legible.
 *
 * `1D` carries a caveat worth knowing: on a closed market it returns the
 * last session that traded, not an empty chart. That is the right
 * behaviour — a reader opening the site at midnight wants to see the day
 * that happened.
 */
export const RANGES = {
  "1D": { label: "יום", range: "1d", interval: "5m", daily: false },
  "1W": { label: "שבוע", range: "5d", interval: "30m", daily: false },
  "1M": { label: "חודש", range: "1mo", interval: "1d", daily: true },
  "1Y": { label: "שנה", range: "1y", interval: "1d", daily: true },
  "5Y": { label: "5 שנים", range: "5y", interval: "1wk", daily: true },
} as const;

export type RangeKey = keyof typeof RANGES;

/** The range the analysis frameworks are defined against. Two years of
 *  daily bars is what a 200-day average and a stage read need. */
export const ANALYSIS_RANGE = "2y";

export function getRangeHistory(
  symbol: string,
  key: RangeKey,
): Promise<PriceHistory | null> {
  const ticker = symbol.toUpperCase();
  const spec = RANGES[key];

  // Intraday bars are cached briefly because they are still forming;
  // daily and weekly bars do not change until the session closes.
  const revalidate = spec.daily ? 3600 : 120;

  return unstable_cache(
    () => fetchHistory(ticker, spec.range, spec.interval),
    ["price-history-range", ticker, key],
    { revalidate, tags: ["prices", `prices:${ticker}`] },
  )();
}

/**
 * Today's session in five-minute bars, for the sparklines on the dashboard.
 *
 * A card showing a price and a percentage tells you where a thing is. The
 * same card with the session's shape behind it tells you how it got there,
 * which is a different and more useful fact: down 0.4% having fallen all
 * morning and down 0.4% having recovered from −2% are the same number about
 * two different days.
 *
 * Cached for two minutes. These bars close every five, so a shorter cache
 * would spend requests to receive the bar we already have.
 */
export function getIntradayHistory(
  symbol: string,
): Promise<PriceHistory | null> {
  const ticker = symbol.toUpperCase();
  return unstable_cache(
    () => fetchHistory(ticker, "1d", "5m"),
    ["price-history-intraday", ticker],
    { revalidate: 120, tags: ["prices", `prices:${ticker}`] },
  )();
}

/**
 * The index every stock on this site is measured against.
 *
 * SPY rather than ^GSPC: the ETF trades, so its candles carry real volume
 * and match the days a stock actually traded. The index itself would do for
 * returns but would misalign on days the ETF halted.
 *
 * One symbol for the whole site, so the hourly cache is shared: a hundred
 * company pages cost one request between them.
 */
export function getBenchmarkHistory(): Promise<PriceHistory | null> {
  return getPriceHistory("SPY");
}

