import type { Verdict } from "@/lib/analysis/verdict";
import type { BusinessVsPrice } from "./valuation";
import type { Catalyst } from "./catalyst";
import {
  CONFIDENCE_LABELS,
  type AgentReport,
  type Confidence,
  type Finding,
} from "./types";

/**
 * Agent 11 — synthesis.
 *
 * The central idea of this module, and the thing the rest of the site was
 * missing: the Core Test and the Investment Thesis are different questions,
 * and a company can legitimately fail the first while the second stays
 * open.
 *
 *   The Core Test asks: does the company meet the quantitative criteria,
 *   as reported? It is backward-looking by construction and it is a
 *   pass/fail. Take-Two fails it — negative operating margin, negative free
 *   cash flow, a return below the cost of capital.
 *
 *   The Investment Thesis asks: is there a documented reason the market may
 *   price this differently later? That is a different question, and "the
 *   last four quarters were bad" is not an answer to it.
 *
 * Collapsing the two is what makes a screener useless on exactly the
 * companies worth thinking about. Every business in the middle of a heavy
 * investment cycle fails a checklist built on trailing figures.
 *
 * The discipline that keeps this from becoming wishful thinking: a thesis
 * may only be built from findings that already carry evidence. This module
 * creates no facts. If the agents produced nothing that supports a
 * forward-looking reading, the thesis is "insufficient data" — not
 * "positive because the story is exciting".
 */

export type ThesisStatus =
  | "positive"
  | "watch"
  | "high-risk"
  | "negative"
  | "insufficient";

export const THESIS_LABELS: Record<ThesisStatus, { label: string; mark: string }> =
  {
    positive: { label: "תזה חיובית", mark: "●" },
    watch: { label: "במעקב — דורש אישור", mark: "◐" },
    "high-risk": { label: "סיכון גבוה", mark: "◑" },
    negative: { label: "תזה שלילית", mark: "○" },
    insufficient: { label: "אין די נתונים", mark: "·" },
  };

export type DecisionFactor = {
  factor: string;
  /** Four states, never colour alone — each carries its evidence. */
  status: "strong" | "adequate" | "watch" | "weak" | "unknown";
  evidence: string;
};

export type InvestmentThesis = {
  status: ThesisStatus;
  /** One sentence a reader can leave with. */
  headline: string;
  /** Why the company is interesting, each tied to a finding. */
  whyInteresting: string[];
  /** What changed recently to make this worth looking at now. */
  whyNow: string[];
  /** What would have to go right. */
  conditions: string[];
  /** What would break it. */
  breakers: string[];
  confidence: Confidence;
  confidenceReason: string;
  /**
   * Why a company that failed the Core Test is still being tracked. Present
   * only when it did fail — and the explanation is required, not optional.
   */
  whyStillTracked: string | null;
};

const STATUS_ORDER: Record<ThesisStatus, number> = {
  positive: 4,
  watch: 3,
  "high-risk": 2,
  negative: 1,
  insufficient: 0,
};

/** The weakest confidence among the inputs — a chain is as strong as its
 *  weakest link, and averaging confidences hides the weak one. */
function weakest(findings: Finding[]): Confidence {
  const rank: Record<Confidence, number> = { low: 0, medium: 1, high: 2 };
  return findings.reduce<Confidence>((lowest, finding) => {
    return rank[finding.confidence] < rank[lowest] ? finding.confidence : lowest;
  }, "high");
}

