"use client";

/**
 * A portfolio, and what is risky about it.
 *
 * The holdings live in localStorage for the same reason the watchlist
 * does: no accounts, no database, and this is the reader's own business.
 *
 * The readings below are the point of the page. Each one is a threshold
 * applied to a measured number, and each says which number and which
 * threshold — because "high risk" with nothing behind it is a horoscope.
 * None of them says what to buy, sell or hold: the same portfolio is
 * reckless for one person and conservative for another, and the site knows
 * nothing about the reader.
 */

const KEY = "market-intel:portfolio:v1";

export const PORTFOLIO_EVENT = "market-intel:portfolio";

export type Holding = { ticker: string; weight: number };

function read(): Holding[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(KEY);
    const parsed = raw ? (JSON.parse(raw) as Holding[]) : [];
    return Array.isArray(parsed)
      ? parsed.filter(
          (h) => typeof h?.ticker === "string" && Number.isFinite(h?.weight),
        )
      : [];
  } catch {
    return [];
  }
}

export function getHoldings(): Holding[] {
  return read();
}

export function setHoldings(holdings: Holding[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(holdings.slice(0, 25)));
  } catch {
    /* Private window or full quota. The page keeps working for this
       session and simply forgets afterwards. */
  }
  window.dispatchEvent(new CustomEvent(PORTFOLIO_EVENT));
}

/* ------------------------------------------------------------------ */
/* Readings                                                            */
/* ------------------------------------------------------------------ */

export type Summary = {
  holdings: number;
  largestShare: number;
  effectivePositions: number;
  sectors: { sector: string; share: number }[];
  topSector: string | null;
  topSectorShare: number;
  measuredShare: number;
  weightedPe: number | null;
  weightedRoic: number | null;
  weightedLeverage: number | null;
  weightedGrowth: number | null;
  dayChange: number | null;
};

export type Reading = {
  key: string;
  title: string;
  /** What was measured, formatted. */
  figure: string;
  /** Three levels, and never a score: these describe exposure, not quality. */
  level: "tight" | "moderate" | "wide";
  /** Why this level, naming the threshold. */
  body: string;
};

const LEVEL_LABELS: Record<Reading["level"], string> = {
  tight: "ריכוז גבוה",
  moderate: "בינוני",
  wide: "מפוזר",
};

export { LEVEL_LABELS };

export function readPortfolio(summary: Summary): Reading[] {
  const readings: Reading[] = [];

  /* ---- Concentration ---- */
  readings.push({
    key: "largest",
    title: "הפוזיציה הגדולה",
    figure: `${summary.largestShare.toFixed(1)}%`,
    level:
      summary.largestShare >= 35
        ? "tight"
        : summary.largestShare >= 20
          ? "moderate"
          : "wide",
    body:
      summary.largestShare >= 35
        ? `יותר משליש מהתיק תלוי בחברה אחת. ירידה של 30% בנייר הזה לבדו מורידה את התיק בכ-${((summary.largestShare * 30) / 100).toFixed(0)}%, בלי שקרה דבר לשאר.`
        : summary.largestShare >= 20
          ? "פוזיציה משמעותית אך לא שולטת. ירידה חדה בה מורגשת ואינה מכריעה."
          : "אין נייר בודד ששולט בתוצאה. זה מקטין את הנזק מטעות ספציפית, וגם את התועלת מפגיעה מדויקת.",
  });

  readings.push({
    key: "effective",
    title: "כמה פוזיציות זה באמת",
    figure: summary.effectivePositions.toFixed(1),
    level:
      summary.effectivePositions < 4
        ? "tight"
        : summary.effectivePositions < 8
          ? "moderate"
          : "wide",
    body: `בתיק יש ${summary.holdings} ניירות, אבל לפי פיזור המשקלים הוא מתנהג כמו ${summary.effectivePositions.toFixed(1)} פוזיציות שוות. המספר הזה (1 חלקי מדד הרפינדל) הוא הדרך המקובלת לומר שתיק ארוך יכול להיות שני הימורים בתחפושת.`,
  });

  /* ---- Sector ---- */
  if (summary.topSector) {
    readings.push({
      key: "sector",
      title: "הסקטור הכבד",
      figure: `${summary.topSectorShare.toFixed(0)}% ${summary.topSector}`,
      level:
        summary.topSectorShare >= 50
          ? "tight"
          : summary.topSectorShare >= 30
            ? "moderate"
            : "wide",
      body:
        summary.topSectorShare >= 50
          ? `מחצית מהתיק ומעלה נמצאת ב${summary.topSector}. חמש חברות באותו סקטור הן פוזיציה אחת ולא חמש — הן נופלות יחד כשהסקטור נופל, גם אם כל אחת מהן עסק טוב.`
          : summary.topSectorShare >= 30
            ? `${summary.topSector} הוא הגורם הדומיננטי בתיק. שווה לדעת שזה מה שיקבע חלק גדול מהתנודה.`
            : "אין סקטור אחד שקובע את התוצאה.",
    });
  }

  /* ---- Valuation ---- */
  if (summary.weightedPe !== null) {
    readings.push({
      key: "valuation",
      title: "המכפיל המשוקלל",
      figure: `${summary.weightedPe.toFixed(1)}x`,
      level:
        summary.weightedPe >= 40
          ? "tight"
          : summary.weightedPe >= 25
            ? "moderate"
            : "wide",
      body:
        summary.weightedPe >= 40
          ? "התיק משלם מכפיל גבוה על הרווח. זה לא פסול — אבל זה אומר שהתוצאה תלויה בכך שהצמיחה תימשך, ולא רק בכך שהעסקים יישארו טובים."
          : summary.weightedPe >= 25
            ? "מכפיל ממוצע לשוק האמריקאי בשנים האחרונות. חלק מהצמיחה כבר מתומחר."
            : "התיק אינו משלם פרמיה גבוהה על הרווח הנוכחי.",
    });
  }

  /* ---- Leverage ---- */
  if (summary.weightedLeverage !== null) {
    readings.push({
      key: "leverage",
      title: "מינוף משוקלל",
      figure: `${summary.weightedLeverage.toFixed(1)}x`,
      level:
        summary.weightedLeverage >= 3
          ? "tight"
          : summary.weightedLeverage >= 1.5
            ? "moderate"
            : "wide",
      body:
        summary.weightedLeverage >= 3
          ? "חוב נטו של יותר משלוש שנות EBITDA בממוצע משוקלל. חברות ממונפות רגישות הרבה יותר לעליית ריבית ולהאטה, וזה מגיע לתיק כולו."
          : summary.weightedLeverage >= 1.5
            ? "מינוף בינוני. לא חריג, ושווה לעקוב אחריו אם הריבית עולה."
            : "החברות בתיק נושאות מעט חוב ביחס לרווח התפעולי שלהן.",
    });
  }

  /* ---- What could not be measured ---- */
  if (summary.measuredShare < 99) {
    readings.push({
      key: "unmeasured",
      title: "חלק שלא נמדד",
      figure: `${(100 - summary.measuredShare).toFixed(0)}%`,
      level: summary.measuredShare < 70 ? "tight" : "moderate",
      body: "לחלק הזה של התיק אין באתר מדדים מחושבים — חברה מחוץ ליקום, קרן סל, או נייר שאינו מגיש ל-SEC. הוא אינו נכלל בממוצעים למעלה ולא הוחלף בהנחה.",
    });
  }

  return readings;
}
