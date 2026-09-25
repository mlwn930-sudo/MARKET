/**
 * Why is this moving?
 *
 * The question every reader asks and almost no site answers honestly. The
 * usual answer is a headline picked because it is recent, which is how
 * "NVDA fell on profit-taking" gets written about a day when the whole
 * market fell.
 *
 * So this does not ask a model, and it does not pick a story. It tests
 * four candidate explanations against measurements the site already has,
 * reports each one with the figure behind it, and — this is the part that
 * matters — returns nothing when nothing explains the move.
 *
 *   The market moved       how much of today is just the index
 *   The sector moved       peers doing the same thing is not company news
 *   Something was written  stories that name this company today
 *   The move is ordinary   most days are noise, and a 0.4% day needs no
 *                          explanation at all
 *
 * The order is deliberate. A reader who learns that the index fell 1.8%
 * and this stock fell 2.0% has the answer, and reading a headline first
 * would have sent them looking for a cause that is not there.
 */

import type { EnrichedArticle } from "@/lib/news-shape";

export type Driver = {
  key: "market" | "sector" | "news" | "ordinary";
  title: string;
  /** The measurement, formatted. Always present — a driver without a
   *  figure is a story. */
  figure: string;
  body: string;
  /** How much of the move this accounts for, when that is computable. */
  share: number | null;
};

export type WhyMoving = {
  changePercent: number;
  drivers: Driver[];
  /** Said out loud when the evidence does not reach a conclusion. */
  unexplained: string | null;
};

/** Below this, a move is a market being open. Stated on the page rather
 *  than hidden here. */
const ORDINARY_MOVE = 1.2;

const pct = (value: number) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(2)}%`;

export function whyMoving({
  ticker,
  changePercent,
  indexChange,
  sectorChange,
  sectorLabel,
  peersAdvancing,
  peersQuoted,
  articles,
}: {
  ticker: string;
  changePercent: number | null;
  /** The benchmark's move today, when it could be read. */
  indexChange: number | null;
  sectorChange: number | null;
  sectorLabel: string | null;
  peersAdvancing: number;
  peersQuoted: number;
  /** Stories naming this company, newest first. */
  articles: EnrichedArticle[];
}): WhyMoving | null {
  if (changePercent === null || !Number.isFinite(changePercent)) return null;

  const drivers: Driver[] = [];
  const size = Math.abs(changePercent);

  /* ---- Is there anything to explain at all ---- */
  if (size < ORDINARY_MOVE) {
    drivers.push({
      key: "ordinary",
      title: "התנועה בגודל רגיל",
      figure: pct(changePercent),
      body: `תנועה של פחות מ-${ORDINARY_MOVE}% ביום אינה אירוע שדורש הסבר — זה הטווח שבו מניה נסחרת בלי שקרה דבר. חיפוש סיבה לתנועה בגודל הזה הוא הדרך המהירה למצוא קשר שלא קיים.`,
      share: null,
    });
  }

  /* ---- The market ---- */
  if (indexChange !== null && Number.isFinite(indexChange)) {
    const share =
      Math.abs(changePercent) > 0
        ? Math.min(Math.abs(indexChange / changePercent), 1)
        : null;

    const sameWay = indexChange * changePercent > 0;

    drivers.push({
      key: "market",
      title: sameWay ? "השוק כולו זז לאותו כיוון" : "המניה זזה נגד השוק",
      figure: `S&P 500 ${pct(indexChange)}`,
      body: sameWay
        ? `המדד זז ${pct(indexChange)} והמניה ${pct(changePercent)}. ${
            share !== null && share > 0.6
              ? "רוב התנועה של היום היא השוק ולא החברה."
              : "חלק מהתנועה הוא השוק; השאר ספציפי למניה."
          }`
        : `המדד זז ${pct(indexChange)} והמניה ${pct(changePercent)} — לכיוון ההפוך. תנועה נגד השוק היא בדרך כלל ספציפית לחברה.`,
      share: sameWay ? share : 0,
    });
  }

  /* ---- The sector ---- */
  if (sectorChange !== null && sectorLabel && peersQuoted > 1) {
    const together = sectorChange * changePercent > 0;

    drivers.push({
      key: "sector",
      title: together ? "הסקטור זז יחד" : "המניה נפרדת מהסקטור",
      figure: `${sectorLabel} ${pct(sectorChange)}`,
      body: together
        ? `${peersAdvancing} מתוך ${peersQuoted} החברות בסקטור נסחרות בירוק, והסקטור כולו ${pct(sectorChange)}. כשעמיתים עושים אותו דבר, זו לא חדשה על החברה הזאת.`
        : `הסקטור ${pct(sectorChange)} והמניה ${pct(changePercent)}. פער מול העמיתים הוא הסימן החזק ביותר שמשהו ספציפי לחברה קרה.`,
      share: together ? 0.5 : 0,
    });
  }

  /* ---- Something was written ---- */
  const today = articles.filter((article) => {
    if (!article.seenAt) return false;
    const age = Date.now() - new Date(article.seenAt).getTime();
    return age < 36 * 60 * 60 * 1000;
  });

  if (today.length > 0) {
    const catalyst = today.find(
      (article) =>
        article.analysis?.catalystKind === "catalyst" ||
        article.triage?.kind === "catalyst",
    );

    drivers.push({
      key: "news",
      title: catalyst ? "יש כתבה שסווגה כזרז" : "נכתב על החברה היום",
      figure: `${today.length} כתבות`,
      body: catalyst
        ? `"${catalyst.title}" — ${catalyst.analysis?.impact ?? catalyst.triage?.reason ?? ""}. הסיווג כזרז אומר שהאירוע נוגע לתזרים, לתחרות או לרגולציה; הוא אינו מוכיח שהמחיר זז בגללו.`
        : `${today.length} כתבות הזכירו את ${ticker} ביממה האחרונה, ואף אחת מהן לא סווגה כאירוע שמשנה את העסק. סיקור אינו סיבה.`,
      share: null,
    });
  }

  /* ---- What is left ---- */
  const explained =
    (indexChange !== null && indexChange * changePercent > 0) ||
    (sectorChange !== null && sectorChange * changePercent > 0) ||
    today.length > 0 ||
    size < ORDINARY_MOVE;

  return {
    changePercent,
    drivers,
    unexplained: explained
      ? null
      : `אין בנתונים שיש לאתר די כדי להסביר את התנועה של היום. המדד והסקטור לא זזו לאותו כיוון, ולא נקלטה כתבה שמזכירה את ${ticker}. זו תשובה לגיטימית — הסברים לתנועות יומיות נכתבים לרוב אחרי מעשה, ומתאימים לכל תוצאה.`,
  };
}
