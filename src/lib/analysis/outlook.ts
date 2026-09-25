/**
 * The view, at the top of the page.
 *
 * Every other panel on a company page answers a piece of the question. This
 * one answers the question: given everything the site computed, what is the
 * actual position on this company, what would have to be true for it to
 * work, and what would break it.
 *
 * It is a stance, and it is stated plainly — "the business passes and the
 * price already reflects it" is a position, not a shrug. What it is not is
 * a rating. There is no score, no stars, and no buy or sell, for a reason
 * that is worth repeating: a rating asks the reader to trust the site,
 * while a stance with its reasoning attached asks them to check it. The
 * second one survives being wrong.
 *
 * Two things here are forward-looking, which the Core Test deliberately is
 * not:
 *
 *   Catalysts — dated events from the earnings calendar, plus the hand-kept
 *   table in known-events.ts for the things a filing cannot contain. This
 *   is what stops a company being judged only by the quarters behind it:
 *   Take-Two's trailing numbers describe the years before its largest
 *   release, and reading them as the whole story is the mistake the page
 *   exists to prevent.
 *
 *   Scenarios — three mechanical calculations, not forecasts. Each one says
 *   out loud what it assumed, and each assumption is a number that already
 *   appears on the page. "If the multiple holds and profit grows at the
 *   rate of the last three years" is checkable; a price target is not.
 */

import type { CompanyIntelligence } from "@/lib/agents";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { SectorContext } from "@/lib/fundamentals-store";
import type { TechnicalRead } from "@/lib/metrics/technical";
import { knownEventsFor, type KnownEvent } from "@/lib/analysis/known-events";

export type OutlookStance =
  | "constructive"
  | "watch"
  | "cautious"
  | "negative"
  | "insufficient";

export const OUTLOOK_LABELS: Record<
  OutlookStance,
  { label: string; note: string }
> = {
  constructive: {
    label: "תזה חיובית",
    note: "העסק עובר את הבדיקות והתמונה קדימה תומכת",
  },
  watch: {
    label: "מעניינת — דורשת אישור",
    note: "יש סיבה מבוססת לעקוב, אבל משהו עוד לא הוכח",
  },
  cautious: {
    label: "סיכון גבוה",
    note: "יש טיעון, והוא נשען על הנחות שיכולות להישבר",
  },
  negative: {
    label: "תזה שלילית",
    note: "הממצאים פועלים נגד ההשקעה יותר מאשר בעדה",
  },
  insufficient: {
    label: "אין די נתונים",
    note: "הדוחות לא מספקים די כדי להחזיק עמדה",
  },
};

export type Scenario = {
  key: "bull" | "base" | "bear";
  label: string;
  /** Mechanically implied, never forecast. Null when it cannot be computed. */
  impliedPrice: number | null;
  impliedReturn: number | null;
  /** Printed beside the number. Required — a scenario without its
   *  assumptions is a price target. */
  assumptions: string[];
  drivers: string[];
};

