/**
 * What a stock did outside the session.
 *
 * A price that moved four percent at seven in the morning is the single
 * most useful thing a company page can say before the bell, and until now
 * the site simply did not know about it — Finnhub's free tier reports the
 * regular session and nothing either side of it.
 *
 * Yahoo's chart endpoint does, if asked. `includePrePost=true` returns the
 * bars from 04:00 and after 16:00 alongside the regular ones, and the meta
 * carries the three session boundaries for the day. There is no
 * `preMarketPrice` field to read — the price has to be derived from the
 * series, which is the whole of what this file does.
 *
 * The two changes are measured against different references, and that is
 * not a detail. Pre-market is quoted against yesterday's close, because
 * nothing has happened since. After-hours is quoted against today's
 * regular close, because the day already happened and what the reader
 * wants is what moved since the bell. Getting these the wrong way round
 * produces a number that looks right and means nothing.
 */

import { unstable_cache } from "next/cache";

/** Yahoo rejects requests without a browser user agent. */
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
    "(KHTML, like Gecko) Chrome/131.0 Safari/537.36",
};

const CHART = "https://query1.finance.yahoo.com/v8/finance/chart";

export type ExtendedSession = {
  price: number;
  change: number;
  changePercent: number;
  /** The last bar in that session, ISO. */
  at: string;
  /** What the change is measured against, so the page can say so. */
  against: "previousClose" | "regularClose";
};

export type ExtendedHours = {
  symbol: string;
  /** Which session the clock is in right now, by Yahoo's own boundaries
   *  rather than by our guess at a timezone. */
  phase: "pre" | "regular" | "post" | "closed";
  previousClose: number | null;
  regularPrice: number | null;
  pre: ExtendedSession | null;
  post: ExtendedSession | null;
};

type Period = { start: number; end: number };

function build(
  symbol: string,
  meta: {
    previousClose?: number;
    chartPreviousClose?: number;
    regularMarketPrice?: number;
    currentTradingPeriod?: { pre?: Period; regular?: Period; post?: Period };
  },
  stamps: number[],
  closes: (number | null)[],
): ExtendedHours {
  const regular = meta.currentTradingPeriod?.regular;
  const previousClose = meta.previousClose ?? meta.chartPreviousClose ?? null;
  const regularPrice = meta.regularMarketPrice ?? null;

  const empty: ExtendedHours = {
    symbol,
    phase: "closed",
    previousClose,
    regularPrice,
    pre: null,
    post: null,
  };
  if (!regular) return empty;

  const now = Date.now() / 1000;
  const phase: ExtendedHours["phase"] =
    now < regular.start
      ? meta.currentTradingPeriod?.pre && now >= meta.currentTradingPeriod.pre.start
        ? "pre"
        : "closed"
      : now < regular.end
        ? "regular"
        : meta.currentTradingPeriod?.post && now < meta.currentTradingPeriod.post.end
          ? "post"
          : "closed";

  /** The last bar with a price inside a window. Bars come back with nulls
   *  in them — a minute nobody traded is a hole, not a zero. */
  const lastIn = (from: number, to: number) => {
    for (let i = stamps.length - 1; i >= 0; i--) {
      const close = closes[i];
      if (close == null || !Number.isFinite(close)) continue;
      if (stamps[i] >= from && stamps[i] < to) {
        return { price: close, at: new Date(stamps[i] * 1000).toISOString() };
      }
    }
    return null;
  };

  const session = (
    found: { price: number; at: string } | null,
    reference: number | null,
    against: ExtendedSession["against"],
  ): ExtendedSession | null => {
    if (!found || reference == null || reference <= 0) return null;
    const change = found.price - reference;
    /* A session that has not moved at all is a session nobody traded in.
       Reporting "0.00%" there claims a fact the tape does not support. */
    if (change === 0) return null;
    return {
      price: found.price,
      change,
      changePercent: (change / reference) * 100,
      at: found.at,
      against,
    };
  };

  const preWindow = meta.currentTradingPeriod?.pre;

  return {
    symbol,
    phase,
    previousClose,
    regularPrice,
    pre: session(
      preWindow ? lastIn(preWindow.start, regular.start) : null,
      previousClose,
      "previousClose",
    ),
    post: session(
      lastIn(regular.end, regular.end + 6 * 3600),
      regularPrice,
      "regularClose",
    ),
  };
}

/**
 * Cached for a minute. Extended-hours tapes are thin — a quote that is
 * sixty seconds old out of hours is the same quote — and the company page
 * is not the only thing asking.
 */
export function getExtendedHours(symbol: string): Promise<ExtendedHours | null> {
  const ticker = symbol.toUpperCase();

  return unstable_cache(
    async () => {
      try {
        const res = await fetch(
          `${CHART}/${encodeURIComponent(ticker)}` +
            `?interval=5m&range=1d&includePrePost=true`,
          { headers: HEADERS, signal: AbortSignal.timeout(15_000) },
        );
        if (!res.ok) return null;

        const result = (await res.json())?.chart?.result?.[0];
        const meta = result?.meta;
        if (!meta) return null;

        return build(
          ticker,
          meta,
          result.timestamp ?? [],
          result.indicators?.quote?.[0]?.close ?? [],
        );
      } catch {
        /* Out of hours this is the only source of the number, so a failure
           here means the page says nothing about the session rather than
           saying something wrong about it. */
        return null;
      }
    },
    ["extended-hours", "v1", ticker],
    { revalidate: 60, tags: ["quotes"] },
  )();
}
