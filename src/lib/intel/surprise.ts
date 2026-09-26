import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { SectorContext } from "@/lib/fundamentals-store";
import type { EarningsSurprise } from "@/lib/sources/finnhub";
import type { Grade, GradedClaim } from "./confidence";

/**
 * What the market expects, and what would surprise it.
 *
 * The expectation gap already answers the first half — what the price
 * implies against what the filings delivered. The half that was missing is
 * the one a reader can actually act on: given that the market expects
 * *this*, what specific, measurable thing would it not expect?
 *
 * That question is worth asking because it is falsifiable. "The stock is
 * expensive" is an opinion nobody can check. "The premium over the sector
 * implies earnings growing 12% a year faster than peers for three years,
 * and the last three years delivered 4% faster" is a claim with a number
 * attached, and next quarter either moves it or does not.
 *
 * **The arithmetic here is an identity, not a forecast.** If a multiple
 * sits 38% above the sector median, then for it to converge to that median
 * without the price falling, earnings have to grow 38% more than the
 * sector's over the period. That is algebra. What it is *not* is a
 * prediction that either will happen — and every assumption the algebra
 * rests on is printed beside the result, because rule 9 of this project
 * says a number built on hidden assumptions is a guess with a decimal
 * point.
 */

export type Expectation = {
  label: string;
  /** The figure. Always present — an expectation without one is a mood. */
  figure: string;
  body: string;
};

export type Surprise = {
  direction: "up" | "down";
  /** What would have to happen. Written as something observable. */
  trigger: string;
  /** Where the measurement stands today. */
  measuredNow: string;
  /** The level at which it stops being expected. */
  threshold: string;
  /** What it would change. */
  why: string;
  grade: Grade;
};

