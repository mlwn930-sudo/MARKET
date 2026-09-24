import type { CapitalQuality } from "@/lib/metrics/capital";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import type { TechnicalRead } from "@/lib/metrics/technical";
import type { BusinessVsPrice } from "./valuation";
import {
  derived,
  sec,
  type AgentReport,
  type Finding,
  type Stance,
} from "./types";

/**
 * Agent 5 and Agent 10 — risk, and the argument against.
 *
 * These are one file because they do the same job from two directions. The
 * risk agent asks what could go wrong with the business; the contrarian
 * agent asks what could be wrong with the *analysis*.
 *
 * The second is the one that earns its place. Every other agent here is
 * looking for a pattern, and a system of pattern-finders converges on
 * agreement whether or not the agreement is warranted. This one is pointed
 * at the conclusion the others reached and asked to attack it — not to
 * balance the tone, but because a case nobody has argued against has not
 * been tested.
 *
 * It only makes arguments from figures on the page. "The market could turn"
 * is not an argument, it is a mood.
 */

export function riskAnalyst(
  fundamentals: Fundamentals,
  capital: CapitalQuality,
  technical: TechnicalRead | null,
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  const asOf = fundamentals.asOf?.end ?? null;
  const source = sec(asOf, "דוח שהוגש ל-SEC");

  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found.value;
    }
    return null;
  };

  const add = (
    id: string,
    title: string,
    body: string,
    severity: "high" | "medium" | "low",
    evidence: Finding["evidence"],
  ) =>
    findings.push({
      id,
      title,
      body,
      stance: "opposes" as Stance,
      confidence: severity === "high" ? "high" : severity === "low" ? "low" : "medium",
      confidenceReason:
        severity === "high"
          ? "נמדד ישירות מהדוח, והערך רחוק מהסף."
          : "נמדד מהדוח, אך הערך אינו קיצוני.",
      evidence,
    });

  /* ---- Balance sheet ---- */

  const netDebt = metric("net_debt_ebitda");
  const coverage = metric("interest_coverage");

  if (netDebt !== null && netDebt > 3) {
    add(
      "leverage-risk",
      "מינוף פיננסי",
      `חוב נטו של פי ${netDebt.toFixed(1)} מה-EBITDA. רבעון חלש אחד מצמצם את מרחב התמרון, וכל מיחזור חוב בסביבת ריבית גבוהה מייקר את שירות החוב.`,
      netDebt > 4.5 ? "high" : "medium",
      [
        { label: "חוב נטו / EBITDA", value: `${netDebt.toFixed(1)}x`, source },
        ...(coverage !== null
          ? [
              {
                label: "כיסוי ריבית",
                value: `${coverage.toFixed(1)}x`,
                source,
              },
            ]
          : []),
      ],
    );
  }

  /* ---- Cash burn ---- */

  const fcfMargin = metric("fcf_margin");
  if (fcfMargin !== null && fcfMargin < 0) {
    add(
      "cash-burn",
      "שריפת מזומן",
      `התזרים החופשי שלילי (${fcfMargin.toFixed(1)}% מההכנסות). כל עוד זה נמשך, ההמשך תלוי ביתרת המזומן או בגיוס — ושתי האפשרויות מתייקרות בדיוק כשהשוק נחלש.`,
      fcfMargin < -10 ? "high" : "medium",
      [{ label: "FCF Margin", value: `${fcfMargin.toFixed(1)}%`, source }],
    );
  }

  /* ---- Dilution ---- */

  if (
    capital.stockComp.shareCountChange !== null &&
    capital.stockComp.shareCountChange > 1
  ) {
    add(
      "dilution-risk",
      "דילול מתמשך",
      `ספירת המניות עלתה ב-${capital.stockComp.shareCountChange.toFixed(1)}% בשלוש שנים. צמיחה ברווח הכולל לא מגיעה במלואה לבעל המניות הקיים כשהעוגה נחתכת ליותר פרוסות.`,
      capital.stockComp.shareCountChange > 4 ? "high" : "medium",
      [
        {
          label: "שינוי בספירת המניות",
          value: `+${capital.stockComp.shareCountChange.toFixed(1)}%`,
          source,
        },
      ],
    );
  }

  /* ---- Value destruction ---- */

  if (capital.costOfCapital.spread !== null && capital.costOfCapital.spread < 0) {
    add(
      "value-destruction",
      "תשואה מתחת לעלות ההון",
      `המרווח שלילי ב-${Math.abs(capital.costOfCapital.spread).toFixed(1)} נקודות אחוז. במצב כזה צמיחה הורסת ערך — ככל שיושקע יותר, כך ייהרס יותר, גם אם ההכנסות והרווח עולים.`,
      capital.costOfCapital.spread < -5 ? "high" : "medium",
      [
        {
          label: "ROIC פחות WACC",
          value: `${capital.costOfCapital.spread.toFixed(1)} נק׳`,
          source: derived("ראה הנחות בלוח עלות ההון"),
        },
      ],
    );
  }

  /* ---- Price ---- */

  if (technical?.stage.stage === 4) {
    add(
      "downtrend-risk",
      "המחיר בשלב ירידה",
      "המחיר מתחת לממוצע הארוך והממוצע עצמו יורד. מסגרת ניתוח השלבים מתייחסת לשלב הזה כאל השלב שבו נגרם רוב הנזק, ללא קשר לאיכות העסק.",
      "medium",
      [
        {
          label: "שלב",
          value: technical.stage.label,
          source: derived("ניתוח שלבים"),
        },
      ],
    );
  }

  if (findings.length === 0) {
    gaps.push(
      "אף אחד מסיכוני המאזן, התזרים והדילול שהאתר בודק לא הופעל. זה לא אומר שאין סיכונים — רק שהם לא מופיעים בדוחות.",
    );
  }

  gaps.push(
    "ריכוזיות לקוחות, תלות בספק, תביעות ורגולציה ספציפית אינם נחלצים אוטומטית מהדוחות, ולכן אינם נבדקים כאן.",
  );

  return { agent: "risk", label: "אנליסט סיכונים", findings, gaps };
}

