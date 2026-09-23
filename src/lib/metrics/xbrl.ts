/**
 * XBRL normalization.
 *
 * The problem this file exists to solve: companies report the same economic
 * figure under different us-gaap tags, and the same company changes tags
 * between years. Revenue alone appears as Revenues,
 * RevenueFromContractWithCustomerExcludingAssessedTax, or SalesRevenueNet.
 *
 * So every figure is looked up through an ordered list of candidate tags and
 * falls through to the next one. A single tag is never enough.
 *
 * Nothing here estimates. A figure that cannot be found returns null, and
 * null travels all the way to the screen as "—". Returning 0 instead would be
 * a lie: 0 means "the company reported zero".
 */

import type { CompanyFacts, XbrlConcept, XbrlFact } from "@/lib/sources/sec";

export type Period = {
  start?: string;
  end: string;
  val: number;
  days: number;
  form: string;
  filed: string;
};

/** A value together with where it came from. SEC data lags, so the filing
 *  date travels with the number and is shown next to it. */
export type Sourced<T> = { value: T; filed: string; end: string } | null;

const REVENUE = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "RevenueFromContractWithCustomerIncludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
];

const COST_OF_REVENUE = [
  "CostOfGoodsAndServicesSold",
  "CostOfRevenue",
  "CostOfGoodsSold",
];

const OPERATING_INCOME = ["OperatingIncomeLoss"];

const NET_INCOME = ["NetIncomeLoss", "ProfitLoss"];

const OPERATING_CASH_FLOW = [
  "NetCashProvidedByUsedInOperatingActivities",
  "NetCashProvidedByUsedInOperatingActivitiesContinuingOperations",
];

const CAPEX = [
  "PaymentsToAcquirePropertyPlantAndEquipment",
  "PaymentsToAcquireProductiveAssets",
];

const DEPRECIATION = [
  "DepreciationDepletionAndAmortization",
  "DepreciationAmortizationAndAccretionNet",
  "DepreciationAndAmortization",
];

const INTEREST_EXPENSE = [
  "InterestExpense",
  "InterestExpenseDebt",
  "InterestIncomeExpenseNet",
];

const TAX_EXPENSE = ["IncomeTaxExpenseBenefit"];
const PRETAX_INCOME = [
  "IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest",
  "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments",
];

const ASSETS = ["Assets"];
const ASSETS_CURRENT = ["AssetsCurrent"];
const LIABILITIES = ["Liabilities"];
const LIABILITIES_CURRENT = ["LiabilitiesCurrent"];
const EQUITY = [
  "StockholdersEquity",
  "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest",
];
const CASH = [
  "CashAndCashEquivalentsAtCarryingValue",
  "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
];
const SHORT_TERM_INVESTMENTS = [
  "ShortTermInvestments",
  "AvailableForSaleSecuritiesDebtSecuritiesCurrent",
  "MarketableSecuritiesCurrent",
];
const LONG_TERM_DEBT = [
  "LongTermDebtNoncurrent",
  "LongTermDebt",
  "LongTermDebtAndCapitalLeaseObligations",
];
const SHORT_TERM_DEBT = [
  "LongTermDebtCurrent",
  "DebtCurrent",
  "ShortTermBorrowings",
];
const RETAINED_EARNINGS = ["RetainedEarningsAccumulatedDeficit"];
const DILUTED_SHARES = ["WeightedAverageNumberOfDilutedSharesOutstanding"];
const EPS_DILUTED = ["EarningsPerShareDiluted"];

/* Working capital, for the cash conversion cycle. A company with no
   inventory tag genuinely has no inventory — software and services — and
   that is reported as such rather than as a zero. */
const RECEIVABLES = [
  "AccountsReceivableNetCurrent",
  "ReceivablesNetCurrent",
  "AccountsReceivableGrossCurrent",
];
const INVENTORY = ["InventoryNet", "InventoryGross"];
const PAYABLES = [
  "AccountsPayableCurrent",
  "AccountsPayableTradeCurrent",
  "AccountsPayableAndAccruedLiabilitiesCurrent",
];

