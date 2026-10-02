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

/**
 * Who is asking.
 *
 * This said "Mozilla/5.0 ... Chrome/131.0" — a browser this code is not,
 * sent to endpoints Yahoo does not document, which is the shape of trying
 * not to be noticed. The project already identifies itself honestly to the
 * SEC because the SEC demands it; there was no reason to behave worse
 * where nobody was checking.
 *
 * Measured before changing it: an honest, contactable agent gets exactly
 * the same answers — 200 and an identical bar count on the chart, spark,
 * max-range and pre/post endpoints alike. The disguise was buying nothing.
 * If that ever stops being true, the refusal is the answer about whether
 * this access was welcome, and it should be heard rather than worked
 * around.
 */
const HEADERS = {
  "User-Agent": "MarketIntel/1.0 (personal research; mlwn930@gmail.com)",
};

/** Which session a price belongs to. A board that prints a number with no
 *  session attached cannot be read: the same figure means "today's move"
 *  at noon and "overnight" at seven in the morning. */
export type MarketPhase = "pre" | "regular" | "post" | "closed";

export type BoardQuote = {
  symbol: string;
  /** The price to show right now — the extended print when the clock is
   *  in an extended session and one exists, the regular close otherwise. */
  price: number | null;
  /** The move that goes with `price`, against the baseline named below. */
  changePercent: number | null;
  phase: MarketPhase;
  /** True when `price` is a pre- or post-market print rather than a
   *  regular-session one. The page has to say so beside the figure. */
  extended: boolean;
  /** The regular session in its own right, always available, so a page can
   *  show the close and the overnight move as two separate facts. */
  regularClose: number | null;
  regularChangePercent: number | null;
  previousClose: number | null;
  dayHigh: number | null;
  dayLow: number | null;
  at: string | null;
};

type Period = { start: number; end: number };

type SparkMeta = {
  symbol?: string;
  regularMarketPrice?: number;
  regularMarketChangePercent?: number;
  chartPreviousClose?: number;
  regularMarketDayHigh?: number;
  regularMarketDayLow?: number;
  regularMarketTime?: number;
  currentTradingPeriod?: { pre?: Period; regular?: Period; post?: Period };
};

type SparkResponse = {
  meta?: SparkMeta;
  timestamp?: number[];
  indicators?: { quote?: { close?: (number | null)[] }[] };
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
      /* Five-minute bars with pre and post included, rather than a single
         daily bar. One daily bar can only ever say what the regular
         session did; the board has to show what the price is doing now,
         and for most of the hours anyone looks at it that is an extended
         session. Measured: three symbols at this resolution are 12KB, so
         the whole universe is about half a megabyte once every two
         minutes — the cost of the board being right rather than stale. */
      `${SPARK}?symbols=${symbols.map(encodeURIComponent).join(",")}&range=1d&interval=5m&includePrePost=true`,
      { headers: HEADERS, signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return [];

    const rows: { symbol?: string; response?: SparkResponse[] }[] =
      (await res.json())?.spark?.result ?? [];

    const now = Date.now() / 1000;

    return rows.flatMap((row) => {
      const res0 = row.response?.[0];
      const meta = res0?.meta;
      const symbol = (row.symbol ?? meta?.symbol ?? "").toUpperCase();
      if (!symbol || typeof meta?.regularMarketPrice !== "number") return [];

      const regularClose = meta.regularMarketPrice;
      const previous = meta.chartPreviousClose ?? null;
      const fromMeta = meta.regularMarketChangePercent;

      /* The regular session, as its own fact. Outside a session Yahoo
         sometimes reports the change as exactly zero, so it is recomputed
         from the previous close — the same correction the Tel Aviv and
         macro sources make. */
      const regularChangePercent =
        fromMeta !== undefined && Number.isFinite(fromMeta) && fromMeta !== 0
          ? fromMeta
          : previous
            ? ((regularClose - previous) / previous) * 100
            : null;

      const period = meta.currentTradingPeriod;
      const phase: MarketPhase = !period?.regular
        ? "closed"
        : period.pre && now >= period.pre.start && now < period.regular.start
          ? "pre"
          : now >= period.regular.start && now < period.regular.end
            ? "regular"
            : period.post && now >= period.post.start && now < period.post.end
              ? "post"
              : "closed";

      /* The last bar carrying a price inside a window. Bars come back with
         nulls in them — a five minutes nobody traded is a hole, not a
         zero, and treating it as a zero would print a crash. */
      const lastIn = (from: number, to: number) => {
        const stamps = res0?.timestamp ?? [];
        const closes = res0?.indicators?.quote?.[0]?.close ?? [];
        for (let i = stamps.length - 1; i >= 0; i--) {
          const close = closes[i];
          if (close == null || !Number.isFinite(close)) continue;
          if (stamps[i] >= from && stamps[i] < to) return close;
        }
        return null;
      };

      /* Both extended sessions measure against the last REGULAR CLOSE,
         which is what `regularMarketPrice` holds in pre, post and closed
         alike. Using `chartPreviousClose` for pre-market — which the
         previous version did — reaches one session too far back and
         inverts the sign: AAPL on 2026-10-02 printed 332.44 pre-market
         against a 330.32 close, which is +0.64%, and the board showed
         −0.28% by measuring against the 333.02 close before it. */
      let extendedPrice: number | null = null;
      if (phase === "pre" && period?.pre && period.regular) {
        extendedPrice = lastIn(period.pre.start, period.regular.start);
      } else if (phase === "post" && period?.post) {
        extendedPrice = lastIn(period.post.start, period.post.end);
      }

      const extended =
        extendedPrice !== null &&
        regularClose > 0 &&
        extendedPrice !== regularClose;

      return [
        {
          symbol,
          price: extended ? extendedPrice : regularClose,
          changePercent: extended
            ? ((extendedPrice! - regularClose) / regularClose) * 100
            : regularChangePercent,
          phase,
          extended,
          regularClose,
          regularChangePercent,
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
