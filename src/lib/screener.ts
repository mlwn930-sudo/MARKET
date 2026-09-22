/**
 * Opportunity screen for a medium-to-long horizon.
 *
 * A screen is not a recommendation and this file does not pretend otherwise.
 * It applies ten plainly stated tests and reports which ones each company
 * passes. The score is a way to sort the list, not a verdict — which is why
 * every criterion is shown individually on the page rather than collapsed
 * into a single number the reader has to trust.
 *
 * Tests compare against the sector median wherever one exists, because an
 * absolute threshold means different things to a bank and a chipmaker.
 */

import {
  getFundamentalsFile,
  type UniverseCompany,
} from "./fundamentals-store";

export type Criterion = {
  key: string;
  label: string;
  explanation: string;
  passed: boolean;
  /** What the company reported, already formatted for display. */
  detail: string;
};

export type ScreenResult = {
  company: UniverseCompany;
  sectorLabel: string;
  score: number;
  maxScore: number;
  criteria: Criterion[];
};

const fmt = (v: number | null, suffix: string) =>
  v === null || !Number.isFinite(v) ? "—" : `${v.toFixed(1)}${suffix}`;

/** A test that cannot be evaluated counts as failed, never as passed.
 *  Missing data is not evidence of quality. */
function test(
  key: string,
  label: string,
  explanation: string,
  value: number | null,
  suffix: string,
  predicate: (v: number) => boolean,
): Criterion {
  const usable = value !== null && Number.isFinite(value);
  return {
    key,
    label,
    explanation,
    passed: usable ? predicate(value) : false,
    detail: fmt(value, suffix),
  };
}

function screenCompany(
  company: UniverseCompany,
  medians: Record<string, number | null>,
  sectorLabel: string,
): ScreenResult {
  const m = company.metrics;
  const med = (key: string) => medians[key] ?? null;

  const criteria: Criterion[] = [
    test(
      "roic",
      "ROIC מעל הסקטור",
      "תשואה על ההון המושקע גבוהה מהחציון — סימן ליתרון תחרותי",
      m.roic ?? null,
      "%",
      (v) => med("roic") !== null && v > med("roic")!,
    ),
    test(
      "operating_margin",
      "מרווח תפעולי מעל הסקטור",
      "החברה שומרת יותר מכל שקל מכירות מאשר המתחרות",
      m.operating_margin ?? null,
      "%",
      (v) => med("operating_margin") !== null && v > med("operating_margin")!,
    ),
    test(
      "fcf_margin",
      "תזרים חופשי חיובי",
      "הרווח החשבונאי מתורגם למזומן אמיתי",
      m.fcf_margin ?? null,
      "%",
      (v) => v > 0,
    ),
    test(
      "rev_growth",
      "הכנסות צומחות",
      "צמיחה חיובית בשלוש השנים האחרונות",
      m.rev_cagr_3 ?? null,
      "%",
      (v) => v > 0,
    ),
    test(
      "rev_growth_sector",
      "צמיחה מעל הסקטור",
      "החברה גדלה מהר מהמתחרות שלה",
      m.rev_cagr_3 ?? null,
      "%",
      (v) => med("rev_cagr_3") !== null && v > med("rev_cagr_3")!,
    ),
    test(
      "pe",
      "P/E מתחת לסקטור",
      "נסחרת בזול יחסית לרווחיה מול המתחרות",
      m.pe ?? null,
      "x",
      (v) => v > 0 && med("pe") !== null && v < med("pe")!,
    ),
    test(
      "ev_fcf",
      "EV/FCF מתחת לסקטור",
      "שווי הפעילות זול יחסית לתזרים שהיא מייצרת",
      m.ev_fcf ?? null,
      "x",
      (v) => v > 0 && med("ev_fcf") !== null && v < med("ev_fcf")!,
    ),
    test(
      "net_debt_ebitda",
      "חוב נטו מתון",
      "חוב נטו נמוך מפי שלושה מהרווח התפעולי לפני פחת",
      m.net_debt_ebitda ?? null,
      "x",
      (v) => v < 3,
    ),
    test(
      "interest_coverage",
      "כיסוי ריבית איתן",
      "הרווח התפעולי מכסה את הוצאות המימון לפחות פי חמישה",
      m.interest_coverage ?? null,
      "x",
      (v) => v > 5,
    ),
    test(
      "altman_z",
      "Altman Z באזור בטוח",
      "מדד מצוקה פיננסית מעל 2.99",
      m.altman_z ?? null,
      "",
      (v) => v > 2.99,
    ),
  ];

  return {
    company,
    sectorLabel,
    score: criteria.filter((c) => c.passed).length,
    maxScore: criteria.length,
    criteria,
  };
}

export async function runScreen(): Promise<{
  builtAt: string;
  results: ScreenResult[];
}> {
  const file = await getFundamentalsFile();

  const results = file.companies
    .map((company) => {
      const sector = file.sectors[company.sector];
      return screenCompany(
        company,
        sector?.medians ?? {},
        sector?.label ?? company.sector,
      );
    })
    // Ties broken by market cap so the order is stable between builds
    // rather than shuffling on every rebuild.
    .sort(
      (a, b) =>
        b.score - a.score ||
        (b.company.marketCap ?? 0) - (a.company.marketCap ?? 0),
    );

  return { builtAt: file.builtAt, results };
}
