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
import {
  computeFundamentals,
  type Fundamentals,
} from "@/lib/metrics/fundamentals";

export type CompanyAnalysis = {
  ticker: string;
  cik: number;
  title: string;
  profile: Profile | null;
  marketCap: number | null;
  fundamentals: Fundamentals;
};

async function build(ticker: string): Promise<CompanyAnalysis | null> {
  const listing = await lookupTicker(ticker);
  if (!listing) return null;

  const [facts, profile] = await Promise.all([
    getCompanyFacts(listing.cik_str),
    // A missing profile costs the market cap and therefore the valuation
    // multiples, but the margins and growth figures still stand.
    getProfile(ticker).catch(() => null),
  ]);

  const marketCap = profile?.marketCap ?? null;

  return {
    ticker: ticker.toUpperCase(),
    cik: listing.cik_str,
    title: listing.title,
    profile,
    marketCap,
    fundamentals: computeFundamentals(facts, marketCap),
  };
}

export function getCompanyAnalysis(
  ticker: string,
): Promise<CompanyAnalysis | null> {
  const symbol = ticker.toUpperCase();
  return unstable_cache(() => build(symbol), ["company-analysis", symbol], {
    revalidate: 3600,
    tags: ["company", `company:${symbol}`],
  })();
}