/* Stock-based compensation, as added back in the cash flow statement. That
   is the figure that matters here: it is precisely the amount by which
   operating cash flow flatters the economics. */
const STOCK_COMPENSATION = [
  "ShareBasedCompensation",
  "AllocatedShareBasedCompensationExpense",
  "ShareBasedCompensationArrangementByShareBasedPaymentAwardCompensationCost",
];

/* Capital allocation — where the cash actually went. */
const BUYBACKS = [
  "PaymentsForRepurchaseOfCommonStock",
  "PaymentsForRepurchaseOfEquity",
];
const DIVIDENDS = [
  "PaymentsOfDividendsCommonStock",
  "PaymentsOfDividends",
  "PaymentsOfDividendsMinorityInterest",
];
const ACQUISITIONS = [
  "PaymentsToAcquireBusinessesNetOfCashAcquired",
  "PaymentsToAcquireBusinessesAndInterestInAffiliatesGross",
];

/* Operating expense lines, for the unit-economics proxies. True customer
   acquisition cost is not a reported figure — see metrics/capital.ts. */
const RESEARCH_DEVELOPMENT = ["ResearchAndDevelopmentExpense"];
const SELLING_MARKETING = [
  "SellingAndMarketingExpense",
  "MarketingExpense",
  "SellingGeneralAndAdministrativeExpense",
];
const DEFERRED_REVENUE = [
  "ContractWithCustomerLiabilityCurrent",
  "DeferredRevenueCurrent",
];

export const CONCEPTS = {
  REVENUE,
  COST_OF_REVENUE,
  OPERATING_INCOME,
  NET_INCOME,
  OPERATING_CASH_FLOW,
  CAPEX,
  DEPRECIATION,
  INTEREST_EXPENSE,
  TAX_EXPENSE,
  PRETAX_INCOME,
  ASSETS,
  ASSETS_CURRENT,
  LIABILITIES,
  LIABILITIES_CURRENT,
  EQUITY,
  CASH,
  SHORT_TERM_INVESTMENTS,
  LONG_TERM_DEBT,
  SHORT_TERM_DEBT,
  RETAINED_EARNINGS,
  DILUTED_SHARES,
  EPS_DILUTED,
  RECEIVABLES,
  INVENTORY,
  PAYABLES,
  STOCK_COMPENSATION,
  BUYBACKS,
  DIVIDENDS,
  ACQUISITIONS,
  RESEARCH_DEVELOPMENT,
  SELLING_MARKETING,
  DEFERRED_REVENUE,
};

type RankedFact = XbrlFact & { priority: number };

/**
 * Facts from every candidate tag the company reported, merged into one series.
 *
 * Taking the first tag that exists is not good enough, and this is not
 * theoretical: NVIDIA still carries old RevenueFromContractWithCustomer...
 * rows that stop in 2020 while current revenue lives under a different tag.
 * Picking by existence silently yields five-year-old revenue against today's
 * market cap — a P/S of 502x that looks like a real number.
 *
 * Merging instead gives an unbroken history across tag changes. Where two
 * tags cover the same period, the more recently filed row wins (it is the
 * restated one); ties fall back to candidate priority.
 */
function gather(
  facts: CompanyFacts,
  candidates: string[],
  taxonomy = "us-gaap",
): RankedFact[] {
  const tax = facts.facts?.[taxonomy];
  if (!tax) return [];

  const present: { concept: XbrlConcept; priority: number }[] = [];
  candidates.forEach((name, priority) => {
    const concept = tax[name];
    if (concept?.units && Object.keys(concept.units).length > 0) {
      present.push({ concept, priority });
    }
  });
  if (!present.length) return [];

  // One unit for the whole group. Candidate lists are homogeneous — all
  // money, or all share counts — so the first match is the right one.
  let unit: string | null = null;
  for (const key of ["USD", "shares", "USD/shares"]) {
    if (present.some((p) => p.concept.units[key]?.length)) {
      unit = key;
      break;
    }
  }
  if (!unit) unit = Object.keys(present[0].concept.units)[0] ?? null;
  if (!unit) return [];

  const rows: RankedFact[] = [];
  for (const { concept, priority } of present) {
    for (const fact of concept.units[unit] ?? []) {
      rows.push({ ...fact, priority });
    }
  }
  return rows;
}

