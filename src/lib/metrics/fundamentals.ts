/**
 * The single source of truth for every financial formula in this project.
 * Nothing recomputes a ratio anywhere else — pages import from here.
 */

import type { CompanyFacts } from "@/lib/sources/sec";
import {
  CONCEPTS,
  adjustForSplits,
  annualSeries,
  annualInstantSeries,
  cagr,
  latest,
  safeDiv,
  ttm,
  val,
} from "./xbrl";

export type Metric = {
  key: string;
  label: string;
  value: number | null;
  /** "x" for multiples, "%" for rates, "$" for absolute money. */
  unit: "x" | "%" | "$" | "";
  /** Shown under the number so a figure is never stranded without context. */
  hint?: string;
  /** For ratios where lower is better (valuation multiples). */
  lowerIsBetter?: boolean;
};

export type MetricGroup = { title: string; metrics: Metric[] };

/**
 * The intermediate figures every ratio on the site is built from.
 *
 * Exposed so that the deeper analysis in `capital.ts` can work from the same
 * numbers rather than deriving its own. Two modules each computing their own
 * NOPAT is exactly how a site ends up showing two different ROICs for one
 * company on one page.
 */
export type FinancialBase = {
  revenue: number | null;
  cost: number | null;
  operating: number | null;
  netIncome: number | null;
  operatingCashFlow: number | null;
  capex: number | null;
  fcf: number | null;
  ebitda: number | null;
  interest: number | null;
  /** Falls back to the 21% federal statutory rate when the filing gives no
   *  usable pre-tax figure. Disclosed wherever it is used. */
  effectiveTaxRate: number;
  taxRateIsAssumed: boolean;
  nopat: number | null;
  investedCapital: number | null;
  totalDebt: number | null;
  cash: number | null;
  netDebt: number | null;
  equity: number | null;
  enterpriseValue: number | null;
  marketCap: number | null;
  /** As a percentage, matching the metric shown in the valuation group. */
  roic: number | null;
};

export type Fundamentals = {
  groups: MetricGroup[];
  base: FinancialBase;
  asOf: { end: string; filed: string } | null;
  /** True when the newest figure is older than 120 days — surfaced prominently. */
  stale: boolean;
  revenueSeries: { end: string; val: number }[];
  operatingIncomeSeries: { end: string; val: number }[];
  shareCountSeries: { end: string; val: number }[];
};

const pct = (n: number | null) => (n === null ? null : n * 100);

