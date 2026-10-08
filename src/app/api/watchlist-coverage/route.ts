import { NextResponse } from "next/server";
import { watchlistNews, type WatchArticle } from "@/lib/watchlist-news";
import { readSetup, type SetupRead } from "@/lib/analysis/setup";
import { getPriceHistory } from "@/lib/sources/prices";
import { baseRatesFor } from "@/lib/metrics/base-rate-store";
import { rankFor } from "@/lib/metrics/rank-store";

/**
 * Everything the site knows about the companies on one watchlist.
 *
 * Two things a reader expects from a watchlist and was not getting.
 *
 * THE NEWS WAS BEING FILTERED OUT OF A FEED THAT NEVER HELD IT. The page
 * took the site's general market wire — a hundred stories about the whole
 * market — and kept the ones tagged with a followed ticker. NVDA was
 * tagged on five of them and TTWO on one, so somebody who added two
 * companies saw two stories and reasonably concluded the feature did not
 * work. Finnhub's per-symbol endpoint, on the same free tier and already
 * used elsewhere in this codebase, carries 248 and 12 over the same
 * fortnight.
 *
 * AND THE CHART WAS NOWHERE. The watchlist knew a price had moved and
 * said nothing about what the chart was doing, while the agent was
 * emailing exactly that. The same `readSetup` runs here, so the page and
 * the inbox describe one situation rather than two.
 *
 * ONE REQUEST PER SYMBOL IS AFFORDABLE HERE AND NOWHERE ELSE. A watchlist
 * is a handful of names by definition; the market pages keep the shared
 * feed because a single request for all readers is what keeps the site
 * inside the free tier. The expensive shape is affordable exactly where
 * it is needed.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** More than anybody follows attentively, and a ceiling on what one
 *  request can cost upstream. */
const MAX_TICKERS = 12;

export type CoverageRow = {
  ticker: string;
  articles: WatchArticle[];
  setup: SetupRead | null;
  /** Null when the instrument has no usable history — said rather than
   *  rendered as an empty chart section. */
  error: string | null;
};

export async function POST(request: Request) {
  let body: { tickers?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const tickers = Array.isArray(body.tickers)
    ? [
        ...new Set(
          body.tickers
            .filter((t): t is string => typeof t === "string")
            .map((t) => t.trim().toUpperCase())
            .filter((t) => /^[A-Z.\-]{1,10}$/.test(t)),
        ),
      ].slice(0, MAX_TICKERS)
    : [];

  if (tickers.length === 0) {
    return NextResponse.json({ rows: [], at: new Date().toISOString() });
  }

  const rows: CoverageRow[] = await Promise.all(
    tickers.map(async (ticker) => {
      /* The four reads a company needs, in parallel. Each one degrades to
         its own absence rather than failing the row: a company with no
         base rates still gets its news, and a company the wire has
         nothing on still gets its chart. */
      const [articles, history, rates, rank] = await Promise.all([
        watchlistNews(ticker).catch(() => [] as WatchArticle[]),
        getPriceHistory(ticker).catch(() => null),
        baseRatesFor(ticker).catch(() => null),
        rankFor(ticker).catch(() => null),
      ]);

      return {
        ticker,
        articles,
        setup: history ? readSetup(ticker, history.candles, rates, rank) : null,
        error: history ? null : "אין היסטוריית מחירים זמינה לנייר הזה.",
      };
    }),
  );

  return NextResponse.json({ rows, at: new Date().toISOString() });
}
