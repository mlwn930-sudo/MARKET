/**
 * The clear answer: does this company pass the checks, and what stops it.
 *
 * The thesis module lists findings. Readers kept asking a blunter question —
 * is it worth going in — and a list of findings is a fair answer to a
 * different question. This module answers the blunt one as far as it can be
 * answered honestly.
 *
 * What it will not do, and why. It does not say "buy". Not out of caution:
 * a recommendation needs the reader's position, horizon, tax situation and
 * what else they already own, and a program that knows none of those and
 * says "buy" anyway is not being bold, it is guessing with a confident
 * voice. The same stock at the same price is a reasonable position for one
 * person and a bad one for the next, and nothing in a filing distinguishes
 * them.
 *
 * What it does instead is take a position on the thing it CAN see. Ten
 * questions, each answered from computed figures, each with the number
 * attached. A verdict on the set. The specific blockers named rather than
 * averaged away. And the falsification — what would have to turn out to be
 * true for the favourable reading to be wrong — because a case that cannot
 * be wrong is not a case.
 *
 * Six of the ten are marked core. A company can miss supporting checks and
 * still be sound; missing two core checks is a different kind of company,
 * and the stance reflects that rather than counting everything equally.
 */

import type { CapitalQuality } from "@/lib/metrics/capital";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { TechnicalRead } from "@/lib/metrics/technical";
import type { SectorContext } from "@/lib/fundamentals-store";

export type VerdictCheck = {
  key: string;
  /** Phrased as a question with a yes or no answer. */
  question: string;
  passed: boolean | null;
  /** The figure behind the answer, so it can be argued with. */
  detail: string;
  /** Why this question is on the list at all. */
  why: string;
  core: boolean;
};

export type Verdict = {
  checks: VerdictCheck[];
  passed: number;
  evaluated: number;
  corePassed: number;
  coreEvaluated: number;
  stance: "passes" | "mixed" | "fails" | "unknown";
  /** One sentence, decisive. */
  headline: string;
  /** Why someone might go in — each tied to a number above. */
  reasonsFor: string[];
  /** What is standing in the way, specifically. */
  blockers: string[];
  /** What would have to be true for the favourable reading to be wrong. */
  falsification: string;
  /** Said plainly wherever this appears. */
  caveat: string;
};

const STANCE_LABEL: Record<Verdict["stance"], string> = {
  passes: "עוברת את הבדיקות",
  mixed: "עוברת חלקית",
  fails: "נכשלת בבדיקות הליבה",
  unknown: "אין די נתונים",
};

const metricValue = (fundamentals: Fundamentals, key: string): number | null => {
  for (const group of fundamentals.groups) {
    const found = group.metrics.find((m) => m.key === key);
    if (found) return found.value;
  }
  return null;
};

