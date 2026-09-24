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

/**
 * Quotes for several symbols. Failures are isolated so one bad ticker never
 * blanks the whole row.
 *
 * Issued in batches rather than all at once. The market map asks for
 * forty-eight symbols in one call, and forty-eight simultaneous requests
 * arrive at Finnhub as a burst that the free tier answers with 429s — which
 * reach the page as missing prices on a third of the map. Twelve at a time
 * costs a few hundred milliseconds and returns a complete map.
 */
const QUOTE_BATCH = 12;

export async function getQuotes(symbols: string[]): Promise<(Quote | null)[]> {
  const out: (Quote | null)[] = [];

  for (let i = 0; i < symbols.length; i += QUOTE_BATCH) {
    const batch = symbols.slice(i, i + QUOTE_BATCH);
    const results = await Promise.allSettled(batch.map(getQuote));
    out.push(...results.map((r) => (r.status === "fulfilled" ? r.value : null)));
  }

  return out;
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

/**
 * The general market wire.
 *
 * Cached for two minutes, which is the whole point: the page reads this on
 * every visit, and without a shared cache a handful of open tabs would spend
 * the minute's allowance on a feed that changes a few times an hour. Two
 * minutes is short enough that a story reaches the site while it is still
 * news and long enough that the cost does not scale with readers.
 */
export async function getGeneralNews(): Promise<NewsItem[]> {
  const raw = await finnhubFetch("/news?category=general", 120);
  const items = z.array(newsItemSchema).safeParse(raw);
  if (!items.success) return [];
  return items.data.map((i) => ({
    ...i,
    publishedAt: new Date(i.datetime * 1000),
  }));
}

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

/* ==================================================================== */
/* Company intelligence                                                 */
/* ==================================================================== */

/**
 * The endpoints below were verified against the free tier before being
 * built on, because the plan's limits are not documented in one place and
 * guessing wrong means a feature that works in development and returns 403
 * in production.
 *
 * Available: basic financials (including multi-year ratio series), EPS
 * surprises, the peer list, the analyst distribution, the earnings
 * calendar.
 *
 * NOT available: price targets and revenue consensus, which return 403.
 * Nothing in this project may present an estimate it cannot fetch, so
 * forward revenue and target prices simply do not appear on the site.
 */

export type MetricSeriesPoint = { period: string; v: number };

export type BasicFinancials = {
  symbol: string;
  /** Point-in-time figures: 133 of them, keyed as Finnhub names them. */
  metric: Record<string, number | string | null>;
  /** Ratio history — the basis for comparing a multiple to the company's
   *  own past rather than only to its sector. */
  annual: Record<string, MetricSeriesPoint[]>;
  quarterly: Record<string, MetricSeriesPoint[]>;
};

export async function getBasicFinancials(
  symbol: string,
): Promise<BasicFinancials | null> {
  try {
    const raw = await finnhubFetch(
      `/stock/metric?symbol=${encodeURIComponent(symbol)}&metric=all`,
      3600,
    );
    if (!raw?.metric) return null;
    return {
      symbol: symbol.toUpperCase(),
      metric: raw.metric ?? {},
      annual: raw.series?.annual ?? {},
      quarterly: raw.series?.quarterly ?? {},
    };
  } catch {
    return null;
  }
}

export type EarningsSurprise = {
  period: string;
  year: number;
  quarter: number;
  /** What analysts expected. Null on the rare row that carries no estimate. */
  estimate: number | null;
  /** What the company reported. Null for a quarter not yet reported — which
   *  is how the forthcoming quarter's estimate arrives. */
  actual: number | null;
  surprise: number | null;
  surprisePercent: number | null;
};

/**
 * Reported earnings against what was expected.
 *
 * The most recent row is usually the quarter that has NOT been reported
 * yet: an estimate with a null actual. That row is the only forward-looking
 * figure this project has, and it is labelled as an estimate everywhere it
 * appears rather than being folded in with reported results.
 */
export async function getEarningsSurprises(
  symbol: string,
): Promise<EarningsSurprise[]> {
  try {
    const raw = await finnhubFetch(
      `/stock/earnings?symbol=${encodeURIComponent(symbol)}`,
      3600,
    );
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => ({
        period: String(row.period ?? ""),
        year: Number(row.year ?? 0),
        quarter: Number(row.quarter ?? 0),
        estimate: Number.isFinite(row.estimate) ? row.estimate : null,
        actual: Number.isFinite(row.actual) ? row.actual : null,
        surprise: Number.isFinite(row.surprise) ? row.surprise : null,
        surprisePercent: Number.isFinite(row.surprisePercent)
          ? row.surprisePercent
          : null,
      }))
      .filter((row) => row.period)
      .sort((a, b) => a.period.localeCompare(b.period));
  } catch {
    return [];
  }
}

