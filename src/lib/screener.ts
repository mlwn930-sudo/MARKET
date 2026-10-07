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
import { getRanks } from "./metrics/rank-store";
import type { BarCharacter } from "./metrics/tape";

export type Criterion = {
  key: string;
  label: string;
  explanation: string;
  status: "pass" | "fail" | "insufficient-data";
  passed: boolean;
  /** What the company reported, already formatted for display. */
  detail: string;
  /**
   * What that figure was measured against, already formatted — the sector
   * median for a relative test, the fixed bar for an absolute one.
   *
   * CLAUDE.md rule 5: a figure on its own is a datum, a figure beside the
   * median it was compared to is knowledge. The screener computed these
   * medians to decide pass and fail and then threw them away, so every
   * reader of the register saw "EV/FCF מתחת לסקטור — 55.9x" and had no way
   * to know whether the sector sits at 20 or at 60.
   *
   * Null when the comparison itself does not exist: a sector too thin to
   * produce a median for this metric. A test whose bar is unknown cannot
   * print one (rule 9).
   */
  benchmark: string | null;
};

export type ScreenResult = {
  company: UniverseCompany;
  sectorLabel: string;
  score: number;
  maxScore: number;
  evaluatedCount: number;
  insufficientCount: number;
  criteria: Criterion[];
  /**
   * What the market is doing with the company — BESIDE the score, never
   * inside it.
   *
   * The obvious move was to make the strength rank an eleventh criterion.
   * It would have been wrong twice over. It turns a screen of reported
   * fundamentals into a mixed instrument where a reader cannot tell which
   * half of a score came from the business and which from the price. And
   * it erases the most useful distinction this page can draw: a company
   * passing eight tests while ranked 5 and a company passing eight tests
   * while ranked 85 are opposite situations — one is cheap and being sold,
   * the other is cheap and being bought — and a sum cannot say which.
   *
   * So the screen goes on reporting what the filings say, and this reports
   * what the tape says, in its own column. Null when the nightly ranking
   * has not run.
   */
  market: {
    strengthRank: number | null;
    volumeRank: number | null;
    universe: number;
    character: BarCharacter | null;
    asOf: string;
  } | null;
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
  benchmark: string | null,
): Criterion {
  const usable = value !== null && Number.isFinite(value);
  const passed = usable ? predicate(value) : false;
  return {
    key,
    label,
    explanation,
    status: !usable ? "insufficient-data" : passed ? "pass" : "fail",
    passed,
    detail: fmt(value, suffix),
    benchmark,
  };
}