export type ExpectationEngine = {
  headline: string;
  expects: Expectation[];
  surprises: Surprise[];
  /** Every assumption the arithmetic rests on, printed. */
  assumptions: string[];
  claim: GradedClaim;
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

/** The horizon the convergence arithmetic is run over. Three years,
 *  stated: it is the same window the site's revenue CAGR uses, so the
 *  required growth and the delivered growth are measured over the same
 *  length of time and can be put side by side honestly. */
const HORIZON_YEARS = 3;

/** Below this a premium is inside the noise of a median built from a
 *  handful of peers. Matches `expectation-gap.ts` on purpose — two
 *  thresholds for one idea is how two pages start disagreeing. */
const MEANINGFUL_PREMIUM = 12;

export function buildExpectationEngine({
  companyName,
  fundamentals,
  sector,
  surprises: earningsSurprises,
}: {
  companyName: string;
  fundamentals: Fundamentals;
  sector: SectorContext | null;
  surprises: EarningsSurprise[];
}): ExpectationEngine | null {
  const pe = metricOf(fundamentals, "pe");
  const ps = metricOf(fundamentals, "ps");
  const growth = metricOf(fundamentals, "rev_cagr_3");
  const margin = metricOf(fundamentals, "operating_margin");
  const roic = metricOf(fundamentals, "roic");

  const usingEarnings = pe !== null && pe > 0;
  const multiple = usingEarnings ? pe : ps;
  const multipleName = usingEarnings ? "P/E" : "P/S";
  const median =
    (usingEarnings ? sector?.medians?.pe : sector?.medians?.ps) ?? null;

  if (multiple === null || median === null || median <= 0) return null;

  const premium = ((multiple - median) / median) * 100;

  const medianGrowth = sector?.medians?.rev_cagr_3 ?? null;
  const medianMargin = sector?.medians?.operating_margin ?? null;
  const medianRoic = sector?.medians?.roic ?? null;

  /* ---- The identity ----
     For a multiple standing p above the median to reach that median with
     the price unchanged, the denominator has to grow by p. Spread over the
     horizon, that is the annual rate below. Nothing here forecasts
     anything; it converts one number into another. */
  const ratio = multiple / median;
  const requiredAnnual =
    ratio > 0 ? (Math.pow(ratio, 1 / HORIZON_YEARS) - 1) * 100 : null;

  const deliveredExcess =
    growth !== null && medianGrowth !== null ? growth - medianGrowth : null;

  const expects: Expectation[] = [];

  expects.push({
    label: `${multipleName} מול חציון הסקטור`,
    figure: `${multiple.toFixed(1)}x מול ${median.toFixed(1)}x · ${pct(premium)}`,
    body:
      Math.abs(premium) < MEANINGFUL_PREMIUM
        ? `השוק אינו מתמחר את ${companyName} כשונה מהעמיתים שלה. במצב כזה אין ציפייה מיוחדת לאשש או להפריך.`
        : premium > 0
          ? `השוק מוכן לשלם יותר על כל דולר של ${usingEarnings ? "רווח" : "הכנסה"} כאן מאשר על אותו דולר אצל העמיתים. זו הציפייה — וכל השאר הוא מה שצריך לקרות כדי שהיא תתממש.`
          : `השוק משלם פחות על כל דולר כאן מאשר אצל העמיתים, כלומר הוא מגלם שמשהו בעסק הזה גרוע יותר או פחות בטוח.`,
  });

  if (requiredAnnual !== null && Math.abs(premium) >= MEANINGFUL_PREMIUM) {
    /* The same identity reads in opposite directions and needs opposite
       words. At a premium it says what the company has to deliver to grow
       into the multiple; at a discount it says how much *worse* than
       peers the market is implying, and calling that "the growth the
       premium implies" — with a minus sign in front — is a sentence that
       reads backwards. */
    const atPremium = premium > 0;

    expects.push({
      label: atPremium
        ? `הצמיחה העודפת שהפרמיה מגלמת (${HORIZON_YEARS} שנים)`
        : `הפיגור שהדיסקאונט מגלם (${HORIZON_YEARS} שנים)`,
      figure: `${pct(requiredAnnual)} בשנה מול הסקטור`,
      body: atPremium
        ? `כדי שהמכפיל יתכנס לחציון הסקטור בלי שהמחיר ירד, ה${usingEarnings ? "רווח" : "הכנסה"} צריך לצמוח בקצב הזה מעבר לקצב הסקטור. זו זהות אריתמטית, לא תחזית — היא מתרגמת את הפרמיה לקצב, ולא אומרת שהקצב יושג.`
        : `מכפיל מתחת לחציון שקול לציפייה שה${usingEarnings ? "רווח" : "הכנסה"} יפגר אחרי הסקטור בקצב הזה. זו זהות אריתמטית, לא תחזית — וכשהביצוע בפועל הפוך ממנה, הפער בין השתיים הוא הממצא.`,
    });
  }

  if (deliveredExcess !== null) {
    expects.push({
      label: "הצמיחה העודפת שכבר נמסרה",
      figure: `${pct(deliveredExcess)} בשנה מעל הסקטור`,
      body: `הצמיחה בפועל בשלוש השנים האחרונות (${pct(growth!)}) מול חציון הסקטור (${pct(medianGrowth!)}). זה מה שדווח, מול מה שנדרש בשורה מעל.`,
    });
  }

  /* ---- What would surprise it ---- */
  const surprises: Surprise[] = [];

  if (requiredAnnual !== null && deliveredExcess !== null && premium >= MEANINGFUL_PREMIUM) {
    const shortfall = requiredAnnual - deliveredExcess;

    if (shortfall > 0) {
      surprises.push({
        direction: "up",
        trigger: "האצה בצמיחת ההכנסות מעל הקצב של הסקטור",
        measuredNow: `${pct(deliveredExcess)} עודף בשלוש השנים האחרונות`,
        threshold: `${pct(requiredAnnual)} עודף בשנה`,
        why: `הפער בין השניים הוא ${pct(shortfall)} בשנה. סגירה שלו מצדיקה את הפרמיה מבלי שהמחיר יצטרך לזוז; המשך הפער אומר שהפרמיה נשענת על משהו שהדוחות עדיין לא מראים.`,
        grade: "likely",
      });
    }

    surprises.push({
      direction: "down",
      trigger: "רבעון שבו הצמיחה יורדת אל מתחת לחציון הסקטור",
      measuredNow:
        growth !== null && medianGrowth !== null
          ? `${pct(growth)} מול חציון ${pct(medianGrowth)}`
          : "—",
      threshold: medianGrowth !== null ? `${pct(medianGrowth)}` : "חציון הסקטור",
      why: "פרמיית מכפיל שנשענת על צמיחה עודפת מאבדת את הבסיס שלה ברגע שהעודף נעלם. זה גם הרגע שבו התיקון נוטה להיות חד, כי המכפיל והרווח נעים לאותו כיוון.",
      grade: "likely",
    });
  }

  if (premium <= -MEANINGFUL_PREMIUM) {
    surprises.push({
      direction: "up",
      trigger: "רבעון שמראה שהחשש שהדיסקאונט מגלם אינו מתממש",
      measuredNow: `${multipleName} ${multiple.toFixed(1)}x מול חציון ${median.toFixed(1)}x`,
      threshold: `${median.toFixed(1)}x`,
      why: "דיסקאונט מול הסקטור הוא חשש מתומחר. כשהחשש לא מתממש ברבעון או שניים, המכפיל נוטה לסגור את הפער אפילו בלי שיפור תפעולי.",
      grade: "possible",
    });
  }

  if (margin !== null && medianMargin !== null) {
    const marginGap = margin - medianMargin;
    surprises.push({
      direction: marginGap >= 0 ? "down" : "up",
      trigger:
        marginGap >= 0
          ? "שחיקה במרווח התפעולי אל מתחת לחציון הסקטור"
          : "התכנסות המרווח התפעולי אל חציון הסקטור",
      measuredNow: `${pct(margin)} מול חציון ${pct(medianMargin)}`,
      threshold: `${pct(medianMargin)}`,
      why:
        marginGap >= 0
          ? "מרווח מעל הסקטור הוא לרוב מה שמצדיק מכפיל מעל הסקטור. שחיקה שלו מסירה את ההצדקה ואת הרווח בבת אחת."
          : "מרווח מתחת לסקטור הוא ההסבר הנפוץ ביותר לדיסקאונט. סגירה שלו היא השינוי שהשוק לא מתמחר.",
      grade: "possible",
    });
  }

  /* ---- The record, which changes how much a surprise is worth ---- */
  const withEstimates = earningsSurprises.filter(
    (row) => row.surprisePercent !== null && Number.isFinite(row.surprisePercent),
  );
  const beats = withEstimates.filter((row) => (row.surprisePercent ?? 0) > 0).length;

  if (withEstimates.length >= 4 && beats === withEstimates.length) {
    surprises.push({
      direction: "down",
      trigger: "הפספוס הראשון מול הקונצנזוס",
      measuredNow: `${beats}/${withEstimates.length} הכאות ברבעונים שנמדדו`,
      threshold: "פספוס אחד",
      why: "חברה שמכה בכל רבעון מלמדת את השוק לצפות להכאה, והציפייה הזאת נכנסת למחיר. במצב כזה ההפתעה האמיתית אינה הכאה נוספת — היא הפעם הראשונה שאין אחת.",
      grade: "likely",
    });
  }

  if (expects.length === 0 && surprises.length === 0) return null;

  const headline =
    Math.abs(premium) < MEANINGFUL_PREMIUM
      ? `השוק מתמחר את ${companyName} בקו אחד עם הסקטור, ולכן אין כאן ציפייה חריגה שאפשר להפריך.`
      : premium > 0
        ? `המחיר מגלם ${pct(premium)} מעל חציון הסקטור — כלומר ציפייה לביצוע עודף. אלה המדידות שיאששו אותה או יפילו אותה.`
        : `המחיר מגלם ${pct(premium)} מול חציון הסקטור — כלומר חשש מתומחר. אלה המדידות שיאששו אותו או יפריכו אותו.`;

  return {
    headline,
    expects,
    surprises,
    assumptions: [
      `אופק ההמרה: ${HORIZON_YEARS} שנים — אותו חלון שבו נמדדת הצמיחה בפועל באתר, כדי ששתי השורות יהיו בנות השוואה.`,
      "החישוב מניח שחציון המכפיל של הסקטור נשאר קבוע ושהמחיר אינו זז. שניהם יזוזו; ההנחה קיימת כדי לבודד משתנה אחד, לא כדי לתאר את העולם.",
      `חציון הסקטור נבנה מ-${sector?.peerCount ?? 0} חברות ביקום ההשוואה של האתר, ולא מכל הענף.`,
      ...(roic !== null && medianRoic !== null
        ? [
            `ההשוואה אינה מתקנת להבדלי מבנה הון. ROIC כאן ${pct(roic)} מול חציון ${pct(medianRoic)}, וחברה שמייצרת תשואה גבוהה יותר על ההון ראויה למכפיל גבוה יותר גם בלי צמיחה עודפת.`,
          ]
        : []),
    ],
    claim: {
      grade: "likely",
      basis: `${multipleName} ${multiple.toFixed(1)}x מול חציון ${median.toFixed(1)}x, וצמיחה מדווחת ${growth !== null ? pct(growth) : "—"} מול חציון ${medianGrowth !== null ? pct(medianGrowth) : "—"}`,
      limits:
        "ההמרה בין פרמיה לקצב צמיחה היא אריתמטיקה על מספרים מדודים, לא תחזית. היא אומרת מה צריך לקרות כדי שהתמחור יתיישב — לא שזה יקרה, ולא באיזו הסתברות.",
    },
  };
}