export function synthesise({
  companyName,
  verdict,
  reports,
  quadrant,
  catalysts,
}: {
  companyName: string;
  /** The Core Test, already computed. */
  verdict: Verdict;
  reports: AgentReport[];
  quadrant: BusinessVsPrice;
  catalysts: Catalyst[];
}): { thesis: InvestmentThesis; matrix: DecisionFactor[] } {
  const all = reports.flatMap((report) => report.findings);
  const supporting = all.filter((f) => f.stance === "supports");
  const opposing = all.filter((f) => f.stance === "opposes");

  const contrarian =
    reports.find((r) => r.agent === "contrarian")?.findings ?? [];
  const risk = reports.find((r) => r.agent === "risk")?.findings ?? [];

  /* ---- Status ---- */

  const corePassed = verdict.stance === "passes";
  const coreFailed = verdict.stance === "fails";
  const hasForwardReason =
    supporting.length > 0 || catalysts.some((c) => c.date !== null);

  let status: ThesisStatus;
  if (all.length < 3) {
    status = "insufficient";
  } else if (corePassed && opposing.length <= 1) {
    status = "positive";
  } else if (coreFailed && !hasForwardReason) {
    status = "negative";
  } else if (coreFailed && hasForwardReason) {
    // The case this module exists for: the trailing numbers fail, but
    // something dated or measured points forward.
    status = risk.length >= 3 ? "high-risk" : "watch";
  } else if (opposing.length > supporting.length) {
    status = "high-risk";
  } else {
    status = "watch";
  }

  /* ---- The sentences ---- */

  const whyInteresting = supporting
    .slice(0, 6)
    .map((finding) => `${finding.title} — ${finding.evidence[0]?.value ?? ""}`.trim());

  const whyNow: string[] = [];
  for (const catalyst of catalysts) {
    if (catalyst.date) {
      whyNow.push(`${catalyst.title} ${catalyst.when}: ${catalyst.impact}`);
    }
  }
  const turning = all.find((f) => f.id === "operating-leverage");
  if (turning?.stance === "supports") whyNow.push(turning.body);
  const growthShift = all.find((f) => f.id === "revenue-growth");
  if (growthShift && /מאיצה/.test(growthShift.title)) {
    whyNow.push(growthShift.body);
  }

  const conditions: string[] = [];
  if (coreFailed) {
    for (const blocker of verdict.blockers.slice(0, 3)) {
      conditions.push(`שהמדד הבא יתהפך: ${blocker}`);
    }
  }
  if (quadrant.priceLevel === "rich") {
    conditions.push(
      "שהצמיחה תצדיק את המכפיל הנוכחי — במחיר הזה ביצוע לפי הציפיות כבר לא מספיק.",
    );
  }
  if (catalysts.some((c) => c.date)) {
    conditions.push(
      "שהדוח הקרוב יאשר את הכיוון ולא רק יחזור על הרבעון הקודם.",
    );
  }

  const breakers = [
    ...opposing.slice(0, 3).map((finding) => finding.title),
    ...contrarian.slice(0, 2).map((finding) => finding.title),
  ];

  /* ---- Why we still track a company that failed ---- */

  let whyStillTracked: string | null = null;
  if (coreFailed || verdict.stance === "mixed") {
    const reasons: string[] = [];
    if (supporting.length > 0) {
      reasons.push(supporting.map((f) => f.title).slice(0, 3).join(", "));
    }
    const dated = catalysts.filter((c) => c.date);
    if (dated.length > 0) {
      reasons.push(`${dated[0].title} ${dated[0].when}`);
    }
    if (quadrant.businessQuality !== "weak") {
      reasons.push(quadrant.verdict);
    }

    whyStillTracked =
      reasons.length > 0
        ? `${companyName} אינה עומדת כרגע בכל קריטריוני הליבה — ${verdict.blockers.slice(0, 2).join("; ")}. היא נשארת במעקב בגלל ${reasons.join("; ")}. מבחן הליבה מסתכל אחורה על מה שכבר דווח; הסיבות האלה מסתכלות קדימה, וזה לא אותו מבחן.`
        : `${companyName} אינה עומדת בקריטריוני הליבה, ולא נמצא בנתונים שום גורם צופה-פני-עתיד שמצדיק מעקב. היא נשארת ברשימה רק כנקודת השוואה.`;
  }

  /* ---- Headline ---- */

  const headline =
    status === "insufficient"
      ? `אין די נתונים מדווחים כדי לבנות תזה על ${companyName}.`
      : status === "positive"
        ? `${companyName} עוברת את מבחן הליבה, ו${supporting.length} ממצאים תומכים בקריאה קדימה.`
        : status === "negative"
          ? `${companyName} נכשלת במבחן הליבה, ולא נמצא בנתונים גורם שמצדיק קריאה חיובית.`
          : status === "high-risk"
            ? `${companyName}: יש סיבה להסתכל, אבל ${risk.length} סיכונים מדודים עומדים מולה.`
            : `${companyName} אינה עומדת בכל הקריטריונים, אך ${hasForwardReason ? "קיימת סיבה מבוססת להמשיך לעקוב" : "נשארת במעקב כנקודת השוואה"}.`;

  const confidence = all.length === 0 ? "low" : weakest(all);

  return {
    thesis: {
      status,
      headline,
      whyInteresting,
      whyNow,
      conditions,
      breakers,
      confidence,
      confidenceReason:
        all.length === 0
          ? "לא נאסף אף ממצא."
          : `${CONFIDENCE_LABELS[confidence]} — נקבעת לפי הממצא החלש ביותר מבין ${all.length}, לא לפי הממוצע. ${
              reports.flatMap((r) => r.gaps).length
            } פערי נתונים מדווחים בנפרד.`,
      whyStillTracked,
    },
    matrix: buildMatrix(all, verdict, quadrant, catalysts),
  };
}