/** Keeps the better of two rows covering the same period. */
function preferred(a: RankedFact, b: RankedFact): RankedFact {
  if (a.filed !== b.filed) return a.filed > b.filed ? a : b;
  return a.priority <= b.priority ? a : b;
}

function daysBetween(start: string, end: string): number {
  return Math.round(
    (new Date(end).getTime() - new Date(start).getTime()) / 86_400_000,
  );
}

const toPeriod = (f: RankedFact): Period => ({
  start: f.start,
  end: f.end,
  val: f.val,
  days: f.start ? daysBetween(f.start, f.end) : 0,
  form: f.form,
  filed: f.filed,
});

/** Duration facts (revenue, income, cash flow), deduplicated by period. */
function durationPeriods(rows: RankedFact[]): Period[] {
  const byPeriod = new Map<string, RankedFact>();
  for (const f of rows) {
    if (!f.start) continue;
    const key = `${f.start}|${f.end}`;
    const existing = byPeriod.get(key);
    byPeriod.set(key, existing ? preferred(existing, f) : f);
  }
  return [...byPeriod.values()]
    .map(toPeriod)
    .sort((a, b) => a.end.localeCompare(b.end));
}

/** Instant facts (balance sheet), deduplicated by date. */
function instantPeriods(rows: RankedFact[]): Period[] {
  const byDate = new Map<string, RankedFact>();
  for (const f of rows) {
    if (f.start) continue;
    const existing = byDate.get(f.end);
    byDate.set(f.end, existing ? preferred(existing, f) : f);
  }
  return [...byDate.values()]
    .map(toPeriod)
    .sort((a, b) => a.end.localeCompare(b.end));
}

const isAnnual = (p: Period) => p.days >= 340 && p.days <= 380;
const isQuarter = (p: Period) => p.days >= 80 && p.days <= 100;

/**
 * Trailing twelve months.
 *
 * Most companies file Q1–Q3 on 10-Q and the full year on 10-K, so Q4 is never
 * reported directly. Where the four quarters of a fiscal year are missing
 * exactly one, it is derived: Q4 = FY − (Q1 + Q2 + Q3).
 *
 * If fewer than four quarters can be assembled, the latest annual figure is
 * returned instead — stale but correct, which beats a partial sum.
 */
export function ttm(facts: CompanyFacts, candidates: string[]): Sourced<number> {
  const rows = gather(facts, candidates);
  if (!rows.length) return null;

  const periods = durationPeriods(rows);
  const quarters = periods.filter(isQuarter);
  const annuals = periods.filter(isAnnual);

  const derived: Period[] = [...quarters];

  // Derive the missing fourth quarter of each fiscal year.
  for (const year of annuals) {
    if (!year.start) continue;
    const inside = quarters.filter(
      (q) => q.start && q.start >= year.start! && q.end <= year.end,
    );
    if (inside.length === 3) {
      const covered = inside.reduce((sum, q) => sum + q.val, 0);
      const lastEnd = inside[inside.length - 1].end;
      // The gap sits either before the first quarter or after the last.
      const gapStart = inside[0].start! > year.start ? year.start : lastEnd;
      const gapEnd = inside[0].start! > year.start ? inside[0].start! : year.end;
      if (daysBetween(gapStart, gapEnd) >= 80) {
        derived.push({
          start: gapStart,
          end: gapEnd,
          val: year.val - covered,
          days: daysBetween(gapStart, gapEnd),
          form: year.form,
          filed: year.filed,
        });
      }
    }
  }

  derived.sort((a, b) => b.end.localeCompare(a.end));

  // Walk back four non-overlapping quarters from the newest.
  const chosen: Period[] = [];
  let cursor: string | null = null;
  for (const q of derived) {
    if (cursor && q.end > cursor) continue;
    chosen.push(q);
    cursor = q.start ?? null;
    if (chosen.length === 4) break;
  }

  if (chosen.length === 4) {
    const total = chosen.reduce((s, q) => s + q.val, 0);
    const newest = chosen[0];
    return { value: total, filed: newest.filed, end: newest.end };
  }

  const latestAnnual = annuals[annuals.length - 1];
  if (latestAnnual) {
    return {
      value: latestAnnual.val,
      filed: latestAnnual.filed,
      end: latestAnnual.end,
    };
  }
  return null;
}

