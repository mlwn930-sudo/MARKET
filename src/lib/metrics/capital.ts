/**
 * The questions a ratio table does not answer.
 *
 * Margins and multiples describe a company's results. What this module tries
 * to describe is the quality of those results: whether the profit turns into
 * cash and how quickly, what the profit costs in shares, whether the returns
 * exceed what the capital costs, and where the cash goes once it arrives.
 *
 * It works from the figures already derived in `fundamentals.ts` rather than
 * recomputing them, per the project's one-source-of-truth rule.
 *
 * Every measure here is reported with its limitation attached. Two of them
 * carry assumptions that a reader has to see to judge the number:
 *
 *   The equity risk premium is an assumption, not an observation. There is
 *   no such thing as a measured ERP; the figure below is the conventional
 *   one and it is shown on the page beside the result.
 *
 *   Beta is measured from two years of weekly returns. It describes how the
 *   stock has moved with the market, and is used as though it describes how
 *   it will. That is standard practice and still a leap.
 */

import type { CompanyFacts } from "@/lib/sources/sec";
import type { FinancialBase } from "./fundamentals";
import { CONCEPTS, annualSeries, latest, safeDiv, ttm, val } from "./xbrl";

const DAYS_IN_YEAR = 365;

/* ------------------------------------------------------------------ */
/* Cash conversion cycle                                               */
/* ------------------------------------------------------------------ */

export type CashCycle = {
  /** Days between the sale and the cash arriving. */
  daysSalesOutstanding: number | null;
  /** Days stock sits before it is sold. Null for a company with no inventory. */
  daysInventoryOutstanding: number | null;
  /** Days the company takes to pay its own suppliers. */
  daysPayablesOutstanding: number | null;
  cycle: number | null;
  /** True when the company is paid before it pays — a cycle below zero. */
  financedBySuppliers: boolean;
  note: string;
};

/**
 * How long a dollar is tied up between paying for something and being paid
 * for it.
 *
 * A negative cycle is the interesting case and not an error: it means
 * customers pay before suppliers are paid, so growth funds itself instead of
 * consuming cash. Retailers and marketplaces often run this way.
 *
 * Inventory absent from the filing means the company holds none, which is
 * normal for software and services. That is reported as "no inventory"
 * rather than as zero days, because the two have different meanings and only
 * one of them is a fact about the business.
 */
