/**
 * The expectation gap.
 *
 * A multiple is not a fact about a company — it is a sentence about the
 * future written in one number. A stock at 40x while its sector trades at
 * 22x is a statement that this business will do something the others will
 * not. That statement is testable, and almost nobody tests it.
 *
 * So this puts two things side by side:
 *
 *   what the price implies   the premium or discount against the sector,
 *                            and therefore what has to be true
 *   what was delivered       the growth and returns the filings actually
 *                            report, against the same peer set
 *
 * When those disagree, the disagreement is the finding — in both
 * directions. A company priced at a premium it is not delivering is the
 * obvious case; a company delivering more than its discount implies is the
 * same measurement with the sign flipped, and it is the more interesting
 * one.
 *
 * The earnings record sits underneath because it answers a different
 * question: not "what does the market expect of the business" but "how
 * well does the market predict this company at all". A company that beat
 * every quarter is one whose estimates are set low; a company that missed
 * repeatedly is one where the estimate is worth less than usual.
 *
 * Nothing here is a forecast, and nothing here is a target. Every figure
 * is either measured from a filing or arithmetic on two measured figures.
 */

import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { SectorContext } from "@/lib/fundamentals-store";
import type { EarningsSurprise } from "@/lib/sources/finnhub";

export type GapSide = {
  label: string;
  figure: string;
  body: string;
};

export type ExpectationGap = {
  /** One sentence: what the price is saying. */
  headline: string;
  /** Which way the gap runs, or that there is none worth naming. */
  direction: "priced-above-delivery" | "priced-below-delivery" | "aligned" | "unknown";
  market: GapSide[];
  delivered: GapSide[];
  /** What would close the gap, in either direction. */
  wouldClose: string[];
  /** Beat/miss record, when there is one. */
  record: {
    beats: number;
    misses: number;
    quarters: number;
    note: string;
  } | null;
  caveat: string;
};

function metricOf(fundamentals: Fundamentals, key: string): number | null {
  for (const group of fundamentals.groups) {
    const found = group.metrics.find((metric) => metric.key === key);
    if (found && found.value !== null && Number.isFinite(found.value)) {
      return found.value;
    }
  }
  return null;
}

const pct = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

/** Below this, a premium is inside the noise of how the median was built
 *  from a handful of peers. */
const MEANINGFUL_PREMIUM = 12;

