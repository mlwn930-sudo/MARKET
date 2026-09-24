import type { BasicFinancials } from "@/lib/sources/finnhub";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { SectorContext } from "@/lib/fundamentals-store";
import {
  derived,
  finnhub,
  gradeConfidence,
  type AgentReport,
  type Finding,
} from "./types";

/**
 * Agent 2 — the valuation analyst.
 *
 * Answers one question the rest of the site could not previously answer:
 * is this expensive compared to what?
 *
 * A multiple on its own is meaningless, and a multiple against the sector
 * median — which is all this project had — answers only half of it. A
 * company can trade above its peers and below its own five-year average at
 * the same time, and those two facts point in opposite directions. So every
 * multiple here is placed against BOTH: its peers, and the company's own
 * history.
 *
 * The history comes from Finnhub's ratio series, which the free tier
 * provides going back several years. Forward multiples do not appear
 * anywhere, because the consensus endpoint returns 403 on this plan and a
 * forward P/E we cannot fetch is not one we are entitled to print.
 */

/** The company's own median for a ratio, from its reported history. */
function ownMedian(
  financials: BasicFinancials | null,
  key: string,
): { median: number; years: number } | null {
  const series = financials?.annual?.[key];
  if (!series || series.length < 3) return null;

  const values = series
    .map((point) => point.v)
    .filter((v) => Number.isFinite(v) && v > 0)
    .sort((a, b) => a - b);

  if (values.length < 3) return null;
  const mid = Math.floor(values.length / 2);
  const median =
    values.length % 2 === 0
      ? (values[mid - 1] + values[mid]) / 2
      : values[mid];

  return { median, years: values.length };
}

/**
 * The quadrant. This is the section the reader is really after when they
 * ask whether a stock is worth owning: is the problem the business, or is
 * the problem the price?
 *
 * They are completely different problems. A weak business at any price is a
 * question about the company; a strong business at a high price is a
 * question about patience. Collapsing them into one "expensive" verdict is
 * what makes most screeners useless.
 */
export type BusinessVsPrice = {
  businessQuality: "strong" | "mixed" | "weak" | "unknown";
  priceLevel: "cheap" | "fair" | "rich" | "unknown";
  /** The four-way read, in one sentence. */
  verdict: string;
  /** What the reader should conclude from the pairing. */
  implication: string;
};

