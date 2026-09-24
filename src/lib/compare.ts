/**
 * Side by side.
 *
 * The comparison is built from the same precomputed file the screener
 * ranks on, so a figure here and the same figure on the opportunities page
 * cannot disagree. A company outside that file — anything not in the
 * universe — is computed live through the normal analysis path instead, at
 * the cost of a slower first load.
 *
 * What the table deliberately does not do is pick a winner. Every row shows
 * each company against the median of ITS OWN sector, because "P/E 18 versus
 * P/E 34" is a fact about two different businesses and declaring the lower
 * one better is the site making the reader's decision for them. A chipmaker
 * and a bank do not share a scale, and pretending they do is the most
 * common way a comparison tool misleads.
 */

import { getCompanyAnalysis } from "@/lib/company-analysis";
import {
  getFundamentalsFile,
  getSectorContext,
} from "@/lib/fundamentals-store";
import { getQuotes } from "@/lib/sources/finnhub";
import { getRangeHistory } from "@/lib/sources/prices";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";

export type CompareRow = {
  key: string;
  label: string;
  unit: "x" | "%" | "$" | "";
  /** Only used for the hint under the table, never to rank a column. */
  lowerIsBetter?: boolean;
};

export type CompareGroup = { title: string; rows: CompareRow[] };

/** The rows, chosen to answer the three questions the site is built on:
 *  what it costs, what it earns, and whether it can pay its debts. */
export const COMPARE_GROUPS: CompareGroup[] = [
  {
    title: "תמחור",
    rows: [
      { key: "pe", label: "P/E", unit: "x", lowerIsBetter: true },
      { key: "ev_ebitda", label: "EV/EBITDA", unit: "x", lowerIsBetter: true },
      { key: "ev_fcf", label: "EV/FCF", unit: "x", lowerIsBetter: true },
      { key: "ps", label: "P/S", unit: "x", lowerIsBetter: true },
      { key: "fcf_yield", label: "FCF Yield", unit: "%" },
    ],
  },
  {
    title: "רווחיות",
    rows: [
      { key: "gross_margin", label: "Gross Margin", unit: "%" },
      { key: "operating_margin", label: "Operating Margin", unit: "%" },
      { key: "net_margin", label: "Net Margin", unit: "%" },
      { key: "roic", label: "ROIC", unit: "%" },
      { key: "roe", label: "ROE", unit: "%" },
    ],
  },
  {
    title: "צמיחה",
    rows: [
      { key: "rev_cagr_3", label: "צמיחת הכנסות 3ש׳", unit: "%" },
      { key: "rev_cagr_5", label: "צמיחת הכנסות 5ש׳", unit: "%" },
      { key: "op_cagr_3", label: "צמיחת רווח תפעולי 3ש׳", unit: "%" },
      { key: "fcf_margin", label: "FCF Margin", unit: "%" },
      { key: "capex_ratio", label: "CapEx / Revenue", unit: "%", lowerIsBetter: true },
    ],
  },
  {
    title: "מאזן",
    rows: [
      { key: "debt_equity", label: "Debt / Equity", unit: "x", lowerIsBetter: true },
      { key: "net_debt_ebitda", label: "Net Debt / EBITDA", unit: "x", lowerIsBetter: true },
      { key: "current_ratio", label: "Current Ratio", unit: "x" },
      { key: "interest_coverage", label: "Interest Coverage", unit: "x" },
      { key: "altman_z", label: "Altman Z-Score", unit: "" },
    ],
  },
];

export type CompareColumn = {
  ticker: string;
  name: string;
  sectorLabel: string | null;
  peerCount: number | null;
  marketCap: number | null;
  price: number | null;
  changePercent: number | null;
  asOf: string | null;
  stale: boolean;
  inUniverse: boolean;
  metrics: Record<string, number | null>;
  medians: Record<string, number | null>;
  /** Normalised to 100 at the start of the window. Empty when there is no
   *  history — a missing line is better than an invented one. */
  performance: number[];
};

export const MAX_COMPARE = 4;

function normalise(closes: number[]): number[] {
  const first = closes.find((value) => Number.isFinite(value) && value > 0);
  if (!first) return [];
  return closes.map((value) => (value / first) * 100);
}

async function columnFor(ticker: string): Promise<CompareColumn | null> {
  const symbol = ticker.toUpperCase();
  const file = await getFundamentalsFile();
  const listed = file.companies.find((company) => company.ticker === symbol);

  const [sector, history] = await Promise.all([
    getSectorContext(symbol),
    getRangeHistory(symbol, "1Y").catch(() => null),
  ]);

  const performance = normalise(history?.candles.map((c) => c.close) ?? []);

  if (listed) {
    return {
      ticker: symbol,
      name: listed.name,
      sectorLabel:
        SECTOR_LABELS[listed.sector as SectorKey] ?? listed.sector ?? null,
      peerCount: sector?.peerCount ?? null,
      marketCap: listed.marketCap,
      price: null,
      changePercent: null,
      asOf: listed.asOf,
      stale: listed.stale,
      inUniverse: true,
      metrics: listed.metrics,
      medians: sector?.medians ?? {},
      performance,
    };
  }

  // Outside the universe: computed on the spot, through the same path the
  // company page uses, so the numbers are identical to the ones there.
  const analysis = await getCompanyAnalysis(symbol).catch(() => null);
  if (!analysis) return null;

  const metrics: Record<string, number | null> = {};
  for (const group of analysis.fundamentals.groups) {
    for (const metric of group.metrics) metrics[metric.key] = metric.value;
  }

  return {
    ticker: symbol,
    name: analysis.profile?.name ?? analysis.title,
    sectorLabel: null,
    peerCount: null,
    marketCap: analysis.marketCap,
    price: null,
    changePercent: null,
    asOf: analysis.fundamentals.asOf?.end ?? null,
    stale: analysis.fundamentals.stale,
    inUniverse: false,
    metrics,
    medians: {},
    performance,
  };
}

export async function buildComparison(
  tickers: string[],
): Promise<CompareColumn[]> {
  const wanted = [...new Set(tickers.map((t) => t.toUpperCase()))].slice(
    0,
    MAX_COMPARE,
  );
  if (wanted.length === 0) return [];

  const [columns, quotes] = await Promise.all([
    Promise.all(wanted.map((ticker) => columnFor(ticker).catch(() => null))),
    getQuotes(wanted).catch(() => []),
  ]);

  return columns
    .map((column, index) =>
      column
        ? {
            ...column,
            price: quotes[index]?.price ?? null,
            changePercent: quotes[index]?.changePercent ?? null,
          }
        : null,
    )
    .filter((column): column is CompareColumn => column !== null);
}
