import type { EnrichedArticle } from "@/lib/news-shape";
import {
  finnhub,
  model,
  type AgentReport,
  type Evidence,
  type Finding,
} from "./types";

/**
 * Agent 9 — what is being written about the company right now.
 *
 * The third of the three questions the site is built around, and the one
 * most easily done badly. A "sentiment score" from a feed is the standard
 * implementation and it is worthless twice over: it averages away the one
 * story that mattered, and it presents a model's reading of a headline as
 * if it were a measurement of the business.
 *
 * So this agent measures what is actually countable — how many stories,
 * from how many publishers, over what window, and how many of them a model
 * has already read — and keeps the model's own judgement clearly marked as
 * the model's. Nothing here is scored.
 *
 * Two distinctions carry most of the value.
 *
 *   A ticker the article's own text supports is not the same as a ticker
 *   the provider attached. The feed tags stories generously; a Bitcoin
 *   story arrived tagged to Nvidia, which is what prompted the classifier
 *   rewrite. The count is therefore split, and only the first kind is
 *   described as coverage of the company.
 *
 *   Coverage volume is attention, not direction. A burst of stories says
 *   more people are looking, which changes who is buying long before it
 *   changes what the company earns. The finding says so in those words, and
 *   its stance stays neutral: a stance here would put "the press is busy"
 *   into the same column as a measured margin.
 */

const DAY = 86_400_000;

function withinDays(iso: string | null | undefined, days: number): boolean {
  if (!iso) return false;
  const seen = Date.parse(iso);
  if (!Number.isFinite(seen)) return false;
  return Date.now() - seen <= days * DAY;
}

