/**
 * Cached company analysis.
 *
 * The raw SEC companyfacts document is 5MB for NVIDIA and 10MB for JPMorgan,
 * which is over Next's 2MB fetch-cache ceiling — so it is never cached and
 * every page view re-downloaded the whole thing. That is slow for the reader
 * and burns the SEC request budget we are rate limited against.
 *
 * The fix is to cache what comes out rather than what goes in: the computed
 * metrics are a few kilobytes, so the 10MB download happens once an hour per
 * company instead of once per view.
 *
 * The live quote is deliberately NOT part of this. A price cached for an
 * hour is a wrong price.
 */

import { unstable_cache } from "next/cache";
import { getCompanyFacts, lookupTicker } from "@/lib/sources/sec";
import { getProfile, type Profile } from "@/lib/sources/finnhub";
import { getBenchmarkHistory, getPriceHistory } from "@/lib/sources/prices";
import { getRiskFreeRate } from "@/lib/sources/fred";
import {
  computeFundamentals,
  type Fundamentals,
} from "@/lib/metrics/fundamentals";
import {
  computeCapitalQuality,
  type CapitalQuality,
} from "@/lib/metrics/capital";
import { beta, readTechnicals, type TechnicalRead } from "@/lib/metrics/technical";

export type CompanyAnalysis = {
  ticker: string;
  cik: number;
  title: string;
  profile: Profile | null;
  marketCap: number | null;
  fundamentals: Fundamentals;
  /** Cash cycle, dilution, cost of capital, operating leverage, allocation. */
  capital: CapitalQuality;
};

async function build(ticker: string): Promise<CompanyAnalysis | null> {
  const listing = await lookupTicker(ticker);
  if (!listing) return null;

  const [facts, profile, history, benchmark, riskFree] = await Promise.all([
    getCompanyFacts(listing.cik_str),
    // A missing profile costs the market cap and therefore the valuation
    // multiples, but the margins and growth figures still stand.
    getProfile(ticker).catch(() => null),
    // Needed here only for beta. Both calls share the hourly price cache
    // with the chart on the page, so neither is an extra request.
    getPriceHistory(ticker).catch(() => null),
    getBenchmarkHistory().catch(() => null),
    getRiskFreeRate().catch(() => null),
  ]);

  const marketCap = profile?.marketCap ?? null;
  const fundamentals = computeFundamentals(facts, marketCap);

  const stockBeta =
    history && benchmark ? beta(history.candles, benchmark.candles) : null;

  return {
    ticker: ticker.toUpperCase(),
    cik: listing.cik_str,
    title: listing.title,
    profile,
    marketCap,
    fundamentals,
    capital: computeCapitalQuality(
      facts,
      fundamentals.base,
      {
        revenue: fundamentals.revenueSeries,
        operating: fundamentals.operatingIncomeSeries,
        shareCount: fundamentals.shareCountSeries,
      },
      { beta: stockBeta, riskFree },
    ),
  };
}

/**
 * Bumped whenever the shape of CompanyAnalysis changes.
 *
 * The cache holds a serialised object for an hour, and it does not know that
 * the code reading it has since grown a new field. Without this, adding a
 * field ships a page that crashes on every company until the cache happens
 * to expire — which is exactly what happened when `capital` was added.
 */
const SHAPE_VERSION = "v2";

/**
 * The same work, without the cache wrapper.
 *
 * Exported for the offline scripts. `unstable_cache` needs a Next request
 * context to resolve its store, and a `tsx` script running under plain
 * Node has none — so the nightly job that rebuilds the thesis history
 * calls this directly rather than going through the cached door and
 * throwing on the first company.
 */
export function buildCompanyAnalysis(
  ticker: string,
): Promise<CompanyAnalysis | null> {
  return build(ticker.toUpperCase());
}

export function getCompanyAnalysis(
  ticker: string,
): Promise<CompanyAnalysis | null> {
  const symbol = ticker.toUpperCase();
  return unstable_cache(
    () => build(symbol),
    ["company-analysis", SHAPE_VERSION, symbol],
    {
      revalidate: 3600,
      tags: ["company", `company:${symbol}`],
    },
  )();
}

/**
 * The technical read, computed once per company per hour.
 *
 * Separate from the fundamental analysis above because it depends only on
 * price — a company that has not filed anything for two months still has a
 * chart that moved this morning — and because the chart and the analysis
 * panel both need it. Computing it twice per page view would be harmless
 * but wasteful, and the shared cache makes the second read free.
 */
export async function getTechnicalRead(
  ticker: string,
): Promise<TechnicalRead | null> {
  const symbol = ticker.toUpperCase();

  const [history, benchmark] = await Promise.all([
    getPriceHistory(symbol).catch(() => null),
    getBenchmarkHistory().catch(() => null),
  ]);
  if (!history) return null;

  return readTechnicals(history.candles, benchmark?.candles ?? null);
}
