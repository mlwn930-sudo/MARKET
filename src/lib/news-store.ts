/**
 * Reads the news feed that the background job wrote.
 *
 * The site never calls GDELT during a request. GDELT allows about one
 * request every 5 seconds and punishes bursts with a long cooldown, so
 * fetching at request time produced page loads of 30 to 400 seconds and
 * frequent failures. scripts/refresh-news.mjs does that work on a schedule
 * and writes content/news/latest.json; this module just reads it.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";

const articleSchema = z.object({
  url: z.string(),
  title: z.string(),
  domain: z.string(),
  country: z.string().nullable(),
  seenAt: z.string().nullable(),
});

const feedSchema = z.object({
  refreshedAt: z.string().nullable(),
  sectors: z.array(
    z.object({
      sector: z.string(),
      label: z.string(),
      ok: z.boolean(),
      // Per-sector, because a sector whose refresh failed keeps the
      // articles from its last good run and is therefore older than the
      // feed as a whole. Optional so feeds written before this existed
      // still parse.
      refreshedAt: z.string().nullable().optional(),
      articles: z.array(articleSchema),
    }),
  ),
});

export type NewsFeed = z.infer<typeof feedSchema>;
export type NewsArticle = z.infer<typeof articleSchema>;

const EMPTY: NewsFeed = { refreshedAt: null, sectors: [] };

export async function getNewsFeed(): Promise<NewsFeed> {
  try {
    const raw = await readFile(
      join(process.cwd(), "content/news/latest.json"),
      "utf8",
    );
    const parsed = feedSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY;
  } catch {
    return EMPTY;
  }
}

/** True when the feed is older than two hours — the refresh job is meant to
 *  run every 20 minutes, so that gap means something is wrong with it. */
export function isFeedStale(feed: NewsFeed): boolean {
  if (!feed.refreshedAt) return true;
  const age = Date.now() - new Date(feed.refreshedAt).getTime();
  return !Number.isFinite(age) || age > 2 * 60 * 60 * 1000;
}
