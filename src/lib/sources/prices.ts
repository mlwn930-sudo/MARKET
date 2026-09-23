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

