/**
 * What the chart is saying, in words.
 *
 * A candlestick chart with four moving averages on it is a precise picture
 * that most readers cannot read. They can see that the line goes up; they
 * cannot see that the price is seven percent above a rising 150-day average
 * while volume dried up for three weeks, which is the part that carries
 * information.
 *
 * So the same numbers the chart is drawn from are also written out. Not a
 * summary of the picture — a reading of it, one observation per idea, each
 * one naming the measurement behind it. A reader who disagrees can look at
 * the chart and check.
 *
 * Nothing here predicts. "The price is above a rising average" is an
 * observation; "the price will continue" is not, and does not appear.
 */

import type { TechnicalRead } from "@/lib/metrics/technical";

export type ChartObservation = {
  /** Four to six words. The idea. */
  title: string;
  /** One or two sentences: what was measured, and what it means. */
  body: string;
  /** The figure it rests on, already formatted. Shown beside the text so
   *  the claim and its evidence cannot drift apart. */
  figure: string | null;
};

export type ChartReading = {
  /** The one sentence version, for the top of the panel. */
  headline: string;
  observations: ChartObservation[];
  /** What this reading cannot tell you. Always present. */
  limits: string[];
};

const pct = (value: number | null | undefined, digits = 1): string =>
  value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

export function readChart(
  technical: TechnicalRead | null,
  { rangeLabel }: { rangeLabel: string },
): ChartReading | null {
  if (!technical) return null;

  const observations: ChartObservation[] = [];
  const { stage, trend, relative, volume, vcp, template, risk, rsi } = technical;

  /* ---- Where in the cycle ---- */
  if (stage.stage !== null) {
    observations.push({
      title: `שלב ${stage.stage} — ${stage.label}`,
      body:
        `${stage.note} ` +
        (stage.daysInStage !== null
          ? `המצב הזה מחזיק ${stage.daysInStage} ימי מסחר.`
          : ""),
      figure:
        stage.daysInStage !== null ? `${stage.daysInStage} ימים` : null,
    });
  }

  /* ---- The average everything is measured against ---- */
  if (trend.vsAveragePercent !== null) {
    const direction =
      trend.averageDirection === "rising"
        ? "עולה"
        : trend.averageDirection === "falling"
          ? "יורדת"
          : "שטוחה";

    observations.push({
      title: "המחיר מול הממוצע ל-200 יום",
      body:
        `המחיר נמצא ${pct(trend.vsAveragePercent)} מהממוצע הנע ל-200 יום, ` +
        `והממוצע עצמו במגמה ${direction}. שני הדברים נמדדים בנפרד ויכולים לא ` +
        `להסכים: מחיר מעל ממוצע יורד הוא ריבאונד בתוך מגמה שלילית, לא היפוך.`,
      figure: pct(trend.vsAveragePercent),
    });
  }

  /* ---- Position in the year ---- */
  if (trend.fromHighPercent !== null || trend.fromLowPercent !== null) {
    observations.push({
      title: "איפה זה יושב בשנה",
      body:
        `${trend.fromHighPercent !== null ? `${pct(trend.fromHighPercent)} מהשיא של 52 שבועות` : ""}` +
        `${trend.fromHighPercent !== null && trend.fromLowPercent !== null ? " · " : ""}` +
        `${trend.fromLowPercent !== null ? `${pct(trend.fromLowPercent)} מהשפל` : ""}. ` +
        `מניה שנסחקת קרוב לשיא ומניה שקפצה מהשפל נראות דומה בגרף קצר, והן ` +
        `שני מצבים שונים לגמרי.`,
      figure:
        trend.fromHighPercent !== null ? pct(trend.fromHighPercent) : null,
    });
  }

  /* ---- Against the index ---- */
  if (relative) {
    observations.push({
      title: "מול S&P 500",
      body:
        `תשואה עודפת של ${pct(relative.oneMonth)} בחודש, ${pct(relative.threeMonth)} ` +
        `בשלושה חודשים ו-${pct(relative.sixMonth)} בחצי שנה. ` +
        (relative.consistent
          ? "החברה מכה את המדד בכל אחד מהחלונות שנמדדו — זה מה שמבדיל כוח יחסי אמיתי מחודש טוב אחד."
          : "החלונות לא מסכימים זה עם זה, כלומר אין כאן כוח יחסי עקבי אלא תקופה טובה בודדת."),
      figure: pct(relative.sixMonth),
    });
  }

  /* ---- Volume: the part nobody reads ---- */
  if (volume.ratio !== null) {
    observations.push({
      title: "מה המחזורים אומרים",
      body:
        `${volume.note} המחזור האחרון עומד על ${(volume.ratio * 100).toFixed(0)}% ` +
        `מהממוצע הארוך. מחזור הוא מי נמצא בצד השני של העסקה: ירידה במחזור דליל ` +
        `היא היעדר קונים, ירידה במחזור כבד היא מוכר שיוצא.`,
      figure: `${(volume.ratio * 100).toFixed(0)}%`,
    });
  }

  /* ---- The setup, when there is one ---- */
  if (vcp.contractions.length > 0) {
    observations.push({
      title: "מבנה התכווצות",
      body:
        `זוהו ${vcp.contractions.length} התכווצויות טווח רצופות${vcp.pivot !== null ? `, עם נקודת ציר סביב ${vcp.pivot.toFixed(2)}` : ""}. ` +
        `התכווצות אומרת שהטווח היומי נעשה צר יותר — פחות מחלוקת בין קונים ` +
        `למוכרים. זה תיאור של מה שקרה, לא הבטחה למה שיקרה אחריו.`,
      figure: vcp.pivot !== null ? vcp.pivot.toFixed(2) : null,
    });
  }

  /* ---- Where the framework puts the line ---- */
  if (risk) {
    observations.push({
      title: "הרמה שהמסגרת מסמנת",
      body:
        `${risk.stopReason} מרחק של ${risk.riskPercent.toFixed(1)}% מהמחיר הנוכחי. ` +
        `זו רמה שנגזרת מהמבנה בגרף ומהתנודתיות, לא המלצה ולא הוראה — היא ` +
        `מראה כמה מקום המבנה נותן לפני שהוא מפסיק להיות תקף.`,
      figure: `${risk.riskPercent.toFixed(1)}%`,
    });
  }

  if (rsi !== null) {
    observations.push({
      title: "RSI",
      body:
        `${rsi.toFixed(0)} בסולם של 14 יום. מעל 70 נהוג לקרוא לזה קנוי יתר ומתחת ל-30 ` +
        `מכור יתר, אבל במגמה חזקה RSI נשאר גבוה חודשים — לכן הוא נקרא כאן כהקשר ולא כאות.`,
      figure: rsi.toFixed(0),
    });
  }

  const limits = [
    "הגרף מתאר מה המחיר כבר עשה. הוא אינו אומר מה החברה שווה — לשאלה הזאת יש מדדים נפרדים בעמוד.",
    `הקריאה הזאת מחושבת על נתונים יומיים, ואינה משתנה לפי הטווח שנבחר בגרף (${rangeLabel}).`,
  ];

  if (template.evaluated > 0) {
    limits.push(
      `תבנית המגמה עוברת ${template.passed} מתוך ${template.evaluated} קריטריונים שניתן היה לבדוק (מתוך ${template.total}). ` +
        "הקריטריון של דירוג הכוח היחסי הוא תחליף: המקור דורש דירוג מול כל השוק, וכאן מחושבת תשואה עודפת מול S&P 500 בלבד.",
    );
  }

  return {
    headline: technical.headline,
    observations,
    limits,
  };
}
