/**
 * Finnhub — live US quotes and company news.
 *
 * Free tier: 60 calls/minute, real-time US equities (no 15-minute delay),
 * and a WebSocket capped at 50 symbols. The licence covers personal,
 * non-commercial use only — see .claude/memory/data_sources.md.
 */

import { z } from "zod";

const BASE = "https://finnhub.io/api/v1";

function apiKey(): string {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) throw new Error("FINNHUB_API_KEY is not set.");
  return key;
}

/** Finnhub returns terse single-letter fields; validate before trusting them. */
const quoteSchema = z.object({
  c: z.number(), // current
  d: z.number().nullable(), // change
  dp: z.number().nullable(), // change percent
  h: z.number(), // day high
  l: z.number(), // day low
  o: z.number(), // open
  pc: z.number(), // previous close
  t: z.number(), // unix timestamp
});

export type Quote = {
  symbol: string;
  price: number;
  change: number | null;
  changePercent: number | null;
  high: number;
  low: number;
  open: number;
  previousClose: number;
  at: Date;
};

async function finnhubFetch(path: string, revalidate: number) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}token=${apiKey()}`;
  const res = await fetch(url, { next: { revalidate } });
  if (!res.ok) {
    throw new Error(`Finnhub ${res.status} ${res.statusText} for ${path}`);
  }
  return res.json();
}

export async function getQuote(symbol: string): Promise<Quote> {
  const raw = await finnhubFetch(
    `/quote?symbol=${encodeURIComponent(symbol)}`,
    30,
  );
  const q = quoteSchema.parse(raw);
  return {
    symbol: symbol.toUpperCase(),
    price: q.c,
    change: q.d,
    changePercent: q.dp,
    high: q.h,
    low: q.l,
    open: q.o,
    previousClose: q.pc,
    at: new Date(q.t * 1000),
  };
}

/** Quotes for several symbols. Failures are isolated so one bad ticker
 *  never blanks the whole row. */
export async function getQuotes(symbols: string[]): Promise<(Quote | null)[]> {
  const results = await Promise.allSettled(symbols.map(getQuote));
  return results.map((r) => (r.status === "fulfilled" ? r.value : null));
}

const profileSchema = z.object({
  name: z.string().optional(),
  ticker: z.string().optional(),
  exchange: z.string().optional(),
  finnhubIndustry: z.string().optional(),
  country: z.string().optional(),
  currency: z.string().optional(),
  ipo: z.string().optional(),
  weburl: z.string().optional(),
  /** Finnhub reports both of these in millions. */
  marketCapitalization: z.number().optional(),
  shareOutstanding: z.number().optional(),
});

export type Profile = {
  name: string | null;
  exchange: string | null;
  industry: string | null;
  /** Converted to absolute dollars — Finnhub sends millions. */
  marketCap: number | null;
  sharesOutstanding: number | null;
  ipo: string | null;
  website: string | null;
};

export async function getProfile(symbol: string): Promise<Profile | null> {
  const raw = await finnhubFetch(
    `/stock/profile2?symbol=${encodeURIComponent(symbol)}`,
    86_400,
  );
  const p = profileSchema.parse(raw);
  if (!p.name) return null;
  return {
    name: p.name ?? null,
    exchange: p.exchange ?? null,
    industry: p.finnhubIndustry ?? null,
    marketCap:
      p.marketCapitalization !== undefined
        ? p.marketCapitalization * 1_000_000
        : null,
    sharesOutstanding:
      p.shareOutstanding !== undefined ? p.shareOutstanding * 1_000_000 : null,
    ipo: p.ipo ?? null,
    website: p.weburl ?? null,
  };
}

const newsItemSchema = z.object({
  category: z.string(),
  datetime: z.number(),
  headline: z.string(),
  id: z.number(),
  related: z.string(),
  source: z.string(),
  summary: z.string(),
  url: z.string(),
});

export type NewsItem = z.infer<typeof newsItemSchema> & { publishedAt: Date };

export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
): Promise<NewsItem[]> {
  const raw = await finnhubFetch(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
    900,
  );
  const items = z.array(newsItemSchema).parse(raw);
  return items.map((i) => ({ ...i, publishedAt: new Date(i.datetime * 1000) }));
}
