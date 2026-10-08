import { unstable_cache } from "next/cache";
import { getCompanyNews } from "@/lib/sources/finnhub";
import { getSummaries } from "@/lib/news-store";
import type { ArticleSummary } from "@/lib/news-shape";

/**
 * The news for one company, from the company's own wire.
 *
 * The watchlist page used to filter the site's general market feed, and
 * the arithmetic of that was hopeless: the feed holds a hundred articles
 * about the whole market, NVDA was tagged on five of them and TTWO on
 * one. A reader who adds a company to a watchlist and sees two stories —
 * or none — concludes the feature is broken, and they are right to.
 *
 * Finnhub's per-symbol endpoint is on the same free tier and carries
 * 248 NVDA stories and 12 TTWO stories over the same week. It was already
 * in the codebase, used by the Israel page for exactly this reason, and
 * the watchlist was the one place that needed it most and did not use it.
 *
 * WHY THIS IS NOT HOW THE WHOLE SITE WORKS. One request per symbol is
 * fine for a handful of followed names and impossible for a hundred and
 * twenty-three: the market pages keep the shared feed because a single
 * request for everybody is what keeps the site inside the free tier. The
 * watchlist is small by definition, which is what makes the expensive
 * shape affordable exactly here.
 *
 * The readings are the ones the scheduled job already wrote. Nothing is
 * generated on a page render — an article with no analysis arrives
 * saying so, and the queue reaches it on its own schedule.
 */

export type WatchArticle = {
  url: string;
  title: string;
  source: string;
  summary: string;
  at: string;
  /** The site's own reading, when the queue has produced one. */
  analysis: ArticleSummary | null;
};

/** A fortnight. Long enough that a quiet company still shows something,
 *  short enough that nothing on the page is stale news presented as
 *  current. */
const WINDOW_DAYS = 14;

/** Per company. The page shows a handful and the rest is noise in a
 *  panel somebody scrolls past. */
const PER_COMPANY = 8;

const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86_400_000).toISOString().slice(0, 10);

/** The wire's own fields, before any reading is attached. */
type RawArticle = Omit<WatchArticle, "analysis">;

/**
 * The wire only. The readings are joined afterwards, on purpose.
 *
 * The first version of this cached the JOINED result, and that froze
 * every article's analysis for the life of the cache: the queue would
 * write a reading and the watchlist would go on saying "not yet
 * analysed" for ten minutes — which is most of the window in which
 * somebody actually wants it. Observed directly: eleven NVDA articles
 * were analysed and the page still reported none.
 *
 * What is worth caching is the external request. Reading the summaries
 * is a local file, so doing it fresh on every call costs nothing and a
 * reading appears the moment it exists.
 */
async function wireFor(symbol: string): Promise<RawArticle[]> {
  const items = await getCompanyNews(symbol, iso(-WINDOW_DAYS), iso(0)).catch(
    () => [],
  );

  const seen = new Set<string>();
  const rows: RawArticle[] = [];

  for (const item of items) {
    const url = item.url?.trim();
    const title = item.headline?.trim();
    if (!url || !title || seen.has(url)) continue;
    seen.add(url);
    rows.push({
      url,
      title,
      source: item.source ?? "",
      summary: (item.summary ?? "").slice(0, 300),
      /* Finnhub dates a story as a Unix second; the rest of the site
         works in ISO strings, and mixing the two is how a sort silently
         stops sorting. */
      at: item.publishedAt?.toISOString() ?? "",
    });
    if (rows.length >= PER_COMPANY) break;
  }

  return rows;
}

/**
 * The company's stories, each with the site's reading where one exists.
 *
 * The wire is cached for ten minutes per symbol — the same window the
 * rest of the site uses for a figure somebody is reading rather than
 * trading on, and it means moving between a watchlist and a company page
 * costs one request instead of two. Tagged `news` so the refresh button
 * clears it with everything else.
 *
 * The readings are joined outside that cache, so they are never stale.
 */
export async function watchlistNews(symbol: string): Promise<WatchArticle[]> {
  const upper = symbol.toUpperCase();
  const [wire, stored] = await Promise.all([
    unstable_cache(() => wireFor(upper), ["watchlist-wire", upper], {
      revalidate: 600,
      tags: ["news"],
    })(),
    getSummaries().catch(() => ({}) as Record<string, ArticleSummary>),
  ]);
  return wire.map((article) => ({
    ...article,
    analysis: stored[article.url] ?? null,
  }));
}