export function businessVsPrice(
  fundamentals: Fundamentals,
  spread: number | null,
  premiumPercent: number | null,
  ownPremiumPercent: number | null,
): BusinessVsPrice {
  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found.value;
    }
    return null;
  };

  const operating = metric("operating_margin");
  const growth = metric("rev_cagr_3");

  // Business quality from three things that are hard to fake: the spread
  // over the cost of capital, whether the operation is profitable at all,
  // and whether revenue is still growing.
  let qualityScore = 0;
  let measured = 0;
  if (spread !== null) {
    measured++;
    qualityScore += spread > 2 ? 1 : spread < -2 ? -1 : 0;
  }
  if (operating !== null) {
    measured++;
    qualityScore += operating > 12 ? 1 : operating <= 0 ? -1 : 0;
  }
  if (growth !== null) {
    measured++;
    qualityScore += growth > 8 ? 1 : growth < 0 ? -1 : 0;
  }

  const businessQuality: BusinessVsPrice["businessQuality"] =
    measured < 2
      ? "unknown"
      : qualityScore >= 2
        ? "strong"
        : qualityScore <= -1
          ? "weak"
          : "mixed";

  // Price level from the two comparisons together. Agreeing with itself is
  // what makes the read trustworthy; when they disagree it lands on "fair",
  // which is the honest answer to a genuine split.
  const signals = [premiumPercent, ownPremiumPercent].filter(
    (v): v is number => v !== null,
  );

  const priceLevel: BusinessVsPrice["priceLevel"] =
    signals.length === 0
      ? "unknown"
      : signals.every((v) => v > 25)
        ? "rich"
        : signals.every((v) => v < -20)
          ? "cheap"
          : "fair";

  const QUADRANT: Record<string, { verdict: string; implication: string }> = {
    "strong|rich": {
      verdict: "עסק חזק, מחיר גבוה",
      implication:
        "הבעיה כאן היא המחיר, לא החברה. התשובה תלויה בשאלה אם הצמיחה תצדיק את המכפיל — וזה סיכון של סבלנות, לא של עסק.",
    },
    "strong|fair": {
      verdict: "עסק חזק, תמחור סביר",
      implication:
        "לא זול ולא יקר ביחס למה שידוע. זה המצב שבו המספרים הכי פחות עומדים בדרך, ומה שיכריע הוא מה שיקרה מכאן.",
    },
    "strong|cheap": {
      verdict: "עסק חזק, תמחור נמוך",
      implication:
        "השילוב הזה נדיר, ולכן שווה לשאול למה. לרוב יש סיבה שהשוק רואה ושלא מופיעה בדוח האחרון — תחרות, רגולציה, או ציפייה להאטה.",
    },
    "weak|cheap": {
      verdict: "עסק חלש, מחיר נמוך",
      implication:
        "הבעיה היא החברה, לא המחיר. מכפיל נמוך על עסק מצטמק אינו הנחה — הוא תמחור נכון של מה שקורה.",
    },
    "weak|rich": {
      verdict: "עסק חלש, מחיר גבוה",
      implication:
        "השילוב הכי קשה להצדקה מהנתונים שיש. אם יש כאן תזה, היא חייבת להישען על משהו שעדיין לא בדוחות.",
    },
    "weak|fair": {
      verdict: "עסק חלש, תמחור ממוצע",
      implication:
        "השוק מתמחר את החולשה. כדי שתהיה כאן הזדמנות צריך שינוי בעסק עצמו, לא במכפיל.",
    },
    "mixed|rich": {
      verdict: "תמונה מעורבת, מחיר גבוה",
      implication:
        "חלק מהמדדים חזקים וחלק לא, והמחיר מתמחר את החלק החזק. הפער הזה הוא הסיכון.",
    },
    "mixed|fair": {
      verdict: "תמונה מעורבת, תמחור סביר",
      implication:
        "אין כאן עיוות תמחור בולט לכאן או לכאן. מה שיכריע הוא איזה מהמדדים המעורבים ינצח.",
    },
    "mixed|cheap": {
      verdict: "תמונה מעורבת, תמחור נמוך",
      implication:
        "השוק מתמחר את הצד החלש. אם הצד החזק מתגבר, הפער הזה הוא ההזדמנות — ואם לא, הוא תמחור נכון.",
    },
  };

  const key = `${businessQuality}|${priceLevel}`;
  const entry = QUADRANT[key];

  return {
    businessQuality,
    priceLevel,
    verdict: entry?.verdict ?? "אין די נתונים לקביעת הצירוף",
    implication:
      entry?.implication ??
      "חסרים מדדים כדי להכריע אם השאלה כאן היא על העסק או על המחיר.",
  };
}

export type ValuationRead = {
  report: AgentReport;
  quadrant: BusinessVsPrice;
  /** Premium over the sector median, in percent. */
  sectorPremium: number | null;
  /** Premium over the company's own multi-year median. */
  historyPremium: number | null;
};