function screenCompany(
  company: UniverseCompany,
  medians: Record<string, number | null>,
  sectorLabel: string,
): ScreenResult {
  const m = company.metrics;
  const med = (key: string) => medians[key] ?? null;

  /* The two kinds of bar a test can have. `sector` reads the same median
     the predicate below compares against — passed explicitly rather than
     derived from the criterion key, because they do not always match:
     "rev_growth_sector" is decided against the median of "rev_cagr_3". */
  const sector = (medianKey: string, suffix: string) => {
    const value = med(medianKey);
    return value === null ? null : `חציון הסקטור ${fmt(value, suffix)}`;
  };
  /* A fixed bar prints at the precision it was written at, not at the one
     decimal the reported figures use. Altman's cutoff is 2.99 and `fmt`
     rounded it to "3.0", which contradicted the explanation in the same
     row — a bar a reader cannot match to the rule is worse than no bar. */
  const bar = (value: number, suffix: string) =>
    `הרף ${Number.isInteger(value * 10) ? value.toFixed(1) : value.toFixed(2)}${suffix}`;

  const criteria: Criterion[] = [
    test(
      "roic",
      "ROIC מעל הסקטור",
      "תשואה על ההון המושקע גבוהה מהחציון — סימן ליתרון תחרותי",
      m.roic ?? null,
      "%",
      (v) => med("roic") !== null && v > med("roic")!,
      sector("roic", "%"),
    ),
    test(
      "operating_margin",
      "מרווח תפעולי מעל הסקטור",
      "החברה שומרת יותר מכל שקל מכירות מאשר המתחרות",
      m.operating_margin ?? null,
      "%",
      (v) => med("operating_margin") !== null && v > med("operating_margin")!,
      sector("operating_margin", "%"),
    ),
    test(
      "fcf_margin",
      "תזרים חופשי חיובי",
      "הרווח החשבונאי מתורגם למזומן אמיתי",
      m.fcf_margin ?? null,
      "%",
      (v) => v > 0,
      bar(0, "%"),
    ),
    test(
      "rev_growth",
      "הכנסות צומחות",
      "צמיחה חיובית בשלוש השנים האחרונות",
      m.rev_cagr_3 ?? null,
      "%",
      (v) => v > 0,
      bar(0, "%"),
    ),
    test(
      "rev_growth_sector",
      "צמיחה מעל הסקטור",
      "החברה גדלה מהר מהמתחרות שלה",
      m.rev_cagr_3 ?? null,
      "%",
      (v) => med("rev_cagr_3") !== null && v > med("rev_cagr_3")!,
      sector("rev_cagr_3", "%"),
    ),
    test(
      "pe",
      "P/E מתחת לסקטור",
      "נסחרת בזול יחסית לרווחיה מול המתחרות",
      m.pe ?? null,
      "x",
      (v) => v > 0 && med("pe") !== null && v < med("pe")!,
      sector("pe", "x"),
    ),
    test(
      "ev_fcf",
      "EV/FCF מתחת לסקטור",
      "שווי הפעילות זול יחסית לתזרים שהיא מייצרת",
      m.ev_fcf ?? null,
      "x",
      (v) => v > 0 && med("ev_fcf") !== null && v < med("ev_fcf")!,
      sector("ev_fcf", "x"),
    ),
    test(
      "net_debt_ebitda",
      "חוב נטו מתון",
      "חוב נטו נמוך מפי שלושה מהרווח התפעולי לפני פחת",
      m.net_debt_ebitda ?? null,
      "x",
      (v) => v < 3,
      bar(3, "x"),
    ),
    test(
      "interest_coverage",
      "כיסוי ריבית איתן",
      "הרווח התפעולי מכסה את הוצאות המימון לפחות פי חמישה",
      m.interest_coverage ?? null,
      "x",
      (v) => v > 5,
      bar(5, "x"),
    ),
    test(
      "altman_z",
      "Altman Z באזור בטוח",
      "מדד מצוקה פיננסית מעל 2.99",
      m.altman_z ?? null,
      "",
      (v) => v > 2.99,
      bar(2.99, ""),
    ),
  ];

  return {
    company,
    sectorLabel,
    score: criteria.filter((c) => c.status === "pass").length,
    maxScore: criteria.length,
    evaluatedCount: criteria.filter((c) => c.status !== "insufficient-data").length,
    insufficientCount: criteria.filter((c) => c.status === "insufficient-data").length,
    criteria,
    /* Filled by the caller, which is the only place holding the ranking.
       This function takes a company and its sector medians and nothing
       else; giving it a file read would make a pure scoring function
       depend on the filesystem. */
    market: null,
  };
}

export async function runScreen(): Promise<{
  builtAt: string;
  results: ScreenResult[];
}> {
  const [file, ranks] = await Promise.all([
    getFundamentalsFile(),
    /* Never fatal. A clone that has not run the nightly ranking still gets
       the screen it has always had, with the market column simply absent. */
    getRanks().catch(() => null),
  ]);

  const results = file.companies
    .map((company) => {
      const sector = file.sectors[company.sector];
      const result = screenCompany(
        company,
        sector?.medians ?? {},
        sector?.label ?? company.sector,
      );
      const rank = ranks?.reads[company.ticker];
      result.market = ranks
        ? {
            strengthRank: rank?.strengthRank ?? null,
            volumeRank: rank?.volumeRank ?? null,
            universe: ranks.universe,
            character: rank?.character ?? null,
            asOf: ranks.asOf,
          }
        : null;
      return result;
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
