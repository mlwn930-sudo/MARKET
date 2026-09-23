/**
 * FRED — the Federal Reserve Bank of St. Louis economic database.
 *
 * Used for one thing at present, and it is not a decorative one: the
 * ten-year Treasury yield is the risk-free rate in the cost-of-capital
 * calculation. Hard-coding it would mean that every WACC on the site
 * silently assumes the rate environment of the day the code was written,
 * which is the kind of error that stays invisible for a year.
 *
 * The key is free and issued without a credit card at
 * https://fredaccount.stlouisfed.org/apikeys — see .env.local.
 *
 * Failure is a missing number, never a thrown error. When the rate cannot
 * be fetched the caller falls back to a stated assumption and says so on
 * the page, because a cost of capital built on an undisclosed guess is
 * worse than no cost of capital at all.
 */

import { unstable_cache } from "next/cache";

const BASE = "https://api.stlouisfed.org/fred/series/observations";

export type SeriesPoint = { date: string; value: number };

export type FredSeries = {
  id: string;
  label: string;
  latest: SeriesPoint | null;
  /** Oldest first, for drawing. */
  history: SeriesPoint[];
};

/** The series this project reads, with the Hebrew label each carries. */
export const FRED_SERIES = {
  DGS10: "תשואת אג״ח ממשלתי 10 שנים",
  DGS2: "תשואת אג״ח ממשלתי שנתיים",
  FEDFUNDS: "ריבית הפד",
  CPIAUCSL: "מדד המחירים לצרכן",
  UNRATE: "שיעור האבטלה",
  T10Y2Y: "מרווח 10 שנים מול שנתיים",
} as const;

export type FredSeriesId = keyof typeof FRED_SERIES;

async function fetchSeries(
  id: FredSeriesId,
  limit: number,
): Promise<FredSeries | null> {
  const key = process.env.FRED_API_KEY;
  if (!key) return null;

  try {
    const url =
      `${BASE}?series_id=${id}&api_key=${key}&file_type=json` +
      `&sort_order=desc&limit=${limit}`;

    const res = await fetch(url, {
      signal: AbortSignal.timeout(15_000),
      cache: "no-store",
    });
    if (!res.ok) return null;

    const json = await res.json();
    const rows: { date: string; value: string }[] = json?.observations ?? [];

    // FRED writes "." for a day with no observation — a market holiday on a
    // daily series. Number(".") is NaN, which would poison every average
    // downstream, so those rows are dropped rather than coerced.
    const history: SeriesPoint[] = [];
    for (const row of rows) {
      const value = Number(row.value);
      if (Number.isFinite(value)) history.push({ date: row.date, value });
    }
    history.reverse();

    return {
      id,
      label: FRED_SERIES[id],
      latest: history[history.length - 1] ?? null,
      history,
    };
  } catch {
    return null;
  }
}

/** Cached for six hours. These series publish daily at most, and the
 *  ten-year yield moving four basis points does not change a WACC. */
export function getSeries(
  id: FredSeriesId,
  limit = 260,
): Promise<FredSeries | null> {
  return unstable_cache(
    () => fetchSeries(id, limit),
    ["fred-series", id, String(limit)],
    { revalidate: 21_600, tags: ["macro", `macro:${id}`] },
  )();
}

/**
 * The risk-free rate, as a decimal.
 *
 * Returns null rather than a default when FRED is unreachable. The decision
 * about what to assume instead belongs to the caller, which has to disclose
 * the assumption on the page — a silent fallback here would launder a guess
 * into a number that looks measured.
 */
export async function getRiskFreeRate(): Promise<number | null> {
  const series = await getSeries("DGS10", 5);
  const latest = series?.latest?.value;
  if (latest === undefined || !Number.isFinite(latest)) return null;
  return latest / 100;
}
