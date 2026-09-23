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

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const articleSchema = z.object({
  url: z.string(),
  title: z.string(),
  /** The publisher's own summary, carried by the feed. */
  excerpt: z.string().optional().default(""),
  image: z.string().nullable().optional().default(null),
  domain: z.string(),
  country: z.string().nullable().optional().default(null),
  seenAt: z.string().nullable(),
  tickers: z.array(z.string()).optional().default([]),
});

const sectorSchema = z.object({
  sector: z.string(),
  label: z.string(),
  blurb: z.string().optional().default(""),
  /** Hex colour that identifies the sector across the site. */
  accent: z.string().optional().default("#c9a227"),
  ok: z.boolean(),
  // Per-sector, because a sector with nothing new keeps its previous
  // articles and is therefore older than the feed as a whole.
  refreshedAt: z.string().nullable().optional(),
  articles: z.array(articleSchema),
});

const feedSchema = z.object({
  refreshedAt: z.string().nullable(),
  sectors: z.array(sectorSchema),
});

/** Written by scripts/summarize-news.mjs. `impact` explains what the story
 *  means for sectors and companies — never a recommendation to buy or sell. */
const summarySchema = z.object({
  summary: z.string(),
  impact: z.string(),
  /* The three lenses every story is read through. Optional because the feed
     already holds analyses written before they existed, and because a model
     that returns four good fields and drops the fifth should not cost us the
     whole entry — the article would then be re-analysed every cycle for
     ever. See scripts/summarize-news.mjs. */
  catalyst: z.string().optional(),
  catalystKind: z.enum(["catalyst", "noise", "unclear"]).optional(),
  reaction: z.string().optional(),
  chain: z.string().optional(),
  tickers: z.array(z.string()).default([]),
  significance: z.enum(["high", "medium", "low"]).default("medium"),
  writtenAt: z.string().optional(),
});

const summariesFileSchema = z.object({
  writtenAt: z.string().nullable(),
  summaries: z.record(z.string(), summarySchema),
  // URLs with no usable text, and when we gave up. Kept so a paywalled
  // article is not re-requested every cycle forever.
  unfetchable: z.record(z.string(), z.string()).optional(),
});

export type NewsFeed = z.infer<typeof feedSchema>;
export type NewsArticle = z.infer<typeof articleSchema>;
export type ArticleSummary = z.infer<typeof summarySchema>;

export type EnrichedArticle = NewsArticle & { analysis: ArticleSummary | null };

export type EnrichedSector = Omit<
  z.infer<typeof sectorSchema>,
  "articles"
> & { articles: EnrichedArticle[] };

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

/** Every article that mentions a ticker, newest first. Used by the company
 *  page to show what is being written about that company right now. */
export async function getArticlesForTicker(
  ticker: string,
  limit = 8,
): Promise<EnrichedArticle[]> {
  const { sectors } = await getEnrichedFeed();
  const symbol = ticker.toUpperCase();
  const byUrl = new Map<string, EnrichedArticle>();

  for (const sector of sectors) {
    for (const article of sector.articles) {
      const mentioned =
        article.tickers.includes(symbol) ||
        article.analysis?.tickers.includes(symbol);
      if (mentioned && !byUrl.has(article.url)) byUrl.set(article.url, article);
    }
  }

  return [...byUrl.values()]
    .sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""))
    .slice(0, limit);
}

/** True when the feed is older than three hours. GitHub throttles scheduled
 *  workflows well beyond their stated cadence, so the threshold is set by
 *  what actually happens rather than by the cron expression. */
export function isFeedStale(refreshedAt: string | null): boolean {
  if (!refreshedAt) return true;
  const age = Date.now() - new Date(refreshedAt).getTime();
  return !Number.isFinite(age) || age > 3 * 60 * 60 * 1000;
}

export const SIGNIFICANCE_LABELS: Record<
  ArticleSummary["significance"],
  string
> = {
  high: "השפעה גבוהה",
  medium: "השפעה בינונית",
  low: "השפעה נמוכה",
};

/**
 * The catalyst verdict, in the words used on the page.
 *
 * "Noise" is the label that makes the feed useful. Most of what reaches a
 * news feed changes nothing about a business, and a tool that presents every
 * headline as meaningful teaches the reader to react to all of them.
 */
export const CATALYST_LABELS: Record<
  NonNullable<ArticleSummary["catalystKind"]>,
  { label: string; note: string }
> = {
  catalyst: {
    label: "זרז",
    note: "האירוע משנה תזרים, תחרות או רגולציה",
  },
  noise: {
    label: "רעש",
    note: "כותרת שלא משנה את העסק",
  },
  unclear: {
    label: "לא הוכרע",
    note: "הכתבה לא נותנת די כדי לקבוע",
  },
};