export function valuationAnalyst(
  fundamentals: Fundamentals,
  financials: BasicFinancials | null,
  sector: SectorContext | null,
  spread: number | null,
): ValuationRead {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  const asOf = fundamentals.asOf?.end ?? null;

  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found.value;
    }
    return null;
  };

  /**
   * The multiple to compare on.
   *
   * P/E first, and P/S when there is no P/E — which is not a fallback so
   * much as the correct choice for the case. A company with no earnings has
   * no earnings multiple, and reporting "cannot be valued" for every
   * loss-making business would silence the page exactly on the companies
   * where the valuation question is hardest and most interesting.
   *
   * The basis is named everywhere the result appears, because a P/S of 5
   * and a P/E of 5 are not remotely the same statement.
   */
  const pe = metric("pe");
  const ps = metric("ps");
  const evEbitda = metric("ev_ebitda");

  const usingSales = pe === null && ps !== null;
  const multiple = pe ?? ps;
  const multipleLabel = usingSales ? "P/S" : "P/E";
  const historyKey = usingSales ? "psAnnual" : "pe";
  const sectorKey = usingSales ? "ps" : "pe";

  /* ---- Against the sector ---- */

  let sectorPremium: number | null = null;
  const sectorMedian = sector?.medians[sectorKey] ?? null;

  if (multiple !== null && sectorMedian != null && sectorMedian > 0) {
    sectorPremium = ((multiple - sectorMedian) / sectorMedian) * 100;
  } else if (!sector) {
    gaps.push("החברה מחוץ ליקום ההשוואה — אין חציון סקטור להשוות אליו.");
  }

  /* ---- Against its own history ---- */

  let historyPremium: number | null = null;
  const ownPe = ownMedian(financials, historyKey) ?? ownMedian(financials, "pe");
  const ownEv = ownMedian(financials, "evEbitda");

  if (multiple !== null && ownPe) {
    historyPremium = ((multiple - ownPe.median) / ownPe.median) * 100;
  } else if (!financials) {
    gaps.push("היסטוריית מכפילים לא נטענה — אין השוואה למכפיל של החברה עצמה.");
  } else if (!ownPe) {
    gaps.push(
      `אין די שנים של ${multipleLabel} חיובי כדי לחשב חציון היסטורי לחברה.`,
    );
  }

  if (usingSales) {
    gaps.push(
      "לחברה אין רווח חיובי, ולכן ההשוואה נעשית על מכפיל הכנסות ולא על מכפיל רווח. מכפיל הכנסות מתעלם לחלוטין מהרווחיות.",
    );
  }

  /* ---- The finding ---- */

  if (sectorPremium !== null || historyPremium !== null) {
    const parts: string[] = [];
    if (sectorPremium !== null) {
      parts.push(
        `${Math.abs(sectorPremium).toFixed(0)}% ${sectorPremium > 0 ? "מעל" : "מתחת ל"}חציון הסקטור`,
      );
    }
    if (historyPremium !== null && ownPe) {
      parts.push(
        `${Math.abs(historyPremium).toFixed(0)}% ${historyPremium > 0 ? "מעל" : "מתחת ל"}חציון של החברה עצמה ב-${ownPe.years} השנים האחרונות`,
      );
    }

    const bothDirections =
      sectorPremium !== null &&
      historyPremium !== null &&
      Math.sign(sectorPremium) !== Math.sign(historyPremium);

    const grade = gradeConfidence({
      evidenceCount: [sectorPremium, historyPremium, evEbitda].filter(
        (v) => v !== null,
      ).length,
      ageDays: null,
      nearThreshold: bothDirections,
    });

    findings.push({
      id: "valuation",
      title: bothDirections
        ? "שתי ההשוואות מצביעות לכיוונים הפוכים"
        : (sectorPremium ?? historyPremium ?? 0) > 0
          ? "תמחור בפרמיה"
          : "תמחור בדיסקאונט",
      body: bothDirections
        ? `המניה ${parts.join(", ו")}. כששתי נקודות הייחוס לא מסכימות, אף אחת מהן לא מכריעה לבדה — ההבדל בדרך כלל אומר שהסקטור כולו זז, לא החברה.`
        : `המניה ${parts.join(", ו")}. פרמיה אינה בעיה כשהצמיחה והתשואה על ההון מצדיקות אותה; מה שהיא כן אומרת הוא שהרבה כבר מתומחר, וכל אכזבה יקרה.`,
      stance: "neutral",
      confidence: grade.confidence,
      confidenceReason: `${grade.reason}. מכפיל עתידי אינו זמין בשכבת הנתונים החינמית ולכן אינו נכלל.`,
      evidence: [
        ...(multiple !== null
          ? [
              {
                label: `${multipleLabel} נוכחי`,
                value: multiple.toFixed(1),
                source: derived(
                  usingSales
                    ? "שווי שוק חלקי הכנסות TTM — אין רווח חיובי"
                    : "שווי שוק חלקי רווח נקי TTM",
                ),
              },
            ]
          : []),
        ...(sectorMedian != null
          ? [
              {
                label: `חציון ${sector?.label ?? "הסקטור"}`,
                value: sectorMedian.toFixed(1),
                source: derived(`${sector?.peerCount ?? 0} חברות ביקום`),
              },
            ]
          : []),
        ...(ownPe
          ? [
              {
                label: "חציון היסטורי של החברה",
                value: ownPe.median.toFixed(1),
                source: finnhub(asOf, `${ownPe.years} שנים`),
              },
            ]
          : []),
        ...(ownEv
          ? [
              {
                label: "EV/EBITDA היסטורי",
                value: ownEv.median.toFixed(1),
                source: finnhub(asOf, `${ownEv.years} שנים`),
              },
            ]
          : []),
      ],
      horizon: "medium",
    });
  } else {
    gaps.push("לא ניתן היה לתמחר את החברה מול אף נקודת ייחוס — אין מכפיל רווח ואין מכפיל הכנסות.");
  }

  gaps.push(
    "מחיר יעד ותחזית הכנסות של אנליסטים אינם זמינים במסלול הנתונים של האתר, ולכן אינם מופיעים כאן.",
  );

  return {
    report: { agent: "valuation", label: "אנליסט תמחור", findings, gaps },
    quadrant: businessVsPrice(
      fundamentals,
      spread,
      sectorPremium,
      historyPremium,
    ),
    sectorPremium,
    historyPremium,
  };
}
