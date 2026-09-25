/**
 * The shape of the news feed, and the words the site uses about it.
 *
 * Split out of news-store.ts for one concrete reason: news-store reads
 * files, so it imports node:fs, and anything that imports it is therefore
 * server-only. The "analyse this story" button is a client component and
 * needs the same type and the same labels — importing them from there
 * pulled node:fs into a browser bundle and failed the build.
 *
 * So the schemas, the types and the labels live here, where both sides can
 * reach them, and news-store re-exports them so nothing else had to change.
 */

import { z } from "zod";


export const articleSchema = z.object({
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

export const sectorSchema = z.object({
  sector: z.string(),
  label: z.string(),
  blurb: z.string().optional().default(""),
  /** Hex colour that identifies the sector across the site. */
  accent: z.string().optional().default("#0a84ff"),
  ok: z.boolean(),
  // Per-sector, because a sector with nothing new keeps its previous
  // articles and is therefore older than the feed as a whole.
  refreshedAt: z.string().nullable().optional(),
  articles: z.array(articleSchema),
});

export const feedSchema = z.object({
  refreshedAt: z.string().nullable(),
  sectors: z.array(sectorSchema),
});

/** Written by scripts/summarize-news.mjs. `impact` explains what the story
 *  means for sectors and companies — never a recommendation to buy or sell. */
export const summarySchema = z.object({
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

export const summariesFileSchema = z.object({
  writtenAt: z.string().nullable(),
  summaries: z.record(z.string(), summarySchema),
  // URLs with no usable text, and when we gave up. Kept so a paywalled
  // article is not re-requested every cycle forever.
  unfetchable: z.record(z.string(), z.string()).optional(),
});

export type NewsFeed = z.infer<typeof feedSchema>;
export type NewsArticle = z.infer<typeof articleSchema>;
export type ArticleSummary = z.infer<typeof summarySchema>;

export type EnrichedArticle = NewsArticle & {
  analysis: ArticleSummary | null;
  /** The instant rule-based reading. Present on every live article; absent
   *  on articles coming straight from the stored file. See news-triage.ts. */
  triage?: import("./news-triage").Triage;
};

export type EnrichedSector = Omit<z.infer<typeof sectorSchema>, "articles"> & {
  articles: EnrichedArticle[];
};

/* ------------------------------------------------------------------ */
/* The words                                                           */
/* ------------------------------------------------------------------ */

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