export function narrativeAgent(
  symbol: string,
  articles: EnrichedArticle[],
  /** When the stored feed was last refreshed. A quiet company and a stale
   *  feed look identical from the article list alone. */
  refreshedAt: string | null,
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  if (articles.length === 0) {
    gaps.push(
      `אף כתבה בפיד השמור אינה מזכירה את ${symbol}. הפיד מכסה תשעה סקטורים ומספר מצומצם של מקורות, ולכן היעדר כיסוי כאן אינו אומר שלא נכתב על החברה.`,
    );
    if (refreshedAt) {
      gaps.push(`הפיד עודכן לאחרונה ב-${refreshedAt.slice(0, 10)}.`);
    }
    return { agent: "narrative", label: "זרימת הסיפור", findings, gaps };
  }

  const direct = articles.filter((article) =>
    article.analysis?.tickers.includes(symbol),
  );
  const tagged = articles.filter(
    (article) => !direct.includes(article) && article.tickers.includes(symbol),
  );

  const week = articles.filter((article) => withinDays(article.seenAt, 7));
  const month = articles.filter((article) => withinDays(article.seenAt, 30));
  const publishers = new Set(articles.map((article) => article.domain));
  const analysed = articles.filter((article) => article.analysis !== null);

  const newest = articles[0];

  /* ---- How much is being written ---- */

  const coverage: Evidence[] = [
    {
      label: "כתבות שבעה ימים",
      value: `${week.length}`,
      source: finnhub(refreshedAt?.slice(0, 10) ?? null, "פיד החדשות השמור"),
    },
    {
      label: "כתבות שלושים יום",
      value: `${month.length}`,
      source: finnhub(refreshedAt?.slice(0, 10) ?? null, "פיד החדשות השמור"),
    },
    {
      label: "מקורות שונים",
      value: `${publishers.size}`,
      source: finnhub(null, "לפי דומיין המפרסם"),
    },
  ];

  coverage.push({
    label: "נקראו בידי מודל",
    value: `${analysed.length}/${articles.length}`,
    source: model(null, "כתבות שעברו ניתוח"),
  });

  if (newest?.seenAt) {
    coverage.push({
      label: "הכתבה האחרונה",
      value: newest.seenAt.slice(0, 10),
      source: finnhub(newest.seenAt.slice(0, 10), "מועד הקליטה בפיד"),
    });
  }

  findings.push({
    id: "coverage",
    title:
      week.length >= 5
        ? `${symbol} בכותרות השבוע`
        : week.length === 0
          ? `שבוע שקט סביב ${symbol}`
          : `כיסוי תקין סביב ${symbol}`,
    body:
      `${articles.length} כתבות בפיד מזכירות את החברה, ${direct.length} מהן מזכירות אותה בגוף הטקסט ו-${tagged.length} רק דרך תיוג של ספק הנתונים — ותיוג הוא טענה של הספק, לא של הכתבה.` +
      ` ${week.length} נקלטו בשבוע האחרון, ${
        publishers.size === 1 ? "ממקור יחיד" : `מ-${publishers.size} מקורות שונים`
      }.` +
      " נפח כיסוי הוא תשומת לב ולא כיוון: הוא משנה מי מסתכל על המניה הרבה לפני שהוא משנה את מה שהחברה מרוויחה.",
    stance: "neutral",
    confidence: week.length >= 3 ? "medium" : "low",
    confidenceReason:
      "ספירה של כתבות שנקלטו בפיד. הפיד נמשך כל 20 דקות ממקור אחד, ולכן הוא מדגם ולא מפקד — כתבה שלא נקלטה אינה נספרת.",
    evidence: coverage,
    horizon: "short",
  });

  /* ---- What a model made of it ---- */

  /* Only the articles whose own text names the company. A provider tag is
     not coverage: the feed tagged a Bitcoin story to Nvidia, and counting
     it here would put someone else's headline at the top of this page. */
  const withVerdict = direct.filter((article) => article.analysis?.catalystKind);

  if (withVerdict.length > 0) {
    const catalysts = withVerdict.filter(
      (article) => article.analysis!.catalystKind === "catalyst",
    );
    const noise = withVerdict.filter(
      (article) => article.analysis!.catalystKind === "noise",
    );
    const high = direct.filter(
      (article) => article.analysis?.significance === "high",
    );

  /* The headline that is allowed to leave this agent and reach the
     thesis has to clear both bars the model can set: a catalyst *and* a
     story the model called material. One bar alone lets a listicle that
     happens to name the company through, and "why now" is the last place
     that belongs. */
    const lead =
      catalysts.find(
        (article) => article.analysis?.significance === "high",
      ) ?? null;

    findings.push({
      id: "narrative-catalyst",
      title:
        catalysts.length === 0
          ? `הכתבות האחרונות על ${symbol} סווגו כרעש`
          : `${catalysts.length} מהכתבות סווגו כזרז`,
      body:
        `מתוך ${withVerdict.length} כתבות שנקראו ומזכירות את החברה בגוף הטקסט, ${catalysts.length} סווגו כאירוע שמשנה תזרים, תחרות או רגולציה, ו-${noise.length} סווגו ככותרת שאינה משנה את העסק.` +
        (lead
          ? ` הבולטת מביניהן, והיחידה שסווגה גם כמהותית: "${lead.title}"${lead.seenAt ? ` (${lead.seenAt.slice(0, 10)})` : ""}.`
          : "") +
        " הסיווג נכתב על ידי מודל שקרא את הכתבה, והוא פרשנות ולא מדידה — הוא מופיע כאן כדי להצביע לאן להסתכל, לא כדי להחליף קריאה.",
      stance: "neutral",
      confidence: "low",
      confidenceReason:
        "סיווג של מודל. שתי קריאות של אותה כתבה יכולות להסתיים אחרת, ולכן הוא לעולם אינו נספר כראיה מדודה.",
      evidence: [
        {
          label: "סווגו כזרז",
          value: `${catalysts.length}/${withVerdict.length}`,
          source: model(null, "סיווג שנכתב על ידי מודל"),
        },
        {
          label: "השפעה גבוהה",
          value: `${high.length}`,
          source: model(null, "דירוג מהותיות של המודל"),
        },
        ...(lead
          ? [
              {
                label: "כותרת מובילה",
                value: lead.title,
                source: finnhub(
                  lead.seenAt?.slice(0, 10) ?? null,
                  lead.domain,
                ),
              },
            ]
          : []),
      ],
      horizon: "short",
    });
  } else {
    gaps.push(
      direct.length === 0
        ? `כל האזכורים של ${symbol} בפיד מגיעים מתיוג של ספק הנתונים, ואף כתבה אינה מזכירה את החברה בגוף הטקסט. לא נגזר מהם סיווג.`
        : `${direct.length} כתבות מזכירות את ${symbol} בגוף הטקסט, ואף אחת מהן לא נקראה עדיין בידי מודל. הכותרות מוצגות בעמוד כפי שהן, בלי סיווג.`,
    );
  }

  /* ---- Gaps that are always true here ---- */

  if (tagged.length > direct.length && tagged.length > 0) {
    gaps.push(
      "רוב האזכורים מגיעים מתיוג של ספק הנתונים ולא מגוף הכתבה. תיוג נדיב הוא דפוס מוכר בפיד הזה, ולכן ספירת האזכורים מופרדת.",
    );
  }

  gaps.push(
    "עוצמת הסיקור נמדדת, טון הסיקור לא. ציון סנטימנט מכותרות היה מספר שנראה כמו מדידה ואינו כזה, והאתר אינו מפרסם אותו.",
  );

  if (refreshedAt) {
    gaps.push(
      `הפיד עודכן לאחרונה ב-${refreshedAt.slice(0, 10)}. כתבה שפורסמה אחרי המועד הזה אינה נמצאת בספירה.`,
    );
  }

  return { agent: "narrative", label: "זרימת הסיפור", findings, gaps };
}
