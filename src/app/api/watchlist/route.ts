import { NextResponse } from "next/server";
import { getQuotes } from "@/lib/sources/finnhub";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { getLiveFeed } from "@/lib/live-news";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";

/**
 * The current state of a watchlist, in one request.
 *
 * Deliberately built from the precomputed fundamentals file and the live
 * quote, and NOT from the full agent pipeline. Ten companies through the
 * pipeline on a cold cache is ten SEC documents of several megabytes each,
 * which would take longer than the function is allowed to run. The deep
 * read stays one click away on the company page; this route answers the
 * question a watchlist actually asks, which is "did anything move".
 *
 * What comes back is a snapshot, not a diff. The comparison happens in the
 * browser against the snapshot it stored last visit, because the list and
 * its history live in localStorage — the project has no database, and a
 * watchlist is exactly the kind of small personal state that does not
 * justify one.
 */

export const dynamic = "force-dynamic";

const MAX_TICKERS = 20;

export async function POST(request: Request) {
  let body: { tickers?: string[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const tickers = [
    ...new Set(
      (body.tickers ?? [])
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z.\-]{1,10}$/.test(t)),
    ),
  ].slice(0, MAX_TICKERS);

  if (tickers.length === 0) {
    return NextResponse.json({ rows: [], checkedAt: new Date().toISOString() });
  }

  const [quotes, fundamentals, feed] = await Promise.all([
    getQuotes(tickers).catch(() => []),
    getFundamentalsFile(),
    getLiveFeed().catch(() => null),
  ]);

  // One pass over the feed rather than one per ticker: the feed is a few
  // hundred articles and the watchlist is twenty symbols.
  const mentions = new Map<
    string,
    { count: number; top: { title: string; url: string; significance: string } | null }
  >();

  for (const sector of feed?.sectors ?? []) {
    for (const article of sector.articles) {
      const symbols = new Set([
        ...article.tickers,
        ...(article.analysis?.tickers ?? []),
      ]);
      for (const symbol of symbols) {
        if (!tickers.includes(symbol)) continue;
        const entry = mentions.get(symbol) ?? { count: 0, top: null };
        entry.count++;
        const significance = article.analysis?.significance ?? "unrated";
        // The first high-significance story wins; otherwise the newest one
        // already in hand stays.
        if (!entry.top || (significance === "high" && entry.top.significance !== "high")) {
          entry.top = { title: article.title, url: article.url, significance };
        }
        mentions.set(symbol, entry);
      }
    }
  }

  const rows = tickers.map((ticker, index) => {
    const quote = quotes[index] ?? null;
    const company = fundamentals.companies.find((c) => c.ticker === ticker);
    const mention = mentions.get(ticker) ?? { count: 0, top: null };

    return {
      ticker,
      name: company?.name ?? null,
      sector: company
        ? (SECTOR_LABELS[company.sector as SectorKey] ?? company.sector)
        : null,
      price: quote?.price ?? null,
      changePercent: quote?.changePercent ?? null,
      /** From the precomputed file — the same figures the screener ranks on. */
      metrics: company
        ? {
            pe: company.metrics.pe ?? null,
            roic: company.metrics.roic ?? null,
            operating_margin: company.metrics.operating_margin ?? null,
            // Three-year CAGR, not a year-on-year figure: a watchlist row
            // should not move because one quarter was soft.
            rev_cagr_3: company.metrics.rev_cagr_3 ?? null,
          }
        : null,
      /** The date of the report those metrics came from. A change here is
       *  the signal that matters most on a research watchlist: the company
       *  filed. */
      filingAsOf: company?.asOf ?? null,
      stale: company?.stale ?? null,
      inUniverse: Boolean(company),
      news: mention,
    };
  });

  return NextResponse.json(
    { rows, checkedAt: new Date().toISOString() },
    { headers: { "Cache-Control": "no-store" } },
  );
}