/** Who the data provider considers this company's peers. Used rather than a
 *  hand-written list so the comparison does not encode our own assumptions
 *  about who competes with whom. */
export async function getPeers(symbol: string): Promise<string[]> {
  try {
    const raw = await finnhubFetch(
      `/stock/peers?symbol=${encodeURIComponent(symbol)}`,
      86_400,
    );
    if (!Array.isArray(raw)) return [];
    return raw
      .filter((s): s is string => typeof s === "string")
      .map((s) => s.toUpperCase())
      .filter((s) => s !== symbol.toUpperCase())
      .slice(0, 8);
  } catch {
    return [];
  }
}

export type AnalystView = {
  period: string;
  strongBuy: number;
  buy: number;
  hold: number;
  sell: number;
  strongSell: number;
};

/**
 * How sell-side analysts are positioned.
 *
 * Carried as sentiment, not as a signal. A wall of "buy" on a stock that
 * has already tripled says more about what has happened than about what
 * will, and the page frames it that way.
 */
export async function getAnalystViews(
  symbol: string,
): Promise<AnalystView[]> {
  try {
    const raw = await finnhubFetch(
      `/stock/recommendation?symbol=${encodeURIComponent(symbol)}`,
      86_400,
    );
    if (!Array.isArray(raw)) return [];
    return raw
      .map((row) => ({
        period: String(row.period ?? ""),
        strongBuy: Number(row.strongBuy ?? 0),
        buy: Number(row.buy ?? 0),
        hold: Number(row.hold ?? 0),
        sell: Number(row.sell ?? 0),
        strongSell: Number(row.strongSell ?? 0),
      }))
      .filter((row) => row.period)
      .sort((a, b) => b.period.localeCompare(a.period));
  } catch {
    return [];
  }
}

export type EarningsDate = {
  symbol: string;
  date: string;
  hour: string;
  epsEstimate: number | null;
  revenueEstimate: number | null;
};

/**
 * Upcoming reporting dates.
 *
 * The one genuinely scheduled future event this project can know about, and
 * therefore the backbone of the catalyst list. Everything else a launch
 * page might call a catalyst is an expectation; this is a date.
 *
 * Fetched for a window rather than per symbol — the calendar is one request
 * for the whole market, and asking per company would be dozens.
 */
export async function getEarningsCalendar(
  from: string,
  to: string,
): Promise<Map<string, EarningsDate>> {
  try {
    const raw = await finnhubFetch(
      `/calendar/earnings?from=${from}&to=${to}`,
      21_600,
    );
    const rows: unknown[] = raw?.earningsCalendar ?? [];
    const bySymbol = new Map<string, EarningsDate>();

    for (const row of rows as Record<string, unknown>[]) {
      const symbol = typeof row.symbol === "string" ? row.symbol : null;
      const date = typeof row.date === "string" ? row.date : null;
      if (!symbol || !date) continue;

      // Keep the nearest date per symbol; the window can contain more than
      // one when a company reports twice inside it.
      const existing = bySymbol.get(symbol);
      if (existing && existing.date <= date) continue;

      bySymbol.set(symbol, {
        symbol,
        date,
        hour: typeof row.hour === "string" ? row.hour : "",
        epsEstimate: Number.isFinite(row.epsEstimate)
          ? (row.epsEstimate as number)
          : null,
        revenueEstimate: Number.isFinite(row.revenueEstimate)
          ? (row.revenueEstimate as number)
          : null,
      });
    }

    return bySymbol;
  } catch {
    return new Map();
  }
}
