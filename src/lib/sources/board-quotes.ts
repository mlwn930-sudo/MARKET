/**
 * One quote fetch for every page that shows the whole universe.
 *
 * The market map, the sector pages and the daily brief each asked for
 * prices on their own — forty-eight, forty-eight and twenty symbols, at
 * one HTTP request per symbol. Finnhub's free tier answers sixty requests
 * a minute for the entire site, so opening two of those pages inside a
 * minute produced 429s and a page full of dashes. Measured, not predicted:
 * that is exactly what happened.
 *
 * Two changes fix it, and both are here rather than in the pages.
 *
 * One cache, shared. Every board-level view reads this function, so the
 * cost of showing prices for the universe is one fetch every two minutes
 * no matter how many readers or how many pages.
 *
 * One request, not forty-eight. Yahoo's spark endpoint returns every
 * symbol asked for in a single response, so the whole universe costs one
 * round trip. Finnhub stays the primary for the single live quote on a
 * company page, where its latency is the point; for a board of dashes-or-
 * numbers, breadth beats freshness.
 */

import { unstable_cache } from "next/cache";

const SPARK = "https://query1.finance.yahoo.com/v7/finance/spark";

const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

export type BoardQuote = {
  symbol: string;
  price: number | null;
  changePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  at: string | null;
};

type SparkMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: number;
};

/**
 * Sixteen per request.
 *
 * Measured against the live endpoint rather than assumed: twenty symbols
 * answer 200, twenty-five answer 400. Sixteen leaves room for longer
 * symbols without probing the ceiling again, and still turns the whole
 * forty-eight-company universe into three requests instead of forty-eight.
 */
const CHUNK = 16;

async function fetchChunk(symbols: string[]): Promise<BoardQuote[]> {
  try {
    const res = await fetch(
      `${SPARK}?symbols=${symbols.map(encodeURIComponent).join(",")}&range=1d&interval=1d`,
      { headers: HEADERS, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return [];

    const rows: { symbol?: string; response?: { meta?: SparkMeta }[] }[] =
      (await res.json())?.spark?.result ?? [];

    return rows.flatMap((row) => {
      const meta = row.response?.[0]?.meta;
      const symbol = (row.symbol ?? meta?.symbol ?? "").toUpperCase();
      if (!symbol || typeof meta?.regularMarketPrice !== "number") return [];

      const previous = meta.chartPreviousClose ?? null;
      const fromMeta = meta.regularMarketChangePercent;

      return [
        {
          symbol,
          price: meta.regularMarketPrice,
          // Outside a session Yahoo reports the change as exactly zero, so
          // it is recomputed from the previous close — the same correction
          // the Tel Aviv and macro sources make.
          changePercent:
            fromMeta !== undefined && Number.isFinite(fromMeta) && fromMeta !== 0
              ? fromMeta
              : previous
                ? ((meta.regularMarketPrice - previous) / previous) * 100
                : null,
          previousClose: previous,
          dayHigh: meta.regularMarketDayHigh ?? null,
          dayLow: meta.regularMarketDayLow ?? null,
          at: meta.regularMarketTime
            ? new Date(meta.regularMarketTime * 1000).toISOString()
            : null,
        },
      ];
    });
  } catch {
    return [];
  }
}

async function build(symbols: string[]): Promise<Record<string, BoardQuote>> {
  const out: Record<string, BoardQuote> = {};

  for (let i = 0; i < symbols.length; i += CHUNK) {
    const quotes = await fetchChunk(symbols.slice(i, i + CHUNK));
    for (const quote of quotes) out[quote.symbol] = quote;
  }

  return out;
}

/**
 * Quotes for a set of symbols, keyed by symbol.
 *
 * A symbol that did not come back is simply absent — the caller shows a
 * dash for it rather than receiving a zero that would average into a
 * sector's performance as if it were a flat day.
 */
export function getBoardQuotes(
  symbols: string[],
): Promise<Record<string, BoardQuote>> {
  const list = [...new Set(symbols.map((s) => s.toUpperCase()))].sort();

  return unstable_cache(
    () => build(list),
    ["board-quotes", "v1", list.join(",")],
    { revalidate: 120, tags: ["quotes"] },
  )();
}