export function buildVerdict(
  fundamentals: Fundamentals,
  capital: CapitalQuality,
  technical: TechnicalRead | null,
  sector: SectorContext | null,
  companyName: string,
): Verdict {
  const { costOfCapital, stockComp, cashCycle, leverage } = capital;
  const checks: VerdictCheck[] = [];

  const add = (check: VerdictCheck) => checks.push(check);

  /* ---- Core: does the business create value at all ---- */

  add({
    key: "spread",
    question: "התשואה על ההון גבוהה מעלות ההון?",
    passed: costOfCapital.spread === null ? null : costOfCapital.spread > 0,
    detail:
      costOfCapital.spread === null
        ? "לא ניתן לחשב"
        : `מרווח ${costOfCapital.spread > 0 ? "+" : ""}${costOfCapital.spread.toFixed(1)} נקודות אחוז`,
    why: "זו הבדיקה היחידה שאומרת אם צמיחה בכלל שווה משהו. מתחת לעלות ההון, כל דולר שמושקע הורס ערך גם כשההכנסות עולות.",
    core: true,
  });

  const fcfMargin = metricValue(fundamentals, "fcf_margin");
  add({
    key: "fcf",
    question: "העסק מייצר מזומן חופשי?",
    passed: fcfMargin === null ? null : fcfMargin > 0,
    detail: fcfMargin === null ? "לא ניתן לחשב" : `FCF Margin ${fcfMargin.toFixed(1)}%`,
    why: "רווח חשבונאי אפשר לייצר בלי מזומן. תזרים חופשי שלילי לאורך זמן אומר שהעסק תלוי בגיוס.",
    core: true,
  });

  const growth = metricValue(fundamentals, "rev_cagr_3");
  add({
    key: "growth",
    question: "ההכנסות צומחות בשלוש השנים האחרונות?",
    passed: growth === null ? null : growth > 0,
    detail: growth === null ? "לא ניתן לחשב" : `${growth.toFixed(1)}% בשנה`,
    why: "עסק מצטמק יכול להיות זול לנצח. צמיחה היא מה שהופך מכפיל נמוך להזדמנות במקום למלכודת.",
    core: true,
  });

  const netDebtEbitda = metricValue(fundamentals, "net_debt_ebitda");
  add({
    key: "leverage",
    question: "המינוף הפיננסי בשליטה?",
    passed: netDebtEbitda === null ? null : netDebtEbitda < 3,
    detail:
      netDebtEbitda === null
        ? "אין חוב נטו או שלא ניתן לחשב"
        : `חוב נטו / EBITDA ${netDebtEbitda.toFixed(1)}x`,
    why: "מעל פי שלושה, רבעון חלש אחד מצמצם את מרחב התמרון ומייקר כל מיחזור חוב.",
    core: true,
  });

  add({
    key: "dilution",
    question: "בעל המניות לא מדולל?",
    passed:
      stockComp.shareCountChange === null ? null : stockComp.shareCountChange <= 1,
    detail:
      stockComp.shareCountChange === null
        ? "אין די היסטוריה"
        : `ספירת המניות ${stockComp.shareCountChange > 0 ? "+" : "−"}${Math.abs(stockComp.shareCountChange).toFixed(1)}% בשלוש שנים`,
    why: "רווח שגדל ב-10% בזמן שמספר המניות גדל ב-8% הוא רווח שגדל ב-2% עבור מי שכבר מחזיק.",
    core: true,
  });

  const operatingMargin = metricValue(fundamentals, "operating_margin");
  add({
    key: "profitable",
    question: "הפעילות רווחית?",
    passed: operatingMargin === null ? null : operatingMargin > 0,
    detail:
      operatingMargin === null
        ? "לא ניתן לחשב"
        : `מרווח תפעולי ${operatingMargin.toFixed(1)}%`,
    why: "חברה שמפסידה ברמה התפעולית תלויה בשוק ההון כדי להמשיך, וזו תלות שנעלמת בדיוק כשצריך אותה.",
    core: true,
  });

  /* ---- Supporting: quality and timing ---- */

  add({
    key: "operating_leverage",
    question: "הצמיחה החדשה לא פחות רווחית מהקיימת?",
    passed: leverage.turning === null ? null : leverage.turning !== "eroding",
    detail:
      leverage.incrementalMargin === null
        ? "לא ניתן לחשב"
        : `מרווח על ההכנסה השולית ${leverage.incrementalMargin.toFixed(0)}%`,
    why: "המרווח המדווח הוא ממוצע של העבר. המרווח על ההכנסה החדשה הוא מה שהעסק עושה עכשיו.",
    core: false,
  });

  add({
    key: "working_capital",
    question: "הון חוזר לא חונק את הצמיחה?",
    passed: cashCycle.cycle === null ? null : cashCycle.cycle < 120,
    detail:
      cashCycle.cycle === null
        ? "לא ניתן לחשב"
        : `מחזור המרת מזומנים ${cashCycle.cycle.toFixed(0)} ימים`,
    why: "מחזור ארוך אומר שכל שקל של צמיחה דורש מימון לפני שהוא חוזר.",
    core: false,
  });

  if (technical) {
    add({
      key: "stage",
      question: "המחיר לא בשלב של ירידה מתמשכת?",
      passed: technical.stage.stage === null ? null : technical.stage.stage !== 4,
      detail: technical.stage.label,
      why: "שלב 4 הוא השלב שבו נגרם רוב הנזק, ללא קשר לאיכות העסק. גם עסק טוב יכול לרדת חודשים.",
      core: false,
    });

    add({
      key: "template",
      question: "רוב קריטריוני תבנית המגמה מתקיימים?",
      passed:
        technical.template.evaluated === 0
          ? null
          : technical.template.passed / technical.template.evaluated >= 0.6,
      detail: `${technical.template.passed} מתוך ${technical.template.evaluated}`,
      why: "תיאור של מי שקנה ומי שמכר עד כה. לא תחזית, אבל כן מדד לכך שהשוק מסכים עם הקריאה הפונדמנטלית.",
      core: false,
    });
  }

  /* ---- Valuation, when there is a sector to compare against ---- */

  if (sector) {
    const pe = metricValue(fundamentals, "pe");
    const median = sector.medians.pe;
    const premium =
      pe !== null && median != null && median > 0
        ? ((pe - median) / median) * 100
        : null;

    add({
      key: "valuation",
      question: "התמחור אינו בפרמיה קיצונית על הסקטור?",
      passed: premium === null ? null : premium < 60,
      detail:
        premium === null
          ? "אין מכפיל רווח להשוואה"
          : `P/E ${pe!.toFixed(1)} מול חציון ${median!.toFixed(1)} (${premium > 0 ? "+" : ""}${premium.toFixed(0)}%)`,
      why: "פרמיה אינה בעיה כשהצמיחה והתשואה על ההון מצדיקות אותה. פרמיה קיצונית אומרת שהרבה מאוד כבר מתומחר, וכל אכזבה יקרה.",
      core: false,
    });
  }

  /* ---- Tally ---- */

  const evaluated = checks.filter((c) => c.passed !== null);
  const passed = evaluated.filter((c) => c.passed).length;
  const coreChecks = evaluated.filter((c) => c.core);
  const corePassed = coreChecks.filter((c) => c.passed).length;
  const coreFailed = coreChecks.length - corePassed;

  let stance: Verdict["stance"];
  if (coreChecks.length < 3) stance = "unknown";
  else if (coreFailed >= 2) stance = "fails";
  else if (coreFailed === 0 && passed / evaluated.length >= 0.7) stance = "passes";
  else stance = "mixed";

  /* ---- The sentence ---- */

  const blockers = evaluated
    .filter((c) => c.passed === false)
    .map((c) => `${c.question.replace(/\?$/, "")} — ${c.detail}`);

  const reasonsFor = evaluated
    .filter((c) => c.passed === true && c.core)
    .map((c) => `${c.question.replace(/\?$/, "")}: ${c.detail}`);

  let headline: string;
  if (stance === "unknown") {
    headline = `${companyName}: אין די נתונים מדווחים כדי להכריע. ${coreChecks.length} מתוך 6 בדיקות הליבה ניתנות לחישוב בלבד.`;
  } else if (stance === "passes") {
    headline = `${companyName} עוברת ${passed} מתוך ${evaluated.length} הבדיקות, כולל כל בדיקות הליבה.${
      blockers.length > 0 ? ` מה שלא עבר: ${blockers.length} בדיקות משניות.` : ""
    }`;
  } else if (stance === "fails") {
    headline = `${companyName} נכשלת ב-${coreFailed} מבדיקות הליבה. זו לא שאלה של תזמון — זו שאלה על העסק עצמו.`;
  } else {
    headline = `${companyName} עוברת ${passed} מתוך ${evaluated.length}. ${
      coreFailed > 0
        ? `בדיקת ליבה אחת נכשלת, וזה מה שמכריע כאן.`
        : `בדיקות הליבה עוברות, והמכשולים הם משניים.`
    }`;
  }

  /* ---- What would make this wrong ---- */

  const falsification =
    stance === "passes" || stance === "mixed"
      ? `הקריאה הזו מניחה שהרבעונים הבאים ימשיכו את המגמה בדוחות. היא תתברר כשגויה אם ${
          costOfCapital.spread !== null && costOfCapital.spread > 0
            ? "המרווח על ההון יצטמצם — בגלל תחרות שתשחק מרווחים או השקעה הונית שלא תחזיר את עצמה"
            : "הרווחיות לא תחזור"
        }, אם הצמיחה תיעצר לפני שהמכפיל הנוכחי מוצדק, או אם יתברר שמה שהשוק כבר מתמחר גדול ממה שהחברה יכולה לספק. שלושת הדברים האלה לא מופיעים באף מספר בעמוד הזה — כולם נמצאים בעתיד.`
      : `כדי שהקריאה השלילית תתברר כשגויה, צריך לראות היפוך במה שנכשל: ${
          blockers[0] ?? "בדיקות הליבה"
        }. שינוי בדוח אחד אינו מגמה; שניים רצופים כבר כן.`;

  return {
    checks,
    passed,
    evaluated: evaluated.length,
    corePassed,
    coreEvaluated: coreChecks.length,
    stance,
    headline,
    reasonsFor,
    blockers,
    falsification,
    caveat:
      "זו תוצאה של רשימת בדיקות, לא המלצה. האתר לא יודע מה יש לך בתיק, לכמה זמן אתה משקיע, מה מצב המס שלך ומה תעשה אם המניה תרד 30% בחודש הבא — וארבעת הדברים האלה משנים את התשובה יותר מכל מספר כאן.",
  };
}

export { STANCE_LABEL };