/**
 * The decision matrix: one row per factor, each with the evidence behind
 * its status. The status is never the whole answer — a colour that cannot
 * be explained is a decoration, so the evidence column is required.
 */
function buildMatrix(
  findings: Finding[],
  verdict: Verdict,
  quadrant: BusinessVsPrice,
  catalysts: Catalyst[],
): DecisionFactor[] {
  const find = (id: string) => findings.find((f) => f.id === id);
  const evidenceOf = (finding: Finding | undefined, fallback: string) =>
    finding?.evidence[0]
      ? `${finding.evidence[0].label}: ${finding.evidence[0].value}`
      : fallback;

  const fromStance = (
    finding: Finding | undefined,
  ): DecisionFactor["status"] =>
    !finding
      ? "unknown"
      : finding.stance === "supports"
        ? "strong"
        : finding.stance === "opposes"
          ? "weak"
          : "adequate";

  const growth = find("revenue-growth");
  const health = find("balance-sheet");
  const spread = find("spread");
  const stage = find("stage");
  const dilution = find("dilution");

  return [
    {
      factor: "צמיחה",
      status: fromStance(growth),
      evidence: evidenceOf(growth, "לא ניתן לחשב קצב צמיחה"),
    },
    {
      factor: "איתנות פיננסית",
      status: fromStance(health),
      evidence: evidenceOf(health, "אין נתוני חוב מדווחים"),
    },
    {
      factor: "יצירת ערך",
      status: fromStance(spread),
      evidence: evidenceOf(spread, "לא ניתן לחשב מרווח מול עלות ההון"),
    },
    {
      factor: "תמחור",
      status:
        quadrant.priceLevel === "cheap"
          ? "strong"
          : quadrant.priceLevel === "rich"
            ? "watch"
            : quadrant.priceLevel === "fair"
              ? "adequate"
              : "unknown",
      evidence: quadrant.verdict,
    },
    {
      factor: "מומנטום",
      status: fromStance(stage),
      evidence: evidenceOf(stage, "אין די היסטוריית מחירים"),
    },
    {
      factor: "דילול",
      status: fromStance(dilution),
      evidence: evidenceOf(dilution, "אין היסטוריית ספירת מניות"),
    },
    {
      factor: "זרזים",
      status: catalysts.some((c) => c.date) ? "strong" : "unknown",
      evidence: catalysts.some((c) => c.date)
        ? `${catalysts.find((c) => c.date)!.title} ${catalysts.find((c) => c.date)!.when}`
        : "לא נמצא אירוע מתוזמן",
    },
    {
      factor: "מבחן הליבה",
      status:
        verdict.stance === "passes"
          ? "strong"
          : verdict.stance === "fails"
            ? "weak"
            : "watch",
      evidence: `${verdict.passed}/${verdict.evaluated} בדיקות · ליבה ${verdict.corePassed}/${verdict.coreEvaluated}`,
    },
  ];
}

export const MATRIX_LABELS: Record<DecisionFactor["status"], string> = {
  strong: "חזק",
  adequate: "תקין",
  watch: "למעקב",
  weak: "חלש",
  unknown: "אין נתון",
};

export { STATUS_ORDER };