/* ------------------------------------------------------------------ */

/**
 * The argument against whatever the other agents concluded.
 *
 * Takes the emerging stance as input and attacks it. When the picture is
 * favourable it looks for the optimistic assumption; when it is
 * unfavourable it looks for what the pessimism might be missing. That
 * symmetry matters — an agent that only ever argues bearish is not a check
 * on bias, it is a second bias.
 */
export function contrarianAgent(
  fundamentals: Fundamentals,
  capital: CapitalQuality,
  technical: TechnicalRead | null,
  quadrant: BusinessVsPrice,
  leaning: "favourable" | "unfavourable" | "mixed",
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  const asOf = fundamentals.asOf?.end ?? null;
  const source = sec(asOf, "דוח שהוגש ל-SEC");

  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found.value;
    }
    return null;
  };

  const push = (
    id: string,
    title: string,
    body: string,
    evidence: Finding["evidence"],
  ) =>
    findings.push({
      id,
      title,
      body,
      stance: "opposes",
      confidence: "medium",
      confidenceReason:
        "טיעון נגד, שנבנה מהנתונים שעל העמוד. הוא נועד לבחון את המסקנה, לא להחליף אותה.",
      evidence,
    });

  if (leaning === "favourable") {
    /* ---- What the optimistic reading is assuming ---- */

    const cagr3 = metric("rev_cagr_3");
    const cagr5 = metric("rev_cagr_5");

    if (cagr3 !== null && cagr5 !== null && cagr3 < cagr5 - 2) {
      push(
        "growth-fading",
        "הצמיחה שמצדיקה את התמונה כבר מאטה",
        `הקצב בשלוש שנים (${cagr3.toFixed(1)}%) נמוך מהקצב בחמש (${cagr5.toFixed(1)}%). אם המכפיל עדיין מתמחר את הקצב הישן, החלק הקשה עוד לפנינו.`,
        [
          { label: "3ש׳", value: `${cagr3.toFixed(1)}%`, source },
          { label: "5ש׳", value: `${cagr5.toFixed(1)}%`, source },
        ],
      );
    }

    if (quadrant.priceLevel === "rich") {
      push(
        "priced-in",
        "רוב התזה כבר מתומחרת",
        "התמחור גבוה גם מול הסקטור וגם מול ההיסטוריה של החברה עצמה. במצב כזה החברה יכולה לבצע בדיוק כפי שמצופה — והמניה עדיין לא תזוז, כי הביצוע הזה כבר בתוך המחיר.",
        [
          {
            label: "מצב התמחור",
            value: quadrant.verdict,
            source: derived("מול הסקטור ומול ההיסטוריה"),
          },
        ],
      );
    }

    if (technical?.relative?.consistent) {
      push(
        "crowded",
        "העדיפות מול המדד כבר ארוכה",
        "המניה מניבה יותר מהמדד בכל אחד מהחלונות שנמדדו. זו עובדה על מה שכבר קרה, והיא גם אומרת שמי שהתלהב כנראה כבר קנה.",
        [
          {
            label: "מול S&P 500, חצי שנה",
            value: `+${technical.relative.sixMonth?.toFixed(1) ?? "—"} נק׳`,
            source: derived("תשואה עודפת"),
          },
        ],
      );
    }

    if (capital.stockComp.shareOfFcf !== null && capital.stockComp.shareOfFcf > 20) {
      push(
        "fcf-flattered",
        "התזרים המדווח נדיב מהכלכלה בפועל",
        `התגמול במניות שווה ל-${capital.stockComp.shareOfFcf.toFixed(0)}% מהתזרים החופשי. הוא מתווסף חזרה בדוח כי לא יוצא מזומן, אבל העלות אמיתית ומשולמת בבעלות.`,
        [
          {
            label: "SBC מתוך FCF",
            value: `${capital.stockComp.shareOfFcf.toFixed(0)}%`,
            source,
          },
        ],
      );
    }
  } else {
    /* ---- What the pessimistic reading might be missing ---- */

    if (quadrant.businessQuality === "weak" && quadrant.priceLevel === "cheap") {
      push(
        "already-priced",
        "החולשה כבר מתומחרת",
        "גם העסק חלש וגם המחיר נמוך. זה לא אומר שכדאי — אבל זה כן אומר שהתזה השלילית אינה גילוי: היא כבר במחיר, ומה שיזיז את המניה מכאן הוא הפתעה לטובה.",
        [
          {
            label: "מצב",
            value: quadrant.verdict,
            source: derived("צירוף עסק-מחיר"),
          },
        ],
      );
    }

    const operating = metric("operating_margin");
    const leverageTurn = capital.leverage.turning;

    if (leverageTurn === "inflecting") {
      push(
        "margin-turn",
        "המרווח על ההכנסה החדשה כבר השתפר",
        `${capital.leverage.note} המרווח המדווח הוא ממוצע של העבר, והוא מתקן לאט אחרי שהעסק כבר השתנה.`,
        [
          {
            label: "מרווח שולי",
            value:
              capital.leverage.incrementalMargin === null
                ? "—"
                : `${capital.leverage.incrementalMargin.toFixed(0)}%`,
            source: derived("שינוי ברווח חלקי שינוי בהכנסות"),
          },
          ...(operating !== null
            ? [
                {
                  label: "מרווח מדווח",
                  value: `${operating.toFixed(1)}%`,
                  source,
                },
              ]
            : []),
        ],
      );
    }

    if (fundamentals.stale) {
      push(
        "stale-data",
        "הקריאה נשענת על דוח ישן",
        "הדוח האחרון בן יותר מ-120 יום. מסקנה שלילית שנבנתה עליו מתארת רבעון שהסתיים מזמן, וייתכן שכבר השתנה משהו שאינו מופיע באף מספר בעמוד.",
        [
          {
            label: "תאריך הדוח",
            value: asOf ?? "—",
            source,
          },
        ],
      );
    }
  }

  if (findings.length === 0) {
    gaps.push(
      "לא נמצא טיעון נגד שנשען על נתון בעמוד. היעדר טיעון אינו אישור לתזה — הוא אומר שהנתונים שיש לא סותרים אותה.",
    );
  }

  return {
    agent: "contrarian",
    label: "סוכן הפרכה",
    findings,
    gaps,
  };
}