export function computeFundamentals(
  facts: CompanyFacts,
  marketCap: number | null,
): Fundamentals {
  // Income statement, trailing twelve months.
  const revenueS = ttm(facts, CONCEPTS.REVENUE);
  const costS = ttm(facts, CONCEPTS.COST_OF_REVENUE);
  const operatingS = ttm(facts, CONCEPTS.OPERATING_INCOME);
  const netIncomeS = ttm(facts, CONCEPTS.NET_INCOME);
  const ocfS = ttm(facts, CONCEPTS.OPERATING_CASH_FLOW);
  const capexS = ttm(facts, CONCEPTS.CAPEX);
  const daS = ttm(facts, CONCEPTS.DEPRECIATION);
  const interestS = ttm(facts, CONCEPTS.INTEREST_EXPENSE);
  const taxS = ttm(facts, CONCEPTS.TAX_EXPENSE);
  const pretaxS = ttm(facts, CONCEPTS.PRETAX_INCOME);

  // Balance sheet, latest reported.
  const assetsS = latest(facts, CONCEPTS.ASSETS);
  const assetsCurrentS = latest(facts, CONCEPTS.ASSETS_CURRENT);
  const liabilitiesS = latest(facts, CONCEPTS.LIABILITIES);
  const liabilitiesCurrentS = latest(facts, CONCEPTS.LIABILITIES_CURRENT);
  const equityS = latest(facts, CONCEPTS.EQUITY);
  const cashS = latest(facts, CONCEPTS.CASH);
  const stInvestS = latest(facts, CONCEPTS.SHORT_TERM_INVESTMENTS);
  const ltDebtS = latest(facts, CONCEPTS.LONG_TERM_DEBT);
  const stDebtS = latest(facts, CONCEPTS.SHORT_TERM_DEBT);
  const retainedS = latest(facts, CONCEPTS.RETAINED_EARNINGS);

  const revenue = val(revenueS);
  const cost = val(costS);
  const operating = val(operatingS);
  const netIncome = val(netIncomeS);
  const ocf = val(ocfS);
  const capex = val(capexS);
  const da = val(daS);
  const interest = val(interestS);
  const tax = val(taxS);
  const pretax = val(pretaxS);

  const assets = val(assetsS);
  const assetsCurrent = val(assetsCurrentS);
  const liabilities = val(liabilitiesS);
  const liabilitiesCurrent = val(liabilitiesCurrentS);
  const equity = val(equityS);
  const retained = val(retainedS);

  // Cash and equivalents include short-term investments — companies split
  // these differently, and net debt is wrong if the split is ignored.
  const cash =
    val(cashS) === null && val(stInvestS) === null
      ? null
      : (val(cashS) ?? 0) + (val(stInvestS) ?? 0);

  const totalDebt =
    val(ltDebtS) === null && val(stDebtS) === null
      ? null
      : (val(ltDebtS) ?? 0) + (val(stDebtS) ?? 0);

  const netDebt =
    totalDebt === null || cash === null ? null : totalDebt - cash;

  const grossProfit =
    revenue === null || cost === null ? null : revenue - cost;

  // CapEx is reported as a positive outflow, so it is subtracted.
  const fcf = ocf === null || capex === null ? null : ocf - Math.abs(capex);

  const ebitda = operating === null ? null : operating + (da ?? 0);

  const enterpriseValue =
    marketCap === null || netDebt === null ? null : marketCap + netDebt;

  const taxRateIsAssumed = !(pretax !== null && pretax > 0 && tax !== null);
  const effectiveTaxRate = taxRateIsAssumed ? 0.21 : tax! / pretax!;

  const nopat = operating === null ? null : operating * (1 - effectiveTaxRate);

  const investedCapital =
    equity === null || totalDebt === null
      ? null
      : equity + totalDebt - (cash ?? 0);

  const workingCapital =
    assetsCurrent === null || liabilitiesCurrent === null
      ? null
      : assetsCurrent - liabilitiesCurrent;

  // Altman Z-Score for public manufacturers. Below 1.81 signals distress,
  // above 2.99 signals safety.
  const altmanZ =
    assets && assets > 0 && liabilities && marketCap && revenue !== null
      ? 1.2 * ((workingCapital ?? 0) / assets) +
        1.4 * ((retained ?? 0) / assets) +
        3.3 * ((operating ?? 0) / assets) +
        0.6 * (marketCap / liabilities) +
        1.0 * (revenue / assets)
      : null;

  const revenueSeries = annualSeries(facts, CONCEPTS.REVENUE);
  const operatingIncomeSeries = annualSeries(facts, CONCEPTS.OPERATING_INCOME);
  // Diluted share count is a duration concept (weighted average). Some
  // companies only tag it as an instant, so fall back to that.
  let shareCountSeries = annualSeries(facts, CONCEPTS.DILUTED_SHARES);
  if (shareCountSeries.length < 2) {
    shareCountSeries = annualInstantSeries(facts, CONCEPTS.DILUTED_SHARES);
  }
  // Restate pre-split years into current share units, otherwise a 10-for-1
  // split reads as 876% dilution.
  shareCountSeries = adjustForSplits(shareCountSeries);

  const shareTrend =
    shareCountSeries.length >= 2
      ? ((shareCountSeries[shareCountSeries.length - 1].val -
          shareCountSeries[0].val) /
          shareCountSeries[0].val) *
        100
      : null;

  const groups: MetricGroup[] = [
    {
      title: "הערכת שווי",
      metrics: [
        {
          key: "pe",
          label: "P/E",
          value: safeDiv(marketCap, netIncome),
          unit: "x",
          hint: "שווי שוק חלקי רווח נקי",
          lowerIsBetter: true,
        },
        {
          key: "ps",
          label: "P/S",
          value: safeDiv(marketCap, revenue),
          unit: "x",
          hint: "שווי שוק חלקי הכנסות",
          lowerIsBetter: true,
        },
        {
          key: "pb",
          label: "P/B",
          value: safeDiv(marketCap, equity),
          unit: "x",
          hint: "שווי שוק חלקי הון עצמי",
          lowerIsBetter: true,
        },
        {
          key: "ev_ebitda",
          label: "EV/EBITDA",
          value: safeDiv(enterpriseValue, ebitda),
          unit: "x",
          hint: "שווי פעילות חלקי רווח תפעולי לפני פחת",
          lowerIsBetter: true,
        },
        {
          key: "ev_fcf",
          label: "EV/FCF",
          value: safeDiv(enterpriseValue, fcf),
          unit: "x",
          hint: "שווי פעילות חלקי תזרים חופשי",
          lowerIsBetter: true,
        },
        {
          key: "earnings_yield",
          label: "Earnings Yield",
          value: pct(safeDiv(netIncome, marketCap)),
          unit: "%",
          hint: "הרווח כאחוז משווי השוק",
        },
      ],
    },
    {
      title: "רווחיות",
      metrics: [
        {
          key: "gross_margin",
          label: "Gross Margin",
          value: pct(safeDiv(grossProfit, revenue)),
          unit: "%",
          hint: "מרווח גולמי",
        },
        {
          key: "operating_margin",
          label: "Operating Margin",
          value: pct(safeDiv(operating, revenue)),
          unit: "%",
          hint: "מרווח תפעולי",
        },
        {
          key: "net_margin",
          label: "Net Margin",
          value: pct(safeDiv(netIncome, revenue)),
          unit: "%",
          hint: "מרווח נקי",
        },
        {
          key: "roe",
          label: "ROE",
          value: pct(safeDiv(netIncome, equity)),
          unit: "%",
          hint: "תשואה על ההון העצמי",
        },
        {
          key: "roa",
          label: "ROA",
          value: pct(safeDiv(netIncome, assets)),
          unit: "%",
          hint: "תשואה על הנכסים",
        },
        {
          key: "roic",
          label: "ROIC",
          value: pct(safeDiv(nopat, investedCapital)),
          unit: "%",
          hint: "תשואה על ההון המושקע",
        },
      ],
    },
    {
      title: "צמיחה",
      metrics: [
        {
          key: "rev_cagr_3",
          label: "צמיחת הכנסות 3ש׳",
          value: cagr(revenueSeries, 3),
          unit: "%",
          hint: "ממוצע שנתי מצטבר",
        },
        {
          key: "rev_cagr_5",
          label: "צמיחת הכנסות 5ש׳",
          value: cagr(revenueSeries, 5),
          unit: "%",
          hint: "ממוצע שנתי מצטבר",
        },
        {
          key: "op_cagr_3",
          label: "צמיחת רווח תפעולי 3ש׳",
          value: cagr(operatingIncomeSeries, 3),
          unit: "%",
          hint: "ממוצע שנתי מצטבר",
        },
        {
          key: "share_trend",
          label: "שינוי במספר המניות",
          value: shareTrend,
          unit: "%",
          hint: "שלילי = רכישה עצמית, חיובי = דילול",
          lowerIsBetter: true,
        },
      ],
    },
    {
      title: "תזרים מזומנים",
      metrics: [
        {
          key: "fcf",
          label: "Free Cash Flow",
          value: fcf,
          unit: "$",
          hint: "תזרים תפעולי בניכוי השקעות הוניות",
        },
        {
          key: "fcf_margin",
          label: "FCF Margin",
          value: pct(safeDiv(fcf, revenue)),
          unit: "%",
          hint: "התזרים החופשי כאחוז מההכנסות",
        },
        {
          key: "fcf_yield",
          label: "FCF Yield",
          value: pct(safeDiv(fcf, marketCap)),
          unit: "%",
          hint: "התזרים החופשי כאחוז משווי השוק",
        },
        {
          key: "capex_ratio",
          label: "CapEx / Revenue",
          value: pct(safeDiv(capex === null ? null : Math.abs(capex), revenue)),
          unit: "%",
          hint: "כמה מההכנסות חוזרות להשקעה",
          lowerIsBetter: true,
        },
      ],
    },
    {
      title: "איתנות פיננסית",
      metrics: [
        {
          key: "debt_equity",
          label: "Debt / Equity",
          value: safeDiv(totalDebt, equity),
          unit: "x",
          hint: "חוב כולל חלקי הון עצמי",
          lowerIsBetter: true,
        },
        {
          key: "net_debt_ebitda",
          label: "Net Debt / EBITDA",
          value: safeDiv(netDebt, ebitda),
          unit: "x",
          hint: "כמה שנות רווח תפעולי נדרשות לכיסוי החוב נטו",
          lowerIsBetter: true,
        },
        {
          key: "current_ratio",
          label: "Current Ratio",
          value: safeDiv(assetsCurrent, liabilitiesCurrent),
          unit: "x",
          hint: "נכסים שוטפים חלקי התחייבויות שוטפות",
        },
        {
          key: "interest_coverage",
          label: "Interest Coverage",
          value: safeDiv(
            operating,
            interest === null ? null : Math.abs(interest),
          ),
          unit: "x",
          hint: "פי כמה הרווח התפעולי מכסה את הוצאות המימון",
        },
        {
          key: "altman_z",
          label: "Altman Z-Score",
          value: altmanZ,
          unit: "",
          hint: "מתחת ל-1.81 מצוקה · מעל 2.99 איתנות",
        },
      ],
    },
  ];

  const asOfSource = revenueS ?? netIncomeS ?? assetsS;
  const asOf = asOfSource
    ? { end: asOfSource.end, filed: asOfSource.filed }
    : null;

  const stale = asOf
    ? (Date.now() - new Date(asOf.end).getTime()) / 86_400_000 > 120
    : true;

  return {
    groups,
    base: {
      revenue,
      cost,
      operating,
      netIncome,
      operatingCashFlow: ocf,
      capex,
      fcf,
      ebitda,
      interest,
      effectiveTaxRate,
      taxRateIsAssumed,
      nopat,
      investedCapital,
      totalDebt,
      cash,
      netDebt,
      equity,
      enterpriseValue,
      marketCap,
      roic: pct(safeDiv(nopat, investedCapital)),
    },
    asOf,
    stale,
    revenueSeries,
    operatingIncomeSeries,
    shareCountSeries,
  };
}
