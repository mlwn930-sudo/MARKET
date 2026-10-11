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

/**
 * What a caller may say about caching, when the default written at the call
 * site below is wrong for it.
 *
 * `tags` is the half that is easy to get wrong. A wrapper such as
 * `unstable_cache` carries tags of its own, and those tags are *not* passed
 * down to the fetch inside it — Next collects fetch tags onto a parent cache
 * or prerender store, and an `unstable-cache` store is explicitly skipped.
 * So an untagged fetch inside a tagged wrapper survives `revalidateTag`: the
 * wrapper is dropped, the callback re-runs, and the same payload comes back
 * out of the data cache. A fetch that wants to be droppable has to carry the
 * tags itself, which is what this passes through.
 */
export type CacheControl = {
  /** Seconds. Replaces the default the call site chose. */
  revalidate?: number;
  /** Next data-cache tags on the request itself. */
  tags?: string[];
};

async function finnhubFetch(
  path: string,
  revalidate: number,
  tags?: string[],
) {
  const url = `${BASE}${path}${path.includes("?") ? "&" : "?"}token=${apiKey()}`;
  const res = await fetch(url, {
    next: tags && tags.length > 0 ? { revalidate, tags } : { revalidate },
  });
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

/**
 * One company's wire, over a date window.
 *
 * Fifteen minutes by default, which is what the scheduled callers want: they
 * sweep a dozen symbols in one pass and run on a timer of their own, so a
 * quarter of an hour of reuse is free coverage. A caller that renders this
 * inside a page is a different case — the page is what a reader is looking
 * at — and passes its own window and its own tags through `cache`.
 */
export async function getCompanyNews(
  symbol: string,
  from: string,
  to: string,
  cache: CacheControl = {},
): Promise<NewsItem[]> {
  const raw = await finnhubFetch(
    `/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}`,
    cache.revalidate ?? 900,
    cache.tags,
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
  return (await calendarWindow(from, to)).bySymbol;
}

/**
 * One window, with whether the reply was cut kept alongside it.
 *
 * The row count is the whole point and the Map throws it away: a window
 * that holds no match and a window that was sliced before the match look
 * identical once the rows are folded by symbol. Everything below depends
 * on telling those two apart.
 */
async function calendarWindow(
  from: string,
  to: string,
): Promise<{
  bySymbol: Map<string, EarningsDate>;
  truncated: boolean;
  failed: boolean;
}> {
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

    return {
      bySymbol,
      truncated: calendarWasTruncated(rows.length),
      failed: false,
    };
  } catch {
    /* A failed request is not an empty calendar. It is also not a cut
       one: narrowing a window that failed would turn one outage into
       twenty requests that fail the same way. The search abandons
       instead, and the caller gets no date rather than a wrong one. */
    return { bySymbol: new Map(), truncated: false, failed: true };
  }
}

/**
 * The free calendar truncates, and it does not say so.
 *
 * Measured, after a company page reported NVDA's next results as
 * 2027-02-23 when the answer was 2026-11-17:
 *
 *   2026-10-05 .. 2027-02-24   1500 rows   NVDA 2027-02-23
 *   2026-10-05 .. 2026-12-06   1500 rows   NVDA 2026-11-17
 *   2026-11-01 .. 2026-11-30   1500 rows   NVDA 2026-11-17
 *
 * Exactly 1500 every time. The endpoint caps its response and returns a
 * slice, so a window wide enough to be useful silently loses the near
 * dates — and what comes back still looks like a complete answer. A wrong
 * date here is worse than no date: a reader plans around it.
 *
 * So the window is never widened. This walks forward in short steps and
 * stops at the first one containing the symbol. Each step is a separate
 * cached request shared by every company on the site, so the second
 * company to ask pays nothing, and a symbol that reports next week is
 * found on the first call.
 *
 * It also reports truncation rather than hiding it: a step that comes back
 * at exactly the cap cannot be trusted to be complete, and the search
 * narrows it rather than stepping past it.
 *
 * That last sentence described an intention this file did not carry out,
 * and the cost was measured on TTWO on 2026-10-11:
 *
 *   2026-10-09 .. 2026-11-20   1500 rows, capped   TTWO absent
 *   2026-10-25 .. 2026-11-08   1500 rows, capped   TTWO 2026-11-04
 *
 * The first window contains the second. The symbol is inside both and the
 * wider reply dropped it, so stepping forward returned 2027-02-01 — the
 * quarter after next — and the site told its one reader that nothing was
 * due for a hundred and twelve days when results were twenty-four days
 * out. A horizon that does contain a report read as one that does not,
 * which is the most expensive way for a calendar to be wrong.
 */
const CALENDAR_CAP = 1500;
const STEP_DAYS = 40;
const MAX_STEPS = 4;
/**
 * How a capped window gets broken up, largest slice first.
 *
 * The cap removes the tail: in the measurement above the symbol survived
 * inside a capped fourteen-day window and vanished from a capped
 * forty-day one, which is what truncation by date does. So narrowing is
 * not a guess, it is how the missing dates are reached.
 *
 * Three days is where it stops because the busiest session on the US
 * calendar is a few hundred companies and a three-day slice has no route
 * to fifteen hundred rows. Only slices that came back capped are narrowed
 * further, so a quiet month is still a single request, and every slice is
 * cached for six hours and shared by every company on the site.
 */
const NARROW_LADDER = [10, 3];

/** One window's reply: the dates folded by symbol, whether the list was
 *  cut at the cap, and whether the request failed at all. The three are
 *  genuinely different answers, and collapsing any two of them is how a
 *  wrong date gets printed with confidence. */
export type CalendarReader = (
  from: string,
  to: string,
) => Promise<{
  bySymbol: Map<string, EarningsDate>;
  truncated: boolean;
  failed: boolean;
}>;

export async function getNextEarnings(
  symbol: string,
  from = new Date(),
): Promise<EarningsDate | null> {
  const upper = symbol.toUpperCase();
  const at = (offset: number) => from.getTime() + offset * 86_400_000;

  for (let step = 0; step < MAX_STEPS; step++) {
    /* The first step reaches two days back, so results that landed
       overnight or in another timezone are still found rather than
       reported as next quarter's. */
    const start = at(step * STEP_DAYS - (step === 0 ? 2 : 0));
    const hit = await searchCalendar(upper, start, at((step + 1) * STEP_DAYS));
    if (hit) return hit;
  }
  return null;
}

/**
 * One window, narrowed where the reply was cut.
 *
 * Returns the nearest date because the slices are walked in order and
 * each reply already keeps the earliest date per symbol. A window that
 * comes back complete and without the symbol is an answer — the company
 * does not report in it — and the search moves on.
 */
export async function searchCalendar(
  symbol: string,
  fromMs: number,
  toMs: number,
  ladder: readonly number[] = NARROW_LADDER,
  /* Injected so the narrowing can be tested without the network. The
     behaviour under test is not "does Finnhub answer" — it is what this
     function concludes from a reply that was cut, and that was wrong for
     as long as there was no way to stage one. */
  read: CalendarReader = calendarWindow,
): Promise<EarningsDate | null> {
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  const { bySymbol, truncated, failed } = await read(iso(fromMs), iso(toMs));

  const hit = bySymbol.get(symbol);
  if (hit) return hit;
  /* Nothing further can be learned from a window whose request failed,
     and nothing needs to be from one that came back whole. */
  if (failed || !truncated || ladder.length === 0) return null;

  const [slice, ...rest] = ladder;
  const sliceMs = slice * 86_400_000;
  for (let start = fromMs; start < toMs; start += sliceMs) {
    const found = await searchCalendar(
      symbol,
      start,
      Math.min(start + sliceMs, toMs),
      rest,
      read,
    );
    if (found) return found;
  }
  return null;
}

/** True when a calendar response came back at the cap, and therefore
 *  cannot be trusted to hold everything in its window. Exported so a
 *  caller that must widen a window can at least know it was cut. */
export function calendarWasTruncated(rows: number): boolean {
  return rows >= CALENDAR_CAP;
}
