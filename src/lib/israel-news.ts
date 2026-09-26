import { unstable_cache } from "next/cache";
import { getCompanyNews } from "@/lib/sources/finnhub";
import { triage, type Triage } from "@/lib/news-triage";
import { DUAL_LISTED } from "@/lib/tase-universe";

/**
 * News about Israeli companies.
 *
 * The site's general feed carries none. That is not an oversight in the
 * feed — it was measured: ninety stories on the wire, zero mentioning an
 * Israeli ticker and zero containing the words Israel, Tel Aviv or
 * shekel. A general American market wire covers American companies, and
 * filtering it for Israeli coverage returns an empty page with a
 * confident headline over it.
 *
 * So this asks a different question of the same provider. Finnhub's
 * company-news endpoint is per symbol, and the eight Israeli companies
 * with a New York listing have symbols to ask about. What comes back is
 * genuinely about those businesses — earnings dates, regulatory filings,
 * contract awards — rather than an American story that happens to
 * mention the region.
 *
 * The limitation is stated on the page rather than hidden: this covers
 * the eight dual-listed names and nothing else. A bank that trades only
 * in Tel Aviv has no symbol here to ask about, and inventing coverage for
 * it by scraping a Hebrew news site the project cannot keep working would
 * be worse than saying so.
 *
 * Every story runs through the same rule-based triage the main feed uses,
 * so "catalyst" means the same thing on both sides of the site.
 */

export type IsraelStory = {
  url: string;
  headline: string;
  summary: string;
  source: string;
  publishedAt: string;
  /** The company this arrived under. */
  ticker: string;
  hebrewName: string;
  sector: string;
  triage: Triage;
};

export type IsraelNews = {
  stories: IsraelStory[];
  /** How many of the eight returned anything. */
  covered: number;
  total: number;
  fetchedAt: string;
};

const WINDOW_DAYS = 21;

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

async function build(): Promise<IsraelNews> {
  const from = isoDaysAgo(WINDOW_DAYS);
  const to = new Date().toISOString().slice(0, 10);

  /* Sequential rather than parallel. Eight simultaneous requests is a
     burst the free tier answers with 429s, and this page is not worth
     spending the site's whole minute on. */
  const collected: IsraelStory[] = [];
  let covered = 0;

  for (const company of DUAL_LISTED) {
    try {
      const items = await getCompanyNews(company.usTicker, from, to);
      if (items.length > 0) covered++;

      for (const item of items.slice(0, 6)) {
        if (!item.url || !item.headline) continue;
        collected.push({
          url: item.url,
          headline: item.headline,
          summary: item.summary ?? "",
          source: item.source ?? "",
          publishedAt: item.publishedAt.toISOString(),
          ticker: company.usTicker,
          hebrewName: company.name,
          sector: company.sector,
          triage: triage(item.headline, item.summary ?? ""),
        });
      }
    } catch {
      /* One symbol failing costs that symbol's coverage and nothing
         else. The page reports how many of the eight answered. */
    }
  }

  /* The same wire syndicates a release to a dozen outlets. Keyed by URL
     first and by headline second, because the URL differs per outlet
     while the headline is usually identical. */
  const seen = new Set<string>();
  const unique = collected.filter((story) => {
    const key = story.headline.trim().toLowerCase().slice(0, 90);
    if (seen.has(key) || seen.has(story.url)) return false;
    seen.add(key);
    seen.add(story.url);
    return true;
  });

  /* Anything triaged as a catalyst leads, then by recency. The feed
     arrives in time order and time order is the least informative sort a
     news list can have. */
  const ranked = [
    ...unique.filter((story) => story.triage.kind === "catalyst"),
    ...unique.filter((story) => story.triage.kind !== "catalyst"),
  ].sort((a, b) => {
    const catalystA = a.triage.kind === "catalyst" ? 1 : 0;
    const catalystB = b.triage.kind === "catalyst" ? 1 : 0;
    if (catalystA !== catalystB) return catalystB - catalystA;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return {
    stories: ranked.slice(0, 24),
    covered,
    total: DUAL_LISTED.length,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Twenty minutes, matching the news workflow's cadence.
 *
 * Eight Finnhub calls per rebuild against a sixty-a-minute ceiling shared
 * by the whole site, so this must never run per reader.
 */
export const getIsraelNews = unstable_cache(build, ["israel-news", "v1"], {
  revalidate: 1200,
  tags: ["news", "israel"],
});
