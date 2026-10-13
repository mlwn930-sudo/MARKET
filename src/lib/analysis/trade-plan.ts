import type { PriceLevel } from "@/lib/metrics/levels";
import type { ConditionCite } from "@/lib/analysis/stance";

/**
 * Where the idea is wrong, in price, on any chart.
 *
 * THE REFUSAL THIS REPLACES WAS TOO BROAD, and the owner was right to
 * push on it. "The site does not measure entries or stops" was treated
 * as one rule covering three things, and only one of the three was
 * actually uncomputable:
 *
 *   - An ENTRY REFERENCE is the last close and the bands around it.
 *     Both are measured. Refusing to print them was refusing to repeat
 *     numbers already on the page.
 *   - A STOP is a distance. The site measures the bands price has
 *     actually turned at and the average true range, and `riskLevels`
 *     has computed exactly this since it was written — behind a VCP
 *     pivot, which most charts do not have, so it never arrived.
 *   - POSITION SIZE genuinely needs something the site does not have:
 *     how much the reader is willing to lose. That one stays missing,
 *     and is named rather than guessed.
 *
 * AND ONE THING ONLY THIS SITE CAN SAY ABOUT A STOP. Every chart tool
 * will draw a stop under a level. None of them can tell you whether a
 * stop that tight would have survived — that needs the drawdown *during*
 * the historical windows the rate was counted over, which is exactly
 * what `medianAdversePct` and `worstPct` are. A stop inside the typical
 * excursion of the very condition the direction rests on would have been
 * hit in more than half of the cases that produced the rate. That is a
 * measurement, it is the most useful sentence available about a stop,
 * and the site was sitting on it.
 *
 * NOTHING HERE IS A RECOMMENDATION TO BUY. It is the arithmetic of being
 * wrong, stated before anything about being right — which is the order
 * `riskLevels` already insisted on, and the reason targets below are
 * multiples of the risk rather than numbers chosen first.
 */

/** Past this, a stop is not protection — it is a different position.
 *  The same ceiling `riskLevels` uses, so the two cannot disagree. */
const MAX_RISK_PERCENT = 8;

/** How far below a support band the stop sits, so an ordinary wick
 *  through the band does not take the position out. A fraction of the
 *  band's own width rather than a fixed percentage: a band on a quiet
 *  stock and one on a volatile stock are not the same distance. */
const BAND_BUFFER_ATR = 0.5;

export type TradePlan = {
  /** What a position would be opened against. The last daily close,
   *  stated as such — not a live price. */
  reference: number;
  asOf: string;
  /** The nearest measured band below and above, when there is one. */
  supportBelow: PriceLevel | null;
  resistanceAbove: PriceLevel | null;
  stop: number;
  stopReason: string;
  riskPercent: number;
  /**
   * Whether that stop sits outside the typical path of the condition
   * the direction rests on. Null when no counted condition fired, or
   * when the stored file predates the excursion fields.
   */
  survival: {
    medianAdversePct: number;
    worstPct: number;
    /** True when the stop is wider than the median excursion. */
    clearsMedian: boolean;
    clearsWorst: boolean;
    note: string;
  } | null;
  /** Multiples of the risk, which is the only honest way to name a
   *  target: nothing here measured where price is going. */
  targets: { multiple: number; price: number }[];
  /** The condition's own median move, as a measured alternative to the
   *  multiples above. Null when nothing counted fired. */
  measuredMove: { percent: number; price: number } | null;
  /** Said out loud rather than approximated. */
  sizing: string;
};

