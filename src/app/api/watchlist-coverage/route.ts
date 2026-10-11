import { NextResponse } from "next/server";
import { watchlistNews, type WatchArticle } from "@/lib/watchlist-news";
import { readSetup, type SetupRead } from "@/lib/analysis/setup";
import { buildChartStance, type ChartStance } from "@/lib/analysis/stance";
import { getNextEarnings } from "@/lib/sources/finnhub";
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
  /**
   * Which way the counted record leans, for both horizons.
   *
   * EVERY INPUT WAS ALREADY ON THIS ROUTE. The setup, the base rates,
   * the rank and the candles are all loaded below, and the stance is a
   * pure function over three of them — so a direction existed only for
   * somebody who uploaded a screenshot of a chart they were already
   * looking at. Opening a watchlist is when the question is actually
   * asked.
   *
   * Null outside the research universe, where nothing has been counted.
   */
  stance: ChartStance | null;
  /**
   * The next scheduled report, and whether it lands inside a horizon.
   *
   * The one thing a holder can know in advance and the one the chart
   * cannot show. It already reaches the alert mail as a catalyst and
   * was missing from the page the reader actually opens.
   *
   * `insideSwing` / `insidePosition` do NOT invalidate the stance. The
   * base rates were counted over ten years that contained every
   * earnings date those instruments ever had, so a report inside the
   * window is already in the number. What it changes is what the
   * reader is agreeing to: a scheduled binary event they know about in
   * advance, inside a window a technical condition is speaking for.
   */
  earnings: {
    date: string;
    daysAway: number;
    insideSwing: boolean;
    insidePosition: boolean;
  } | null;
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
      const [articles, history, rates, rank, nextReport] = await Promise.all([
        watchlistNews(ticker).catch(() => [] as WatchArticle[]),
        getPriceHistory(ticker).catch(() => null),
        baseRatesFor(ticker).catch(() => null),
        rankFor(ticker).catch(() => null),
        getNextEarnings(ticker).catch(() => null),
      ]);

      const setup = history
        ? readSetup(ticker, history.candles, rates, rank)
        : null;
      const last = history?.candles.at(-1)?.close ?? null;

      /* Calendar days, deliberately, and not the trading days the
         horizons are counted in: a report lands on a date, and the
         reader is being told how long until it does. The approximation
         runs the other way from the one that would matter — 21 trading
         days is about 30 calendar days, so using the trading count
         would say a report is outside a window it is actually inside. */
      const earnings = nextReport
        ? (() => {
            const days = Math.round(
              (new Date(nextReport.date).getTime() - Date.now()) / 86_400_000,
            );
            return {
              date: nextReport.date,
              daysAway: days,
              insideSwing: days >= 0 && days <= 30,
              insidePosition: days >= 0 && days <= 91,
            };
          })()
        : null;

      return {
        ticker,
        articles,
        setup,
        /* The close the stance is measured from has to be the close the
           setup was measured on, so it comes from the candles here and
           not from a live quote. A stance dated to one bar and priced
           from another is two readings wearing one label. */
        earnings,
        stance:
          last !== null
            ? buildChartStance({ setup, baseRates: rates, lastClose: last })
            : null,
        error: history ? null : "אין היסטוריית מחירים זמינה לנייר הזה.",
      };
    }),
  );

  return NextResponse.json({ rows, at: new Date().toISOString() });
}
