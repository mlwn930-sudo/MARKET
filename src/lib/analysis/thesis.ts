/**
 * The bottom line: everything the site computed about a company, reduced to
 * what a reader can actually act on.
 *
 * This is the one module where the project is most at risk of crossing a
 * line it has drawn for itself, so the boundary is written into the code
 * rather than left to whoever edits it next.
 *
 * What it does: state what each framework found, name the disagreements
 * between them, and say what would change the picture. Disagreement is the
 * valuable output — a stock that is cheap on every measure and falling on
 * every measure is telling you something, and averaging the two into a score
 * throws away the only interesting part.
 *
 * What it must never do: recommend buying or selling, predict a price, or
 * assign a rating. Those are not withheld out of caution. A recommendation
 * assembled from public filings by a program that does not know the reader's
 * position, horizon or tax situation is worth less than nothing, because it
 * is confident.
 *
 * The distinction in practice: "the stock trades at 40x while the sector
 * median is 22x, and the growth that would justify it has slowed for two
 * years" is analysis. "Overvalued, avoid" is a rating. The first sentence
 * hands the reader the argument; the second asks them to trust the site.
 */

import type { CapitalQuality } from "@/lib/metrics/capital";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { TechnicalRead } from "@/lib/metrics/technical";
import type { SectorContext } from "@/lib/fundamentals-store";

export type ThesisPoint = {
  /** A finding in the company's favour, against it, or a live question. */
  kind: "strength" | "concern" | "watch";
  title: string;
  body: string;
  /** Which framework produced it, so a reader can weigh it. */
  source: "פונדמנטלי" | "טכני" | "הון" | "סקטור";
};

export type Thesis = {
  headline: string;
  points: ThesisPoint[];
  /** Where the frameworks disagree — the part worth reading twice. */
  tension: string | null;
  bottomLine: string;
  /** What the data cannot answer. Stated, not omitted. */
  unknowns: string[];
};

const metricValue = (fundamentals: Fundamentals, key: string): number | null => {
  for (const group of fundamentals.groups) {
    const found = group.metrics.find((m) => m.key === key);
    if (found) return found.value;
  }
  return null;
};