/** Most recent balance-sheet value. */
export function latest(
  facts: CompanyFacts,
  candidates: string[],
): Sourced<number> {
  const rows = gather(facts, candidates);
  if (!rows.length) return null;
  const instants = instantPeriods(rows);
  const last = instants[instants.length - 1];
  return last ? { value: last.val, filed: last.filed, end: last.end } : null;
}

/** Annual series, oldest first — the basis for growth and trend figures. */
export function annualSeries(
  facts: CompanyFacts,
  candidates: string[],
  years = 6,
): { end: string; val: number }[] {
  const rows = gather(facts, candidates);
  if (!rows.length) return [];

  const periods = durationPeriods(rows).filter(isAnnual);
  const byFiscalYear = new Map<string, Period>();
  for (const p of periods) {
    const year = p.end.slice(0, 4);
    const existing = byFiscalYear.get(year);
    if (!existing || p.end > existing.end) byFiscalYear.set(year, p);
  }
  return [...byFiscalYear.values()]
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(-years)
    .map((p) => ({ end: p.end, val: p.val }));
}

/** Annual balance-sheet series, for trends like share count or equity. */
export function annualInstantSeries(
  facts: CompanyFacts,
  candidates: string[],
  years = 6,
): { end: string; val: number }[] {
  const rows = gather(facts, candidates);
  if (!rows.length) return [];

  const byYear = new Map<string, Period>();
  for (const p of instantPeriods(rows)) {
    const year = p.end.slice(0, 4);
    const existing = byYear.get(year);
    if (!existing || p.end > existing.end) byYear.set(year, p);
  }
  return [...byYear.values()]
    .sort((a, b) => a.end.localeCompare(b.end))
    .slice(-years)
    .map((p) => ({ end: p.end, val: p.val }));
}

/**
 * Rescales a share-count series across stock splits.
 *
 * Raw counts are not comparable across a split: NVIDIA's 10-for-1 turns into
 * "+876% dilution", which is the opposite of what happened. A year-over-year
 * jump too large to be issuance is treated as a split, rounded to the nearest
 * whole factor, and every earlier year is restated into today's share units.
 *
 * Only share counts go through this. Never money.
 */
export function adjustForSplits(
  series: { end: string; val: number }[],
): { end: string; val: number }[] {
  if (series.length < 2) return series;
  const out = series.map((s) => ({ ...s }));

  for (let i = out.length - 1; i > 0; i--) {
    const previous = out[i - 1].val;
    if (previous <= 0) continue;
    const ratio = out[i].val / previous;

    let factor: number | null = null;
    if (ratio >= 1.8) factor = Math.round(ratio);
    else if (ratio > 0 && ratio <= 0.55) factor = 1 / Math.round(1 / ratio);

    if (factor && factor !== 1) {
      for (let j = 0; j < i; j++) out[j].val *= factor;
    }
  }
  return out;
}

/** Compound annual growth rate. Undefined when the base is non-positive —
 *  growth from a loss is not a meaningful percentage. */
export function cagr(
  series: { val: number }[],
  years: number,
): number | null {
  if (series.length < years + 1) return null;
  const start = series[series.length - 1 - years].val;
  const end = series[series.length - 1].val;
  if (start <= 0 || end <= 0) return null;
  return (Math.pow(end / start, 1 / years) - 1) * 100;
}

export const val = (s: Sourced<number>): number | null => s?.value ?? null;

/** Division that refuses to produce a misleading ratio. */
export function safeDiv(
  numerator: number | null,
  denominator: number | null,
  { allowNegativeDenominator = false } = {},
): number | null {
  if (numerator === null || denominator === null) return null;
  if (denominator === 0) return null;
  if (!allowNegativeDenominator && denominator < 0) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}