export function buildTradePlan(input: {
  lastClose: number;
  asOf: string;
  levels: PriceLevel[];
  /** Average true range in price, from the same candles. */
  atr: number | null;
  /** The condition the direction rests on, when one fired. */
  lead: ConditionCite | null;
}): TradePlan | null {
  const { lastClose, asOf, levels, atr, lead } = input;
  if (!(lastClose > 0)) return null;

  const below = levels
    .filter((l) => l.price < lastClose)
    .sort((a, b) => b.price - a.price);
  const above = levels
    .filter((l) => l.price > lastClose)
    .sort((a, b) => a.price - b.price);

  const supportBelow = below[0] ?? null;
  const resistanceAbove = above[0] ?? null;

  /* The stop comes from the structure when the structure offers one
     inside the ceiling, and from volatility when it does not. Never
     from a round number, and never from how much the reader would like
     to risk — that is the arithmetic running backwards. */
  const floor = lastClose * (1 - MAX_RISK_PERCENT / 100);
  const buffer = atr !== null ? atr * BAND_BUFFER_ATR : lastClose * 0.005;

  let stop: number;
  let stopReason: string;

  const fromBand = supportBelow ? supportBelow.price - buffer : null;

  if (fromBand !== null && fromBand > floor) {
    stop = fromBand;
    stopReason =
      `מתחת לרמה ב-${supportBelow!.price.toFixed(2)}, שהמחיר הסתובב בה ` +
      `${supportBelow!.touches} פעמים והחזיקה ב-${supportBelow!.held} מתוך ` +
      `${supportBelow!.held + supportBelow!.broke} המפגשים` +
      (atr !== null ? ", עם מרווח של חצי טווח יומי ממוצע" : "");
  } else if (atr !== null && lastClose - atr * 2 > floor) {
    stop = lastClose - atr * 2;
    stopReason =
      "שני טווחים יומיים ממוצעים מתחת לסגירה. אין רמה נמדדת קרובה מספיק " +
      "שתחזיק סטופ בלי לחרוג מהתקרה.";
  } else {
    stop = floor;
    stopReason =
      `תקרת הסיכון של ${MAX_RISK_PERCENT}%. הרמה הנמדדת הקרובה רחוקה מדי, ` +
      "וסטופ רחב מזה הוא כבר פוזיציה אחרת ולא הגנה.";
  }

  const riskPercent = ((lastClose - stop) / lastClose) * 100;
  const risk = lastClose - stop;

  /* The one thing a chart tool cannot tell you. */
  let survival: TradePlan["survival"] = null;
  if (lead && lead.medianAdversePct !== null) {
    const median = Math.abs(lead.medianAdversePct);
    const worst = Math.abs(lead.worstPct);
    const clearsMedian = riskPercent > median;
    const clearsWorst = riskPercent > worst;
    survival = {
      medianAdversePct: lead.medianAdversePct,
      worstPct: lead.worstPct,
      clearsMedian,
      clearsWorst,
      note: clearsMedian
        ? `הסטופ רחב מהירידה החציונית בדרך (${median.toFixed(1)}%) של ` +
          `${lead.label}, כך שבמחצית מהמקרים שהפיקו את השיעור הוא לא היה ` +
          `נפגע. המקרה הגרוע שם היה ${worst.toFixed(1)}%` +
          (clearsWorst ? ", וגם אותו הוא עובר." : ", והוא כן היה פוגע בו.")
        : `הסטופ צר מהירידה החציונית בדרך (${median.toFixed(1)}%) של ` +
          `${lead.label}. כלומר ביותר ממחצית המקרים שמהם נספר השיעור של ` +
          `${Math.round(lead.upShareHist * 100)}%, פוזיציה עם הסטופ הזה ` +
          "הייתה נסגרת לפני שהאופק נגמר — גם במקרים שהסתיימו גבוה יותר.",
    };
  }

  return {
    reference: lastClose,
    asOf,
    supportBelow,
    resistanceAbove,
    stop,
    stopReason,
    riskPercent,
    survival,
    /* Multiples of the risk, not prices anybody measured. The site did
       not measure where price is going, and a target that is not a
       multiple of the risk is a number chosen first with the risk
       backed into it afterwards. */
    targets: [1, 2, 3].map((multiple) => ({
      multiple,
      price: lastClose + risk * multiple,
    })),
    measuredMove:
      lead && Number.isFinite(lead.medianPct)
        ? {
            percent: lead.medianPct,
            price: lastClose * (1 + lead.medianPct / 100),
          }
        : null,
    /* The one input the site genuinely does not have, named instead of
       guessed. The arithmetic is trivial and the missing number is not
       on the chart — it is how much this reader is willing to lose. */
    sizing:
      `גודל הפוזיציה אינו נגזר מהגרף. הנוסחה היא: הסכום שאתה מוכן להפסיד ` +
      `בעסקה הזאת, חלקי ${(lastClose - stop).toFixed(2)} — המרחק לסטופ ` +
      `במונחי מחיר. האתר לא יודע את המספר הראשון, ולכן לא יחשב את התוצאה.`,
  };
}