export function buildThesis(
  fundamentals: Fundamentals,
  capital: CapitalQuality,
  technical: TechnicalRead | null,
  sector: SectorContext | null,
  companyName: string,
): Thesis {
  const points: ThesisPoint[] = [];
  const unknowns: string[] = [];

  const { costOfCapital, stockComp, cashCycle, leverage, allocation } = capital;

  /* ---- Does the business earn more than its capital costs? ---- */

  if (costOfCapital.verdict === "creates") {
    points.push({
      kind: "strength",
      title: "העסק מייצר ערך על ההון",
      body: costOfCapital.note,
      source: "הון",
    });
  } else if (costOfCapital.verdict === "destroys") {
    points.push({
      kind: "concern",
      title: "התשואה על ההון נמוכה מעלותו",
      body: costOfCapital.note,
      source: "הון",
    });
  } else if (costOfCapital.verdict === "marginal") {
    points.push({
      kind: "watch",
      title: "המרווח על ההון אפסי",
      body: costOfCapital.note,
      source: "הון",
    });
  } else {
    unknowns.push("לא ניתן היה לחשב עלות הון — חסר נתון מאזני או beta.");
  }

  /* ---- What does the profit cost in ownership? ---- */

  if (stockComp.verdict === "diluting") {
    points.push({
      kind: "concern",
      title: "התגמול במניות מדלל",
      body: stockComp.note,
      source: "הון",
    });
  } else if (stockComp.verdict === "creating") {
    points.push({
      kind: "strength",
      title: "ספירת המניות מצטמצמת בפועל",
      body: stockComp.note,
      source: "הון",
    });
  } else if (stockComp.verdict === "offsetting") {
    points.push({
      kind: "watch",
      title: "הרכישה העצמית סופגת דילול ולא מחזירה הון",
      body: stockComp.note,
      source: "הון",
    });
  }

  /* ---- Is growth becoming more profitable? ---- */

  if (leverage.turning === "inflecting") {
    points.push({
      kind: "strength",
      title: "מינוף תפעולי בנקודת מפנה",
      body: leverage.note,
      source: "פונדמנטלי",
    });
  } else if (leverage.turning === "eroding") {
    points.push({
      kind: "concern",
      title: "הצמיחה החדשה פחות רווחית",
      body: leverage.note,
      source: "פונדמנטלי",
    });
  }

  /* ---- Does the business fund itself? ---- */

  if (cashCycle.financedBySuppliers) {
    points.push({
      kind: "strength",
      title: "מחזור המזומנים שלילי",
      body: cashCycle.note,
      source: "פונדמנטלי",
    });
  } else if (cashCycle.cycle !== null && cashCycle.cycle > 120) {
    points.push({
      kind: "concern",
      title: "הון חוזר כבד",
      body: cashCycle.note,
      source: "פונדמנטלי",
    });
  }

  /* ---- Balance sheet ---- */

  const netDebtEbitda = metricValue(fundamentals, "net_debt_ebitda");
  if (netDebtEbitda !== null && netDebtEbitda > 3) {
    points.push({
      kind: "concern",
      title: "מינוף פיננסי גבוה",
      body: `חוב נטו של פי ${netDebtEbitda.toFixed(1)} מה-EBITDA. רמה כזו מצמצמת את מרחב התמרון בתקופה חלשה, ומייקרת כל מיחזור חוב בסביבת ריבית גבוהה.`,
      source: "פונדמנטלי",
    });
  }

  /* ---- Valuation against the sector ---- */

  if (sector) {
    const comparisons: string[] = [];
    for (const key of ["pe", "ps", "ev_ebitda"] as const) {
      const value = metricValue(fundamentals, key);
      const median = sector.medians[key];
      if (value === null || median == null || median === 0) continue;
      const difference = ((value - median) / Math.abs(median)) * 100;
      if (Math.abs(difference) < 15) continue;

      const label = key === "pe" ? "P/E" : key === "ps" ? "P/S" : "EV/EBITDA";
      comparisons.push(
        `${label} ${value.toFixed(1)} מול חציון ${median.toFixed(1)} בסקטור (${difference > 0 ? "+" : ""}${difference.toFixed(0)}%)`,
      );
    }

    if (comparisons.length > 0) {
      const premium = comparisons.some((c) => c.includes("(+"));
      points.push({
        kind: "watch",
        title: premium ? "תמחור בפרמיה על הסקטור" : "תמחור בדיסקאונט על הסקטור",
        body: `${comparisons.join(" · ")}. ${
          premium
            ? "פרמיה אינה בעיה כשלעצמה — השאלה היא אם הצמיחה והתשואה על ההון מצדיקות אותה. שתיהן מופיעות למעלה בעמוד."
            : "דיסקאונט אינו הזדמנות כשלעצמו — לפעמים הוא תמחור נכון של עסק שנחלש. ההשוואה מול השנים הקודמות היא מה שמפריד בין השניים."
        }`,
        source: "סקטור",
      });
    }
  } else {
    unknowns.push("החברה מחוץ ליקום ההשוואה, ולכן אין חציון סקטור להשוות אליו.");
  }

  /* ---- Technicals ---- */

  if (technical) {
    const { stage, template, vcp, volume, relative } = technical;

    if (stage.stage === 2) {
      points.push({
        kind: "strength",
        title: `${stage.label}${stage.daysInStage ? ` — ${stage.daysInStage} ימי מסחר` : ""}`,
        body: `${stage.note} ${template.passed} מתוך ${template.evaluated} קריטריונים של תבנית המגמה מתקיימים.`,
        source: "טכני",
      });
    } else if (stage.stage === 4) {
      points.push({
        kind: "concern",
        title: stage.label,
        body: `${stage.note} מסגרת ניתוח השלבים מתייחסת לשלב הזה כאל השלב שבו נגרם רוב הנזק, ללא קשר לאיכות העסק.`,
        source: "טכני",
      });
    } else if (stage.stage !== null) {
      points.push({
        kind: "watch",
        title: stage.label,
        body: stage.note,
        source: "טכני",
      });
    }

    if (vcp.verdict === "tight") {
      points.push({
        kind: "watch",
        title: volume.dryUp ? "בסיס מהודק עם התייבשות מחזורים" : "בסיס מהודק",
        body: `${vcp.note} ${volume.note}`,
        source: "טכני",
      });
    }

    if (relative?.consistent) {
      points.push({
        kind: "strength",
        title: "עדיפות עקבית על המדד",
        body: `המניה הניבה יותר מ-S&P 500 בחודש, בשלושה חודשים ובחצי שנה. זו לא תחזית — זה תיאור של מי שקנה ומי שמכר עד כה.`,
        source: "טכני",
      });
    }
  } else {
    unknowns.push("היסטוריית המחירים לא נטענה, ולכן אין ניתוח טכני בעמוד הזה.");
  }

  /* ---- Where the frameworks disagree ---- */

  const fundamentalStrong =
    costOfCapital.verdict === "creates" && stockComp.verdict !== "diluting";
  const technicalWeak = technical?.stage.stage === 4;
  const fundamentalWeak = costOfCapital.verdict === "destroys";
  const technicalStrong = technical?.stage.stage === 2;

  let tension: string | null = null;
  if (fundamentalStrong && technicalWeak) {
    tension =
      "העסק מייצר תשואה מעל עלות ההון, אבל המחיר בשלב 4. הפער הזה אומר שהשוק מתמחר משהו שלא נמצא בדוח האחרון — ירידה צפויה בביקוש, לחץ תחרותי, או סיכון רגולטורי. שווה לברר מה, לפני שמניחים שהשוק טועה.";
  } else if (fundamentalWeak && technicalStrong) {
    tension =
      "המחיר בשלב 2 בזמן שהתשואה על ההון נמוכה מעלותו. עלייה שאינה נסמכת על יצירת ערך תלויה בהמשך הזרימה לתוך המניה, וזה בדיוק סוג התמיכה שנעלם ראשון.";
  } else if (
    technical?.vcp.verdict === "tight" &&
    !technical.volume.dryUp
  ) {
    tension =
      "התבנית מהודקת אבל המחזור לא התייבש. מחיר שמתכווץ בלי שהמוכרים נעלמים נראה כמו בסיס ומתנהג כמו הפסקה.";
  }

  /* ---- Headline and bottom line ---- */

  const strengths = points.filter((p) => p.kind === "strength").length;
  const concerns = points.filter((p) => p.kind === "concern").length;

  const headline =
    concerns === 0 && strengths > 0
      ? `${companyName}: כל המדדים שנבדקו מצביעים לאותו כיוון`
      : strengths === 0 && concerns > 0
        ? `${companyName}: הבדיקות שבוצעו מעלות בעיקר סימני שאלה`
        : `${companyName}: ${strengths} ממצאים לטובה, ${concerns} סימני שאלה`;

  const spreadText =
    costOfCapital.spread !== null
      ? `המרווח בין התשואה על ההון לעלותו הוא ${costOfCapital.spread > 0 ? "+" : ""}${costOfCapital.spread.toFixed(1)} נקודות אחוז`
      : "המרווח בין התשואה על ההון לעלותו לא ניתן לחישוב";

  const stageText =
    technical?.stage.stage !== null && technical?.stage.stage !== undefined
      ? `המחיר נמצא ב${technical.stage.label.replace("שלב", "שלב")}`
      : "אין קריאה טכנית";

  const allocationText = allocation.priority
    ? `התזרים הולך בעיקר ל${allocation.priority}`
    : "חלוקת התזרים אינה ניתנת לסיכום מהדוח";

  const bottomLine = `${spreadText}. ${stageText}. ${allocationText}. ${
    tension
      ? "המסגרות אינן מסכימות ביניהן — ההסבר בפסקה שמעל."
      : "המסגרות מצביעות לאותו כיוון, וזה מקטין את הסיכוי שהתמונה נשענת על מדד בודד."
  } מה שמופיע כאן הוא תיאור של מה שכבר קרה בדוחות ובמחיר, לא תחזית ולא המלצה.`;

  unknowns.push(
    "הדוחות מתארים רבעון שכבר הסתיים. שינוי בביקוש, בתחרות או ברגולציה שהתרחש מאז אינו נמצא באף אחד מהמספרים בעמוד.",
  );

  if (fundamentals.stale) {
    unknowns.push(
      "הדוח האחרון בן יותר מ-120 יום, כך שהפער בין המספרים למציאות גדול מהרגיל.",
    );
  }

  return { headline, points, tension, bottomLine, unknowns };
}