export function cashConversionCycle(
  facts: CompanyFacts,
  base: FinancialBase,
): CashCycle {
  const receivables = val(latest(facts, CONCEPTS.RECEIVABLES));
  const inventory = val(latest(facts, CONCEPTS.INVENTORY));
  const payables = val(latest(facts, CONCEPTS.PAYABLES));

  const days = (balance: number | null, flow: number | null) => {
    const ratio = safeDiv(balance, flow);
    return ratio === null ? null : ratio * DAYS_IN_YEAR;
  };

  const daysSalesOutstanding = days(receivables, base.revenue);
  const daysInventoryOutstanding = days(inventory, base.cost);
  const daysPayablesOutstanding = days(payables, base.cost);

  const cycle =
    daysSalesOutstanding === null || daysPayablesOutstanding === null
      ? null
      : daysSalesOutstanding + (daysInventoryOutstanding ?? 0) - daysPayablesOutstanding;

  const financedBySuppliers = cycle !== null && cycle < 0;

  let note: string;
  if (cycle === null) {
    note = "הדוחות אינם כוללים את כל הרכיבים הדרושים לחישוב.";
  } else if (financedBySuppliers) {
    note =
      "המחזור שלילי: הלקוחות משלמים לפני שהחברה משלמת לספקיה. במצב כזה צמיחה מייצרת מזומן במקום לצרוך אותו.";
  } else if (daysInventoryOutstanding === null) {
    note =
      "אין מלאי בדוחות — התנהגות רגילה בתוכנה ובשירותים. המחזור כאן הוא הפער בין הגבייה לתשלום בלבד.";
  } else {
    note = `כל דולר של פעילות כבול ${Math.round(cycle)} ימים. ככל שהמספר גדול יותר, כך צמיחה דורשת יותר הון חוזר.`;
  }

  return {
    daysSalesOutstanding,
    daysInventoryOutstanding,
    daysPayablesOutstanding,
    cycle,
    financedBySuppliers,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Stock-based compensation                                            */
/* ------------------------------------------------------------------ */

export type StockComp = {
  expense: number | null;
  shareOfRevenue: number | null;
  shareOfFcf: number | null;
  /** Free cash flow with the compensation treated as the cost that it is. */
  fcfAfterComp: number | null;
  buybacks: number | null;
  /** What share of the buyback merely absorbs shares issued to employees. */
  buybackAbsorbedPercent: number | null;
  /** Actual change in diluted share count, as a percentage. */
  shareCountChange: number | null;
  verdict: "creating" | "offsetting" | "diluting" | null;
  note: string;
};

/**
 * What the profit costs in ownership.
 *
 * Stock compensation is added back in the cash flow statement because no
 * cash leaves — which is true, and which makes free cash flow look better
 * than the economics are. The cost is real and it is paid by existing
 * holders in dilution.
 *
 * The verdict comes from the share count, not from the buyback. A company
 * can repurchase billions and still dilute; the repurchase then is not a
 * return of capital, it is the bill for the compensation arriving in a
 * different envelope. Comparing the two is the only way to see which one is
 * happening.
 */
export function stockCompensation(
  facts: CompanyFacts,
  base: FinancialBase,
  shareCountSeries: { end: string; val: number }[],
): StockComp {
  const expense = val(ttm(facts, CONCEPTS.STOCK_COMPENSATION));
  const buybacksRaw = val(ttm(facts, CONCEPTS.BUYBACKS));
  const buybacks = buybacksRaw === null ? null : Math.abs(buybacksRaw);

  const shareOfRevenue = safeDiv(expense, base.revenue);
  const shareOfFcf = safeDiv(expense, base.fcf);
  const fcfAfterComp =
    base.fcf === null || expense === null ? null : base.fcf - expense;

  const buybackAbsorbedPercent =
    buybacks !== null && buybacks > 0 && expense !== null
      ? Math.min((expense / buybacks) * 100, 999)
      : null;

  // Three years is long enough for a buyback programme to show up in the
  // count and short enough to describe the present management.
  const recent = shareCountSeries.slice(-4);
  const shareCountChange =
    recent.length >= 2 && recent[0].val > 0
      ? ((recent[recent.length - 1].val - recent[0].val) / recent[0].val) * 100
      : null;

  let verdict: StockComp["verdict"] = null;
  let note: string;

  if (shareCountChange === null) {
    note = "אין די היסטוריה של ספירת מניות כדי לקבוע אם הרכישות העצמיות מצמצמות בפועל.";
  } else if (shareCountChange < -1) {
    verdict = "creating";
    note = `ספירת המניות ירדה ב-${Math.abs(shareCountChange).toFixed(1)}% — הרכישות העצמיות גדולות מההנפקה לעובדים, כלומר בעל מניות קיים מחזיק בנתח גדול יותר מהעסק.`;
  } else if (shareCountChange <= 1) {
    verdict = "offsetting";
    note = "ספירת המניות כמעט לא השתנתה. הרכישות העצמיות בעיקר סופגות את ההנפקה לעובדים ואינן החזר הון.";
  } else {
    verdict = "diluting";
    note = `ספירת המניות עלתה ב-${shareCountChange.toFixed(1)}% — התגמול במניות גדול מהרכישות, והעלות מגולגלת לבעלי המניות בדילול.`;
  }

  if (shareOfFcf !== null && shareOfFcf > 0.3) {
    note += ` התגמול במניות שווה ל-${Math.round(shareOfFcf * 100)}% מהתזרים החופשי, כך שה-FCF המדווח מציג תמונה נדיבה מהכלכלה בפועל.`;
  }

  return {
    expense,
    shareOfRevenue: shareOfRevenue === null ? null : shareOfRevenue * 100,
    shareOfFcf: shareOfFcf === null ? null : shareOfFcf * 100,
    fcfAfterComp,
    buybacks,
    buybackAbsorbedPercent,
    shareCountChange,
    verdict,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Cost of capital                                                     */
/* ------------------------------------------------------------------ */

/** The conventional equity risk premium. An assumption, disclosed as one
 *  everywhere the result appears. */
export const EQUITY_RISK_PREMIUM = 0.05;
/** Used only when FRED cannot be reached, and flagged when it is. */
export const ASSUMED_RISK_FREE = 0.042;
/** A beta far outside this range is a measurement artefact rather than a
 *  description of the business, and is clamped before it distorts a WACC. */
const BETA_BOUNDS = { min: 0.3, max: 2.5 };

export type CostOfCapital = {
  riskFree: number;
  riskFreeIsAssumed: boolean;
  beta: number | null;
  betaWasClamped: boolean;
  costOfEquity: number | null;
  costOfDebtAfterTax: number | null;
  equityWeight: number | null;
  debtWeight: number | null;
  wacc: number | null;
  roic: number | null;
  /** ROIC minus WACC, in percentage points. The number that says whether
   *  the business creates value or consumes it. */
  spread: number | null;
  verdict: "creates" | "destroys" | "marginal" | null;
  note: string;
  assumptions: string[];
};

/**
 * Whether the business earns more on its capital than the capital costs.
 *
 * This is the closest thing to a single test of whether a company creates
 * value. Growth funded at a return below its cost destroys value while every
 * headline number — revenue, earnings, even EPS — still rises, which is why
 * the spread is worth more than any of them.
 *
 * The result is only as good as its inputs and the inputs are assumptions,
 * so they are all returned alongside it for the page to print. A WACC quoted
 * without its assumptions is a number pretending to be a fact.
 */
export function costOfCapital(
  base: FinancialBase,
  rawBeta: number | null,
  riskFreeRate: number | null,
): CostOfCapital {
  const riskFreeIsAssumed = riskFreeRate === null;
  const riskFree = riskFreeRate ?? ASSUMED_RISK_FREE;

  let beta = rawBeta;
  let betaWasClamped = false;
  if (beta !== null) {
    const clamped = Math.min(Math.max(beta, BETA_BOUNDS.min), BETA_BOUNDS.max);
    betaWasClamped = clamped !== beta;
    beta = clamped;
  }

  const costOfEquity = beta === null ? null : riskFree + beta * EQUITY_RISK_PREMIUM;

  // Cost of debt from what the company actually pays, not from a rating
  // table. Interest expense over total debt is crude — it mixes old and new
  // borrowing — but it is observed rather than assumed.
  const grossCostOfDebt = safeDiv(
    base.interest === null ? null : Math.abs(base.interest),
    base.totalDebt,
  );
  const costOfDebtAfterTax =
    grossCostOfDebt === null ? null : grossCostOfDebt * (1 - base.effectiveTaxRate);

  const equity = base.marketCap;
  const debt = base.totalDebt ?? 0;
  const total = equity === null ? null : equity + debt;

  const equityWeight = total && total > 0 ? (equity ?? 0) / total : null;
  const debtWeight = total && total > 0 ? debt / total : null;

  const wacc =
    costOfEquity === null || equityWeight === null || debtWeight === null
      ? null
      : costOfEquity * equityWeight + (costOfDebtAfterTax ?? 0) * debtWeight;

  const roic = base.roic === null ? null : base.roic / 100;
  const spread = roic === null || wacc === null ? null : (roic - wacc) * 100;

  let verdict: CostOfCapital["verdict"] = null;
  let note: string;

  if (spread === null) {
    note = "אין די נתונים לחישוב עלות ההון או התשואה עליו.";
  } else if (spread > 2) {
    verdict = "creates";
    note = `התשואה על ההון המושקע גבוהה מעלות ההון ב-${spread.toFixed(1)} נקודות אחוז. כל דולר שמושקע בעסק מייצר יותר ממה שהוא עולה — זו ההגדרה של יצירת ערך.`;
  } else if (spread < -2) {
    verdict = "destroys";
    note = `התשואה על ההון המושקע נמוכה מעלות ההון ב-${Math.abs(spread).toFixed(1)} נקודות אחוז. במצב כזה צמיחה הורסת ערך: ככל שיושקע יותר, כך ייהרס יותר — גם אם ההכנסות והרווח עולים.`;
  } else {
    verdict = "marginal";
    note = "התשואה על ההון ועלות ההון כמעט זהות. העסק מכסה את עלות ההון שלו ולא הרבה מעבר לכך, והמרווח בתוך טווח השגיאה של ההנחות.";
  }

  const assumptions = [
    riskFreeIsAssumed
      ? `ריבית חסרת סיכון ${(riskFree * 100).toFixed(2)}% — הנחה, נתוני FRED לא היו זמינים`
      : `ריבית חסרת סיכון ${(riskFree * 100).toFixed(2)}% — תשואת אג״ח ממשלת ארה״ב ל-10 שנים`,
    `פרמיית סיכון שוק ${(EQUITY_RISK_PREMIUM * 100).toFixed(1)}% — הנחה מקובלת, לא נתון נמדד`,
    beta === null
      ? "beta לא חושב — אין די היסטוריית מחירים"
      : `beta ${beta.toFixed(2)} מתוך תשואות שבועיות בשנתיים האחרונות מול S&P 500${betaWasClamped ? " (הוגבל לטווח סביר)" : ""}`,
    base.taxRateIsAssumed
      ? "שיעור מס 21% — הנחה, הדוח לא אפשר חישוב שיעור אפקטיבי"
      : `שיעור מס אפקטיבי ${(base.effectiveTaxRate * 100).toFixed(1)}% מתוך הדוח`,
  ];

  return {
    riskFree,
    riskFreeIsAssumed,
    beta,
    betaWasClamped,
    costOfEquity,
    costOfDebtAfterTax,
    equityWeight,
    debtWeight,
    wacc,
    roic,
    spread,
    verdict,
    note,
    assumptions,
  };
}

/* ------------------------------------------------------------------ */
/* Operating leverage                                                  */
/* ------------------------------------------------------------------ */

export type OperatingLeverage = {
  /** Operating profit growth divided by revenue growth, most recent year. */
  ratio: number | null;
  /** Of every extra dollar of revenue, how much reached operating profit. */
  incrementalMargin: number | null;
  currentMargin: number | null;
  /** The same figures a year earlier, so a turn is visible rather than implied. */
  previousIncrementalMargin: number | null;
  turning: "inflecting" | "eroding" | "steady" | null;
  note: string;
};

/**
 * Whether growth is getting more profitable or less.
 *
 * The incremental margin — operating profit added per dollar of revenue
 * added — is the honest version of the question. A company whose margin is
 * 20% while its incremental margin is 45% is about to look much better, and
 * one whose incremental margin has fallen below its current margin is about
 * to look worse. The reported margin is an average over the past; the
 * incremental margin is what the newest business is doing.
 */
export function operatingLeverage(
  revenueSeries: { end: string; val: number }[],
  operatingSeries: { end: string; val: number }[],
): OperatingLeverage {
  const empty: OperatingLeverage = {
    ratio: null,
    incrementalMargin: null,
    currentMargin: null,
    previousIncrementalMargin: null,
    turning: null,
    note: "אין די שנים של דוחות שנתיים לחישוב מינוף תפעולי.",
  };

  // Align the two series by fiscal year end. A company that restated or
  // changed its year end can leave one series a year longer than the other.
  const operatingByEnd = new Map(operatingSeries.map((p) => [p.end, p.val]));
  const paired = revenueSeries
    .filter((p) => operatingByEnd.has(p.end))
    .map((p) => ({ end: p.end, revenue: p.val, operating: operatingByEnd.get(p.end)! }));

  if (paired.length < 3) return empty;

  const incrementalAt = (i: number): number | null => {
    const revenueDelta = paired[i].revenue - paired[i - 1].revenue;
    if (revenueDelta === 0) return null;
    const operatingDelta = paired[i].operating - paired[i - 1].operating;
    return (operatingDelta / revenueDelta) * 100;
  };

  const last = paired.length - 1;
  const incrementalMargin = incrementalAt(last);
  const previousIncrementalMargin = incrementalAt(last - 1);

  const currentMargin =
    paired[last].revenue > 0
      ? (paired[last].operating / paired[last].revenue) * 100
      : null;

  const revenueGrowth =
    paired[last - 1].revenue > 0
      ? (paired[last].revenue - paired[last - 1].revenue) / paired[last - 1].revenue
      : null;
  const operatingGrowth =
    paired[last - 1].operating > 0
      ? (paired[last].operating - paired[last - 1].operating) / paired[last - 1].operating
      : null;

  const ratio =
    revenueGrowth !== null && revenueGrowth !== 0 && operatingGrowth !== null
      ? operatingGrowth / revenueGrowth
      : null;

  let turning: OperatingLeverage["turning"] = null;
  let note: string;

  if (incrementalMargin === null || currentMargin === null) {
    note = "ההכנסות לא השתנו מספיק בשנה האחרונה כדי למדוד מינוף.";
  } else if (incrementalMargin > currentMargin + 5) {
    turning = "inflecting";
    note = `מכל דולר הכנסה נוסף, ${incrementalMargin.toFixed(0)} סנט הגיעו לרווח התפעולי — לעומת מרווח נוכחי של ${currentMargin.toFixed(0)}%. העסק החדש רווחי מהממוצע, ולכן המרווח המדווח צפוי לעלות אם הקצב יימשך.`;
  } else if (incrementalMargin < currentMargin - 5) {
    turning = "eroding";
    note = `מכל דולר הכנסה נוסף הגיעו רק ${incrementalMargin.toFixed(0)} סנט לרווח התפעולי, פחות מהמרווח הנוכחי ${currentMargin.toFixed(0)}%. הצמיחה החדשה פחות רווחית מהעסק הקיים ומושכת את המרווח מטה.`;
  } else {
    turning = "steady";
    note = "הרווחיות של ההכנסה החדשה דומה לרווחיות הקיימת. אין מינוף תפעולי לכאן או לכאן.";
  }

  return {
    ratio,
    incrementalMargin,
    currentMargin,
    previousIncrementalMargin,
    turning,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Capital allocation                                                  */
/* ------------------------------------------------------------------ */

export type Allocation = {
  label: string;
  amount: number;
  share: number;
};

export type CapitalAllocation = {
  operatingCashFlow: number | null;
  allocations: Allocation[];
  /** How much of operating cash flow the company did not spend. */
  retainedShare: number | null;
  priority: string | null;
  note: string;
};

/**
 * Where the cash went.
 *
 * Measured over the last three reported years rather than the trailing
 * twelve months, because allocation is a policy and a single year is a
 * sample of one: an acquisition year and a buyback year look like different
 * companies.
 *
 * The figures are what the cash flow statement says. Whether the choices
 * were good ones is a judgement this cannot make, and the page says so.
 */
export function capitalAllocation(
  facts: CompanyFacts,
  base: FinancialBase,
): CapitalAllocation {
  const sumRecent = (candidates: string[]): number | null => {
    const series = annualSeries(facts, candidates, 3);
    if (series.length === 0) return null;
    return series.reduce((total, year) => total + Math.abs(year.val), 0);
  };

  const cashFlowSeries = annualSeries(facts, CONCEPTS.OPERATING_CASH_FLOW, 3);
  const operatingCashFlow =
    cashFlowSeries.length > 0
      ? cashFlowSeries.reduce((total, year) => total + year.val, 0)
      : null;

  const rows: { label: string; amount: number | null }[] = [
    { label: "השקעות הוניות", amount: sumRecent(CONCEPTS.CAPEX) },
    { label: "רכישות חברות", amount: sumRecent(CONCEPTS.ACQUISITIONS) },
    { label: "רכישה עצמית", amount: sumRecent(CONCEPTS.BUYBACKS) },
    { label: "דיבידנד", amount: sumRecent(CONCEPTS.DIVIDENDS) },
  ];

  const allocations: Allocation[] = [];
  if (operatingCashFlow !== null && operatingCashFlow > 0) {
    for (const row of rows) {
      if (row.amount === null || row.amount === 0) continue;
      allocations.push({
        label: row.label,
        amount: row.amount,
        share: (row.amount / operatingCashFlow) * 100,
      });
    }
  }

  allocations.sort((a, b) => b.amount - a.amount);

  const spent = allocations.reduce((total, row) => total + row.share, 0);
  const retainedShare =
    operatingCashFlow !== null && operatingCashFlow > 0 ? 100 - spent : null;

  const priority = allocations[0]?.label ?? null;

  let note: string;
  if (allocations.length === 0) {
    note = "דוח תזרים המזומנים אינו מפרט את השימושים בצורה שניתן לסכם.";
  } else if (retainedShare !== null && retainedShare < -10) {
    note = `השימושים גדולים מהתזרים התפעולי בשלוש השנים האחרונות — ההפרש מומן מחוב או ממזומן קיים. ${priority} הוא היעד הגדול ביותר.`;
  } else {
    note = `היעד הגדול ביותר לתזרים בשלוש השנים האחרונות הוא ${priority}. החלוקה מתארת מה ההנהלה עשתה — לא אם זו הייתה ההחלטה הנכונה.`;
  }

  return { operatingCashFlow, allocations, retainedShare, priority, note };
}

/* ------------------------------------------------------------------ */
/* Unit economics                                                      */
/* ------------------------------------------------------------------ */

export type UnitEconomics = {
  researchShare: number | null;
  marketingShare: number | null;
  /** Revenue generated per dollar of selling and marketing spend. */
  revenuePerMarketingDollar: number | null;
  grossProfitPerMarketingDollar: number | null;
  deferredRevenue: number | null;
  deferredGrowth: number | null;
  note: string;
  /** Said plainly on the page: the real ratio is not a reported figure. */
  caveat: string;
};

/**
 * Proxies for unit economics, and an explicit refusal to fake the real thing.
 *
 * Lifetime value against acquisition cost is the right question for a
 * subscription or a games business. It is also not derivable from an SEC
 * filing: no company reports cohort retention or the marketing spend
 * attributable to a new customer, and a figure assembled from public data
 * would be a guess dressed as a measurement. This project does not publish
 * that kind of number.
 *
 * What the filings do support is the shape of the same question. Gross
 * profit per dollar of sales and marketing is a genuine efficiency measure —
 * if it is rising, each dollar of acquisition is buying more margin — and
 * deferred revenue growth is the closest public proxy for bookings, which
 * for a games publisher leads reported revenue by quarters.
 */
export function unitEconomics(
  facts: CompanyFacts,
  base: FinancialBase,
): UnitEconomics {
  const research = val(ttm(facts, CONCEPTS.RESEARCH_DEVELOPMENT));
  const marketing = val(ttm(facts, CONCEPTS.SELLING_MARKETING));

  const grossProfit =
    base.revenue === null || base.cost === null ? null : base.revenue - base.cost;

  const deferredSeries = annualSeries(facts, CONCEPTS.DEFERRED_REVENUE, 3);
  const deferredRevenue =
    deferredSeries.length > 0 ? deferredSeries[deferredSeries.length - 1].val : null;
  const deferredGrowth =
    deferredSeries.length >= 2 && deferredSeries[deferredSeries.length - 2].val > 0
      ? ((deferredSeries[deferredSeries.length - 1].val -
          deferredSeries[deferredSeries.length - 2].val) /
          deferredSeries[deferredSeries.length - 2].val) *
        100
      : null;

  const researchShare = safeDiv(research, base.revenue);
  const marketingShare = safeDiv(marketing, base.revenue);
  const revenuePerMarketingDollar = safeDiv(base.revenue, marketing);
  const grossProfitPerMarketingDollar = safeDiv(grossProfit, marketing);

  const parts: string[] = [];
  if (grossProfitPerMarketingDollar !== null) {
    parts.push(
      `כל דולר של הוצאות מכירה ושיווק מלווה ב-${grossProfitPerMarketingDollar.toFixed(2)} דולר רווח גולמי`,
    );
  }
  if (researchShare !== null) {
    parts.push(`מחקר ופיתוח ${(researchShare * 100).toFixed(1)}% מההכנסות`);
  }
  if (deferredGrowth !== null) {
    parts.push(
      `הכנסה נדחית ${deferredGrowth >= 0 ? "גדלה" : "קטנה"} ב-${Math.abs(deferredGrowth).toFixed(0)}% בשנה האחרונה`,
    );
  }

  return {
    researchShare: researchShare === null ? null : researchShare * 100,
    marketingShare: marketingShare === null ? null : marketingShare * 100,
    revenuePerMarketingDollar,
    grossProfitPerMarketingDollar,
    deferredRevenue,
    deferredGrowth,
    note: parts.length > 0 ? parts.join(" · ") : "הדוחות אינם מפרידים את סעיפי ההוצאה הדרושים.",
    caveat:
      "LTV מול CAC אינו מחושב כאן. אף חברה אינה מדווחת עלות רכישת לקוח או שימור לפי קוהורטה, ומספר שמורכב מנתונים ציבוריים היה ניחוש שנראה כמו מדידה. מה שמוצג הוא יחסי יעילות שנגזרים ישירות מהדוח.",
  };
}

/* ------------------------------------------------------------------ */
/* Everything together                                                 */
/* ------------------------------------------------------------------ */

export type CapitalQuality = {
  cashCycle: CashCycle;
  stockComp: StockComp;
  costOfCapital: CostOfCapital;
  leverage: OperatingLeverage;
  allocation: CapitalAllocation;
  unitEconomics: UnitEconomics;
};

export function computeCapitalQuality(
  facts: CompanyFacts,
  base: FinancialBase,
  series: {
    revenue: { end: string; val: number }[];
    operating: { end: string; val: number }[];
    shareCount: { end: string; val: number }[];
  },
  market: { beta: number | null; riskFree: number | null },
): CapitalQuality {
  return {
    cashCycle: cashConversionCycle(facts, base),
    stockComp: stockCompensation(facts, base, series.shareCount),
    costOfCapital: costOfCapital(base, market.beta, market.riskFree),
    leverage: operatingLeverage(series.revenue, series.operating),
    allocation: capitalAllocation(facts, base),
    unitEconomics: unitEconomics(facts, base),
  };
}