export type Outlook = {
  stance: OutlookStance;
  /** One sentence. The thing to leave with if nothing else is read. */
  headline: string;
  /** The argument, two to four lines, each tied to something computed. */
  argument: string[];
  /** What has to be true. Straight from the thesis, which builds it from
   *  findings rather than from adjectives. */
  worksIf: string[];
  breaksIf: string[];
  /** Dated events, then the hand-kept ones. */
  catalysts: { title: string; when: string; why: string }[];
  knownEvents: KnownEvent[];
  scenarios: Scenario[];
  /** Why the stance is held this firmly. */
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  /** The honest limits of everything above. */
  caveats: string[];
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

function metricOf(fundamentals: Fundamentals, key: string): number | null {
  for (const group of fundamentals.groups) {
    const found = group.metrics.find((metric) => metric.key === key);
    if (found && found.value !== null && Number.isFinite(found.value)) {
      return found.value;
    }
  }
  return null;
}

/**
 * Extrapolating a growth rate more than a year out is where a calculation
 * turns into a fantasy, so the rate is capped and the cap is printed.
 * NVIDIA's three-year revenue CAGR is over 100%; compounding that forward
 * produces a number nobody should put on a page.
 */
const GROWTH_CAP = 35;

function cappedGrowth(value: number | null): {
  rate: number | null;
  capped: boolean;
} {
  if (value === null || !Number.isFinite(value)) return { rate: null, capped: false };
  if (value > GROWTH_CAP) return { rate: GROWTH_CAP, capped: true };
  if (value < -50) return { rate: -50, capped: true };
  return { rate: value, capped: false };
}

/* ------------------------------------------------------------------ */
/* Scenarios                                                           */
/* ------------------------------------------------------------------ */

/**
 * Three arithmetic statements about one year out.
 *
 * price × (1 + growth) × (target multiple / current multiple)
 *
 * That is the whole model, and its simplicity is the point: every input is
 * a number already shown on the page, so a reader who disagrees with the
 * output can see exactly which input to argue with. A discounted cash flow
 * here would be more impressive and less checkable.
 */
function buildScenarios(
  price: number | null,
  fundamentals: Fundamentals,
  sector: SectorContext | null,
): Scenario[] {
  if (price === null || !Number.isFinite(price) || price <= 0) return [];

  /**
   * Earnings where there are earnings, sales where there are not.
   *
   * A loss-making company has no P/E, and dropping the scenarios entirely
   * for that reason would silence the page on exactly the companies whose
   * future is the whole question — Take-Two before a release being the
   * case in front of us. P/S is a weaker instrument and is labelled as one
   * wherever it is used.
   */
  const pe = metricOf(fundamentals, "pe");
  const ps = metricOf(fundamentals, "ps");

  const onEarnings = pe !== null && pe > 0;
  const multiple = onEarnings ? pe : ps;
  const multipleName = onEarnings ? "P/E" : "P/S";
  const medianMultiple =
    (onEarnings ? sector?.medians?.pe : sector?.medians?.ps) ?? null;

  // A multiple on earnings is moved by earnings growth; a multiple on
  // sales is moved by revenue growth. Mixing them is how a scenario ends
  // up describing a company nobody owns.
  const rawGrowth = onEarnings
    ? (metricOf(fundamentals, "op_cagr_3") ?? metricOf(fundamentals, "rev_cagr_3"))
    : metricOf(fundamentals, "rev_cagr_3");

  const { rate: growth, capped } = cappedGrowth(rawGrowth);

  if (multiple === null || multiple <= 0 || growth === null) return [];

  const growthLabel = onEarnings ? "הרווח התפעולי" : "ההכנסות";

  const growthNote = capped
    ? `קצב הצמיחה נחתך ל-${GROWTH_CAP}% לשנה — הקצב שדווח גבוה יותר, והמשכה שלו קדימה היא הנחה ולא נתון`
    : `קצב צמיחת ${growthLabel} בשלוש השנים האחרונות: ${growth.toFixed(1)}%`;

  const peNote =
    `מכפיל ${multipleName} נוכחי: ${multiple.toFixed(1)}x` +
    (medianMultiple !== null
      ? ` · חציון הסקטור: ${medianMultiple.toFixed(1)}x`
      : "") +
    (onEarnings
      ? ""
      : ". החברה אינה רווחית כרגע, ולכן החישוב נשען על מכפיל מכירות — מדד גס יותר, שאינו מבחין בין הכנסה רווחית להכנסה מפסידה");

  const implied = (growthPercent: number, multipleRatio: number) =>
    price * (1 + growthPercent / 100) * multipleRatio;

  const ret = (value: number) => ((value - price) / price) * 100;

  // The bull case expands the multiple to the sector median when the
  // company trades below it, and by a stated 15% when it already trades
  // above — rather than inventing a target out of nothing.
  const bullRatio =
    medianMultiple !== null && medianMultiple > multiple ? medianMultiple / multiple : 1.15;
  const bullPrice = implied(growth, bullRatio);

  const basePrice = implied(growth, 1);

  // The bear case is the one that needs no imagination: growth stops and
  // the multiple returns to the sector, or loses a quarter of itself.
  const bearRatio =
    medianMultiple !== null && medianMultiple < multiple ? medianMultiple / multiple : 0.75;
  const bearPrice = implied(0, bearRatio);

  return [
    {
      key: "bull",
      label: "תרחיש חיובי",
      impliedPrice: bullPrice,
      impliedReturn: ret(bullPrice),
      assumptions: [
        growthNote,
        medianMultiple !== null && medianMultiple > multiple
          ? `המכפיל מתכנס כלפי מעלה לחציון הסקטור (${medianMultiple.toFixed(1)}x)`
          : "המכפיל מתרחב ב-15% — הנחה, לא נתון",
      ],
      drivers: [
        "הצמיחה נמשכת בקצב שכבר דווח",
        "השוק ממשיך לשלם על הצמיחה הזאת לפחות כמו היום",
      ],
    },
    {
      key: "base",
      label: "תרחיש בסיס",
      impliedPrice: basePrice,
      impliedReturn: ret(basePrice),
      assumptions: [growthNote, `המכפיל נשאר כפי שהוא. ${peNote}`],
      drivers: [
        `שום דבר לא משתנה מלבד ${growthLabel} עצמם`,
        "זהו העוגן שמולו כדאי לקרוא את שני התרחישים האחרים",
      ],
    },
    {
      key: "bear",
      label: "תרחיש שלילי",
      impliedPrice: bearPrice,
      impliedReturn: ret(bearPrice),
      assumptions: [
        "הצמיחה נעצרת לחלוטין — 0% לשנה",
        medianMultiple !== null && medianMultiple < multiple
          ? `המכפיל מתכווץ לחציון הסקטור (${medianMultiple.toFixed(1)}x)`
          : "המכפיל מתכווץ ברבע — הנחה, לא נתון",
      ],
      drivers: [
        "צמיחה שנעצרת ומכפיל שמתכווץ הם אותו אירוע, לא שניים",
        "זה מה שהמחיר עושה כשהסיפור מפסיק לעבוד, בלי שקרה אסון",
      ],
    },
  ];
}

/* ------------------------------------------------------------------ */
/* The view                                                            */
/* ------------------------------------------------------------------ */

function decideStance(
  intelligence: CompanyIntelligence,
): OutlookStance {
  const { verdict, thesis } = intelligence;

  if (thesis.status === "insufficient" || verdict.stance === "unknown") {
    return "insufficient";
  }
  if (thesis.status === "negative") return "negative";
  if (thesis.status === "high-risk") return "cautious";
  if (thesis.status === "positive") {
    return verdict.stance === "fails" ? "watch" : "constructive";
  }
  return "watch";
}

export function buildOutlook({
  ticker,
  companyName,
  price,
  intelligence,
  fundamentals,
  sector,
  technical,
}: {
  ticker: string;
  companyName: string;
  price: number | null;
  intelligence: CompanyIntelligence;
  fundamentals: Fundamentals;
  sector: SectorContext | null;
  technical: TechnicalRead | null;
}): Outlook {
  const { verdict, thesis, quadrant, catalysts } = intelligence;
  const stance = decideStance(intelligence);

  /* ---- The argument: trailing, price, forward, in that order ---- */
  const argument: string[] = [];

  argument.push(
    `${companyName} עוברת ${verdict.corePassed} מתוך ${verdict.coreEvaluated} בדיקות הליבה ` +
      `(${verdict.passed} מתוך ${verdict.evaluated} סך הכול). ${verdict.headline}`,
  );

  if (quadrant?.verdict) {
    // The four-way read is the one line that separates "the business is the
    // problem" from "the price is the problem" — which is a different
    // decision entirely.
    argument.push(`${quadrant.verdict} ${quadrant.implication}`);
  }

  if (technical?.headline) {
    argument.push(`המחיר עצמו: ${technical.headline}`);
  }

  const events = knownEventsFor(ticker);
  if (events.length > 0) {
    argument.push(
      `הבדיקות למעלה מתארות את מה שכבר דווח. על ${companyName} יש גם אירוע ידוע שטרם ` +
        `נכנס לדוחות — ${events.map((event) => event.title).join(", ")} — ולכן קריאה של ` +
        `הרבעונים האחרונים בלבד מפספסת את החלק שהשוק מתמחר קדימה.`,
    );
  } else if (catalysts.length > 0) {
    argument.push(
      `קדימה: ${catalysts[0].title}${catalysts[0].when ? ` (${catalysts[0].when})` : ""}. ${catalysts[0].why}`,
    );
  }

  /* ---- Confidence ---- */
  const scenarios = buildScenarios(price, fundamentals, sector);

  const caveats: string[] = [];
  if (fundamentals.stale) {
    caveats.push(
      "הדוח האחרון בן יותר מ-120 יום. כל מה שמבוסס עליו מתאר תקופה שהסתיימה מזמן.",
    );
  }
  if (!sector) {
    caveats.push(
      "אין לחברה הזאת חציון סקטור באתר, ולכן המדדים מוצגים בלי השוואה לעמיתים.",
    );
  }
  if (scenarios.length === 0) {
    caveats.push(
      "לא ניתן לחשב תרחישים: חסר מכפיל רווח או קצב צמיחה שאפשר להישען עליו. מספר שאי אפשר לחשב נשאר חסר.",
    );
  }
  if (verdict.caveat) caveats.push(verdict.caveat);

  return {
    stance,
    headline: thesis.headline,
    argument,
    worksIf: thesis.conditions,
    breaksIf: thesis.breakers,
    catalysts: catalysts.slice(0, 4).map((catalyst) => ({
      title: catalyst.title,
      when: catalyst.when,
      why: catalyst.why,
    })),
    knownEvents: events,
    scenarios,
    confidence: thesis.confidence,
    confidenceReason: thesis.confidenceReason,
    caveats,
  };
}