export function buildExpectationGap({
  companyName,
  fundamentals,
  sector,
  surprises,
}: {
  companyName: string;
  fundamentals: Fundamentals;
  sector: SectorContext | null;
  surprises: EarningsSurprise[];
}): ExpectationGap | null {
  const pe = metricOf(fundamentals, "pe");
  const ps = metricOf(fundamentals, "ps");
  const growth = metricOf(fundamentals, "rev_cagr_3");
  const profitGrowth = metricOf(fundamentals, "op_cagr_3");
  const margin = metricOf(fundamentals, "operating_margin");
  const roic = metricOf(fundamentals, "roic");

  /* ---- The earnings record, which stands on its own ---- */
  const reported = surprises.filter(
    (row) =>
      row.estimate !== null &&
      row.actual !== null &&
      Number.isFinite(row.estimate) &&
      Number.isFinite(row.actual),
  );

  const beats = reported.filter((row) => row.actual! > row.estimate!).length;
  const misses = reported.filter((row) => row.actual! < row.estimate!).length;

  const record =
    reported.length > 0
      ? {
          beats,
          misses,
          quarters: reported.length,
          note:
            beats === reported.length
              ? "היכתה את התחזית בכל רבעון שנמדד. זה אומר גם משהו על החברה וגם משהו על התחזיות — הנחיה שמרנית מייצרת רצף הכאות."
              : misses === reported.length
                ? "פספסה את התחזית בכל רבעון שנמדד. כשזה קורה ברצף, ההערכה של השוק לגבי החברה הזאת שווה פחות מהרגיל."
                : `${beats} הכאות ו-${misses} פספוסים ב-${reported.length} הרבעונים שנמדדו.`,
        }
      : null;

  const usingEarnings = pe !== null && pe > 0;
  const multiple = usingEarnings ? pe : ps;
  const multipleName = usingEarnings ? "P/E" : "P/S";
  const median =
    (usingEarnings ? sector?.medians?.pe : sector?.medians?.ps) ?? null;

  /* Without a peer median there is no expectation to measure against, and
     inventing one from the whole market would compare a bank to a
     chipmaker. The record is still worth returning on its own. */
  if (multiple === null || median === null || median <= 0) {
    if (!record) return null;

    return {
      headline: `אין חציון סקטור ל${companyName} באתר, ולכן אי אפשר למדוד מה המחיר מגלם ביחס לעמיתים.`,
      direction: "unknown",
      market: [],
      delivered: [],
      wouldClose: [],
      record,
      caveat:
        "פער ציפיות נמדד תמיד מול קבוצת השוואה. בלי קבוצה כזאת המספר היחיד שנשאר הוא המכפיל עצמו, והוא לא אומר כלום לבדו.",
    };
  }

  const premium = ((multiple - median) / median) * 100;

  const medianGrowth = sector?.medians?.rev_cagr_3 ?? null;
  const medianRoic = sector?.medians?.roic ?? null;
  const medianMargin = sector?.medians?.operating_margin ?? null;

  const growthGap =
    growth !== null && medianGrowth !== null ? growth - medianGrowth : null;

  /* ---- Which way does it run ---- */
  let direction: ExpectationGap["direction"] = "aligned";
  if (Math.abs(premium) >= MEANINGFUL_PREMIUM) {
    const deliveringMore =
      (growthGap !== null && growthGap > 0) ||
      (roic !== null && medianRoic !== null && roic > medianRoic);

    if (premium > 0) {
      direction = deliveringMore ? "aligned" : "priced-above-delivery";
    } else {
      direction = deliveringMore ? "priced-below-delivery" : "aligned";
    }
  }

  const headline =
    direction === "priced-above-delivery"
      ? `המחיר מגלם ${pct(premium)} מעל חציון הסקטור, והנתונים שדווחו אינם מראים ביצועים שמצדיקים את הפער.`
      : direction === "priced-below-delivery"
        ? `המחיר מגלם ${pct(premium)} מול חציון הסקטור, בזמן שהחברה מדווחת ביצועים טובים מהעמיתים שלה.`
        : Math.abs(premium) < MEANINGFUL_PREMIUM
          ? `המחיר קרוב לחציון הסקטור (${pct(premium)}). השוק אינו מתמחר את החברה הזאת כשונה מהעמיתים שלה.`
          : `המחיר מגלם ${pct(premium)} מול חציון הסקטור, והביצועים שדווחו הולכים לאותו כיוון.`;

  /* ---- What the price is saying ---- */
  const market: GapSide[] = [
    {
      label: `פרמיה על מכפיל ${multipleName}`,
      figure: pct(premium, 0),
      body: `${multiple.toFixed(1)}x מול חציון ${median.toFixed(1)}x ב${sector?.label ?? "סקטור"} (${sector?.peerCount ?? 0} חברות). כל פרמיה היא משפט על העתיד: היא אומרת שהחברה תעשה משהו שהעמיתים לא יעשו.`,
    },
  ];

  if (medianGrowth !== null) {
    market.push({
      label: "הצמיחה שהפרמיה דורשת",
      figure: `מעל ${medianGrowth.toFixed(1)}%`,
      body:
        premium > 0
          ? `כדי שמכפיל גבוה מהחציון יחזיק, הצמיחה צריכה להיות גבוהה מחציון הסקטור — ${medianGrowth.toFixed(1)}% לשנה — ולהישאר שם.`
          : `בחציון של ${medianGrowth.toFixed(1)}% לשנה, מכפיל מתחת לחציון מגלם ציפייה שהחברה תפגר אחרי הקבוצה.`,
    });
  }

  if (!usingEarnings) {
    market.push({
      label: "שים לב",
      figure: "P/S",
      body: "החברה אינה רווחית כרגע, ולכן הפרמיה נמדדת על מכפיל מכירות — מדד גס שאינו מבחין בין הכנסה רווחית להכנסה מפסידה.",
    });
  }

  /* ---- What was delivered ---- */
  const delivered: GapSide[] = [];

  if (growth !== null) {
    delivered.push({
      label: "צמיחת הכנסות בפועל (3ש׳)",
      figure: `${growth.toFixed(1)}%`,
      body:
        medianGrowth !== null
          ? `מול חציון ${medianGrowth.toFixed(1)}% — פער של ${pct(growthGap ?? 0)} נקודות. זה הנתון שהפרמיה נשענת עליו יותר מכל אחר.`
          : "אין חציון להשוות אליו בסקטור הזה.",
    });
  }

  if (profitGrowth !== null) {
    delivered.push({
      label: "צמיחת רווח תפעולי (3ש׳)",
      figure: `${profitGrowth.toFixed(1)}%`,
      body:
        growth !== null && profitGrowth > growth
          ? "הרווח צומח מהר מההכנסות — כלומר המרווח מתרחב, וזה בדיוק מה שמצדיק מכפיל גבוה."
          : growth !== null && profitGrowth < growth
            ? "הרווח צומח לאט מההכנסות — המרווח נשחק, וצמיחה שנקנית במרווח שווה פחות."
            : "צמיחת הרווח התפעולי, כפי שדווחה בדוחות.",
    });
  }

  if (roic !== null) {
    delivered.push({
      label: "ROIC",
      figure: `${roic.toFixed(1)}%`,
      body:
        medianRoic !== null
          ? `מול חציון ${medianRoic.toFixed(1)}% בסקטור. תשואה גבוהה על ההון היא ההצדקה העמידה ביותר לפרמיה, כי היא אומרת שכל שקל שמושקע מחזיר יותר.`
          : "אין חציון ROIC לסקטור הזה — בפיננסים ובאנרגיה הוא לא מחושב באותו אופן.",
    });
  }

  if (margin !== null && medianMargin !== null) {
    delivered.push({
      label: "מרווח תפעולי",
      figure: `${margin.toFixed(1)}%`,
      body: `מול חציון ${medianMargin.toFixed(1)}%. מרווח גבוה מהעמיתים הוא סימן לכוח תמחור, וכוח תמחור הוא מה שמחזיק פרמיה לאורך זמן.`,
    });
  }

  /* ---- What would close it ---- */
  const wouldClose: string[] = [];

  if (direction === "priced-above-delivery") {
    wouldClose.push(
      `האצה בצמיחה מעל ${medianGrowth !== null ? `${medianGrowth.toFixed(1)}%` : "חציון הסקטור"} — זה היה הופך את הפרמיה למוצדקת במקום לדרוש הצדקה.`,
      "התרחבות מרווח, שמראה שהצמיחה מגיעה עם כוח תמחור ולא בקנייה של נתח שוק.",
      "ולחלופין: ירידת מחיר שמחזירה את המכפיל לחציון, בלי ששום דבר בעסק השתנה.",
    );
  } else if (direction === "priced-below-delivery") {
    wouldClose.push(
      "רבעון שמאשר שהביצועים אינם חד-פעמיים — הדיסקאונט לרוב משקף ספק בהמשכיות ולא בתוצאה עצמה.",
      "הסרה של הסיבה לדיסקאונט: רגולציה, תלות בלקוח בודד, או מאזן — כל אחת מהן נמדדת בעמוד בנפרד.",
    );
  } else {
    wouldClose.push(
      "שינוי בכיוון הצמיחה או במרווח — אלה שני המדדים שמזיזים מכפיל מול הסקטור.",
      "שינוי בחציון עצמו: כשהסקטור כולו מתומחר מחדש, המספר הזה זז בלי שהחברה עשתה דבר.",
    );
  }

  return {
    headline,
    direction,
    market,
    delivered,
    wouldClose,
    record,
    caveat:
      "הפרמיה נמדדת מול חציון של קומץ חברות ביקום האתר, לא מול הסקטור כולו בשוק. היא מתארת מה המחיר מגלם — לא אם הוא צודק.",
  };
}
