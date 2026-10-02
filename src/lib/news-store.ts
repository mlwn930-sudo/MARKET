/**
 * Reads the news feed and the Hebrew analysis written alongside it.
 *
 * The site never calls a news API during a request. scripts/refresh-news.mjs
 * pulls from Finnhub on a schedule and writes content/news/latest.json;
 * scripts/summarize-news.mjs writes the analysis into a separate file.
 *
 * Analysis lives apart from the feed, keyed by article URL, because a
 * refresh replaces the article list wholesale. Keeping them separate means a
 * refresh never discards work already done, and a story that reappears in a
 * later cycle keeps the analysis it already has.
 */

import { detectTickers } from "./company-names";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import {
  feedSchema,
  summariesFileSchema,
  type ArticleSummary,
  type EnrichedArticle,
  type EnrichedSector,
  type NewsFeed,
} from "./news-shape";

/* The shape lives in news-shape.ts so client components can read it too;
   re-exported here because every existing import points at this file. */
export * from "./news-shape";

const EMPTY_FEED: NewsFeed = { refreshedAt: null, sectors: [] };

// The third type argument pins T to the schema's OUTPUT type. Without it,
// TypeScript infers the input type, and fields carrying .default() come back
// as optional even though parsing always fills them.
async function readJson<T>(
  relativePath: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
  fallback: T,
): Promise<T> {
  try {
    const raw = await readFile(join(process.cwd(), relativePath), "utf8");
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : fallback;
  } catch {
    return fallback;
  }
}

export async function getNewsFeed(): Promise<NewsFeed> {
  return readJson("content/news/latest.json", feedSchema, EMPTY_FEED);
}

export async function getSummaries(): Promise<Record<string, ArticleSummary>> {
  const file = await readJson(
    "content/news/summaries.json",
    summariesFileSchema,
    { writtenAt: null, summaries: {} },
  );
  return file.summaries;
}

export type EnrichedFeed = {
  refreshedAt: string | null;
  sectors: EnrichedSector[];
  analysedCount: number;
  totalCount: number;
};

/** The feed with analysis merged in. An article without analysis renders as
 *  a plain headline rather than being hidden — no analysis means nobody has
 *  written it yet, not that the story is unimportant. */
export async function getEnrichedFeed(): Promise<EnrichedFeed> {
  const [feed, summaries] = await Promise.all([getNewsFeed(), getSummaries()]);

  let analysedCount = 0;
  let totalCount = 0;

  const sectors = feed.sectors.map((sector) => ({
    ...sector,
    articles: sector.articles.map((article) => {
      totalCount++;
      const analysis = summaries[article.url] ?? null;
      if (analysis) analysedCount++;
      return { ...article, analysis };
    }),
  }));

  return { refreshedAt: feed.refreshedAt, sectors, analysedCount, totalCount };
}

/**
 * Every article that mentions a ticker, newest first, together with the
 * moment the feed itself was last refreshed.
 *
 * The second half is the part that matters to a caller reasoning about
 * coverage. A company nobody wrote about this week and a feed that has not
 * run since Tuesday produce the same empty list, and only the refresh time
 * tells them apart.
 */
export async function getTickerCoverage(
  ticker: string,
  limit = 8,
): Promise<{ refreshedAt: string | null; articles: EnrichedArticle[] }> {
  const { sectors, refreshedAt } = await getEnrichedFeed();
  const symbol = ticker.toUpperCase();
  const byUrl = new Map<string, EnrichedArticle>();

  /**
   * Tagged is not the same as about.
   *
   * `article.tickers` comes from the provider's own `related` field, and
   * that field is generous: a piece headlined "What a $3,000 Investment in
   * Walmart Stock Could Be Worth in 1 Year" arrived tagged NVDA and
   * appeared, verbatim, in NVIDIA's news corner. A company page that shows
   * someone else's story is worse than one that shows nothing, because the
   * reader has no way to tell which items are real.
   *
   * So a tag has to be corroborated by the words. Either the ticker or one
   * of the company's known names has to appear in the headline or the
   * summary — detectTickers already does exactly that matching for the
   * research box, including the Hebrew aliases, and it is the same question
   * here.
   *
   * The model's own `analysis.tickers` is trusted without the check: it was
   * produced by reading the article, which is the corroboration.
   */
  for (const sector of sectors) {
    for (const article of sector.articles) {
      if (byUrl.has(article.url)) continue;

      const readByModel = article.analysis?.tickers.includes(symbol) ?? false;
      const tagged = article.tickers.includes(symbol);
      const inWords =
        tagged &&
        detectTickers(`${article.title} ${article.excerpt}`, 8).includes(
          symbol,
        );

      if (readByModel || inWords) byUrl.set(article.url, article);
    }
  }

  const articles = [...byUrl.values()]
    .sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""))
    .slice(0, limit);

  return { refreshedAt, articles };
}

/** The article list on its own, for the callers that only render it. */
export async function getArticlesForTicker(
  ticker: string,
  limit = 8,
): Promise<EnrichedArticle[]> {
  const { articles } = await getTickerCoverage(ticker, limit);
  return articles;
}

/** True when the feed is older than three hours. GitHub throttles scheduled
 *  workflows well beyond their stated cadence, so the threshold is set by
 *  what actually happens rather than by the cron expression. */
export function isFeedStale(refreshedAt: string | null): boolean {
  if (!refreshedAt) return true;
  const age = Date.now() - new Date(refreshedAt).getTime();
  return !Number.isFinite(age) || age > 3 * 60 * 60 * 1000;
}

