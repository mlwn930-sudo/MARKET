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
import {
  byGrade,
  gradeByShare,
  type Grade,
  type GradedClaim,
} from "@/lib/intel/confidence";

export type Driver = {
  key: "market" | "sector" | "news" | "ordinary" | "volume" | "analysts";
  title: string;
  /** The measurement, formatted. Always present — a driver without a
   *  figure is a story. */
  figure: string;
  body: string;
  /** How much of the move this accounts for, when that is computable. */
  share: number | null;
  /**
   * How much evidence stands behind this candidate.
   *
   * The reason each driver carries its own grade rather than the panel
   * carrying one: on a given day the index explaining 80% of a move is
   * near-certain arithmetic, and a headline published the same morning is
   * a coincidence with a timestamp. Printing both under one confidence
   * would average a fact with a guess.
   */
  grade: Grade;
  /** What this driver does not establish. */
  limits: string;
};

export type WhyMoving = {
  changePercent: number;
  drivers: Driver[];
  /** Said out loud when the evidence does not reach a conclusion. */
  unexplained: string | null;
  /** The strongest candidate, and how good it is. Null when nothing
   *  reached even "possible". */
  best: GradedClaim | null;
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
  volume,
  analysts,
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
  /** Today's turnover against its own recent average. */
  volume?: { today: number; average: number } | null;
  /** How the sell side's mix shifted between the last two periods. */
  analysts?: { bullishNow: number; bullishBefore: number; total: number } | null;
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
      /* The one claim on this panel that is a measurement about the move
         itself rather than about its cause, which is why it is the only
         one that can be confirmed. */
      grade: "confirmed",
      limits:
        "זו אמירה על גודל התנועה, לא על סיבתה. יום רגיל יכול בהחלט להכיל חדשה — הוא פשוט לא ראיה לכך.",
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
      /* The strongest candidate available on most days, and the only one
         with real arithmetic behind it: when the index moved most of the
         way, a company-specific story has to explain why the stock did
         *not* move further. */
      grade: sameWay ? gradeByShare(share) : "possible",
      limits: sameWay
        ? "המדד והמניה זזו יחד, וזו הבחנה על שיעורים — לא הוכחה שהמדד הוא שגרר. ביום כזה כל מניה בשוק נראית מוסברת."
        : "תנועה נגד המדד מצמצמת את החיפוש לחברה, ואינה מצביעה על מה בחברה.",
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
      /* Breadth is what lifts this above a coincidence: nine of eleven
         peers moving the same way is a group event, three of eleven is
         not. */
      grade:
        together && peersQuoted > 0 && peersAdvancing / peersQuoted > 0.7
          ? "likely"
          : "possible",
      limits: together
        ? "סקטור שזז יחד לא אומר שהסקטור הוא הסיבה — ביום שבו השוק כולו זז, כל הסקטורים זזים איתו."
        : "היפרדות מהסקטור מצמצמת את החיפוש לחברה ואינה מצביעה על מה בה.",
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
      /* Never better than "possible", and usually worse. A story and a
         price move sharing a morning is the single most over-claimed
         connection in financial writing: it fits every outcome, which is
         exactly what makes it worthless as evidence. */
      grade: catalyst ? "possible" : "speculative",
      limits:
        "הקרבה בזמן בין פרסום לתנועה אינה ראיה לקשר. כתבה מתפרסמת בכל בוקר, והמחיר זז בכל בוקר.",
    });
  }

  /* ---- How much agreement was behind it ----
     Volume is not a cause and is never presented as one. It is a
     qualifier on the move: the same 3% on twice the usual turnover is a
     repricing a lot of people took part in, and on half of it is a thin
     tape. Saying "it fell on heavy volume" as though the volume did the
     falling is one of the most common ways this figure is misused. */
  if (volume && volume.average > 0 && Number.isFinite(volume.today)) {
    const relative = volume.today / volume.average;

    if (relative >= 1.5 || relative <= 0.6) {
      drivers.push({
        key: "volume",
        title:
          relative >= 1.5
            ? "המחזור גבוה מהרגיל"
            : "המחזור דל מהרגיל",
        figure: `${relative.toFixed(1)}× מהממוצע`,
        body:
          relative >= 1.5
            ? `המחזור היום הוא ${relative.toFixed(1)} מהממוצע של החמישים ימים האחרונים. זה אומר שהרבה משתתפים תמחרו מחדש, לא שמשהו מסוים קרה — מחזור הוא מידה של הסכמה, לא של סיבה.`
            : `המחזור היום הוא ${relative.toFixed(1)} מהממוצע של החמישים ימים האחרונים. תנועה על מחזור דל מתהפכת בקלות רבה יותר, כי מעט מאוד עסקאות קבעו אותה.`,
        share: null,
        /* Confirmed as a measurement — the turnover is a print — and it is
           labelled as a qualifier rather than a candidate cause, which is
           why it is excluded from the "best explanation" pick below. */
        grade: "confirmed",
        limits:
          "מחזור אומר כמה הסכמה עמדה מאחורי התנועה, לא מה גרם לה. מחזור גבוה מלווה גם עליות וגם ירידות.",
      });
    }
  }

  /* ---- The sell side moved ---- */
  if (analysts && analysts.total > 0) {
    const shift = analysts.bullishNow - analysts.bullishBefore;

    if (Math.abs(shift) >= 2) {
      drivers.push({
        key: "analysts",
        title:
          shift > 0
            ? "אנליסטים עברו לצד החיובי"
            : "אנליסטים עברו לצד השלילי",
        figure: `${shift > 0 ? "+" : "−"}${Math.abs(shift)} מתוך ${analysts.total}`,
        body: `תמהיל ההמלצות זז ב-${Math.abs(shift)} דירוגים בין שתי התקופות האחרונות שפורסמו. תיקון דירוג מתפרסם בתאריך ידוע אחד ומגיע לנתונים כאן בתדירות חודשית, ולכן אי אפשר לקשור אותו ליום מסחר מסוים.`,
        share: null,
        /* Monthly resolution against a daily move. The direction is a
           fact; the timing is not, and the timing is what a causal claim
           about today would need. */
        grade: "speculative",
        limits:
          "הנתון מתעדכן חודשית ואינו נושא את תאריך התיקון עצמו, ולכן הוא לא יכול להסביר יום מסחר בודד.",
      });
    }
  }

  /* ---- What is left ---- */
  const explained =
    (indexChange !== null && indexChange * changePercent > 0) ||
    (sectorChange !== null && sectorChange * changePercent > 0) ||
    today.length > 0 ||
    size < ORDINARY_MOVE;

  /* ---- The best candidate, graded ----
     The panel's bottom line. It is the strongest single driver rather than
     a combination, because combining a "likely" market explanation with a
     "speculative" news one produces something better than either — which
     is arithmetic doing the opposite of what evidence should do.

     Ties keep their original order, and the drivers are pushed strongest
     evidence first — the index before the sector before a headline — so a
     tie resolves towards arithmetic rather than towards a story.

     Volume is excluded along with the size check. It is confirmed as a
     measurement and would therefore always win, but it is a qualifier on
     the move rather than a candidate cause — letting it become the
     "best explanation" would have the panel conclude that a stock fell
     because people traded it. */
  const strongest =
    drivers
      .filter(
        (driver) => driver.key !== "ordinary" && driver.key !== "volume",
      )
      .slice()
      .sort(byGrade)[0] ?? null;

  return {
    changePercent,
    drivers,
    unexplained: explained
      ? null
      : `אין בנתונים שיש לאתר די כדי להסביר את התנועה של היום. המדד והסקטור לא זזו לאותו כיוון, ולא נקלטה כתבה שמזכירה את ${ticker}. זו תשובה לגיטימית — הסברים לתנועות יומיות נכתבים לרוב אחרי מעשה, ומתאימים לכל תוצאה.`,
    best: strongest
      ? {
          grade: strongest.grade,
          basis: `${strongest.title} · ${strongest.figure}`,
          limits: strongest.limits,
        }
      : null,
  };
}
