import type { AnalystView, EarningsDate } from "@/lib/sources/finnhub";
import type { TechnicalRead } from "@/lib/metrics/technical";
import {
  derived,
  finnhub,
  type AgentReport,
  type Finding,
} from "./types";

/**
 * Agent 7 — catalysts.
 *
 * A catalyst is a dated event that can change the thesis. That definition
 * does a lot of work: most of what gets called a catalyst is an
 * expectation, and an expectation with no date attached cannot be waited
 * for, prepared for or falsified.
 *
 * So this agent only reports things that have a date or a measurable level.
 * Scheduled earnings, the price level the technical framework is built
 * around, and where the analyst distribution currently sits. Anything else
 * — "AI adoption", "a strong product cycle" — belongs in the thesis, where
 * it can be argued with, not in a list that implies a calendar.
 */

export type Catalyst = {
  title: string;
  /** ISO date where one exists. Null for a level rather than an event. */
  date: string | null;
  when: string;
  why: string;
  /** What it would take for this to matter. */
  impact: string;
};

export function catalystAgent(
  symbol: string,
  earnings: EarningsDate | null,
  analysts: AnalystView[],
  technical: TechnicalRead | null,
): { report: AgentReport; catalysts: Catalyst[] } {
  const findings: Finding[] = [];
  const gaps: string[] = [];
  const catalysts: Catalyst[] = [];

  /* ---- The one genuinely scheduled event ---- */

  if (earnings) {
    const days = Math.round(
      (Date.parse(earnings.date) - Date.now()) / 86_400_000,
    );
    const when =
      days < 0
        ? "דווח לאחרונה"
        : days === 0
          ? "היום"
          : days === 1
            ? "מחר"
            : `בעוד ${days} ימים`;

    catalysts.push({
      title: "דוח רבעוני",
      date: earnings.date,
      when,
      why: "הדוח הוא הנקודה שבה כל הנחה בתזה נפגשת עם מספר. רוב השינויים בקריאה של האתר קורים ביום הזה.",
      impact: earnings.epsEstimate
        ? `הציפייה עומדת על ${earnings.epsEstimate.toFixed(2)} דולר למניה. פער מהותי לכאן או לכאן מזיז את הקריאה.`
        : "לא פורסמה ציפיית רווח לרבעון הזה.",
    });

    findings.push({
      id: "earnings-date",
      title: `דוח רבעוני ${when}`,
      body: `הדוח הבא צפוי ב-${earnings.date}${earnings.hour ? ` (${earnings.hour === "bmo" ? "לפני הפתיחה" : earnings.hour === "amc" ? "אחרי הנעילה" : earnings.hour})` : ""}. זה האירוע המתוזמן היחיד שהאתר יודע עליו בוודאות.`,
      stance: "neutral",
      confidence: "high",
      confidenceReason: "תאריך מתוך לוח הדוחות של ספק הנתונים.",
      evidence: [
        {
          label: "תאריך דוח",
          value: earnings.date,
          source: finnhub(earnings.date, "לוח דוחות"),
        },
        ...(earnings.epsEstimate !== null
          ? [
              {
                label: "EPS צפוי",
                value: `$${earnings.epsEstimate.toFixed(2)}`,
                source: finnhub(earnings.date, "קונצנזוס"),
              },
            ]
          : []),
      ],
      horizon: "short",
    });
  } else {
    gaps.push(
      `לא נמצא תאריך דוח קרוב ל-${symbol} בלוח הדוחות לשנה הקרובה.`,
    );
  }

  /* ---- A level, not an event ---- */

  if (technical?.vcp.pivot != null && technical.risk) {
    const distance = technical.vcp.toPivotPercent;
    catalysts.push({
      title: "רמת הייחוס הטכנית",
      date: null,
      when:
        distance === null
          ? "—"
          : distance > 0
            ? `${distance.toFixed(1)}% מעל המחיר`
            : `${Math.abs(distance).toFixed(1)}% מתחת למחיר`,
      why: "המסגרת הטכנית באתר בנויה סביב הרמה הזו: מעליה חשבון הסיכון תקף, מתחתיה התבנית לא הושלמה.",
      impact: `העצירה שהמסגרת מציבה היא ${technical.risk.stop.toFixed(2)}, כלומר סיכון של ${technical.risk.riskPercent.toFixed(1)}% מרמת הייחוס.`,
    });
  }

  /* ---- Where the sell side sits ---- */

  const latest = analysts[0];
  if (latest) {
    const total =
      latest.strongBuy +
      latest.buy +
      latest.hold +
      latest.sell +
      latest.strongSell;
    const bullish = latest.strongBuy + latest.buy;
    const bearish = latest.sell + latest.strongSell;

    if (total > 0) {
      const share = (bullish / total) * 100;
      const previous = analysts[1];
      const shifted =
        previous &&
        previous.strongBuy + previous.buy + previous.hold + previous.sell + previous.strongSell > 0
          ? share -
            ((previous.strongBuy + previous.buy) /
              (previous.strongBuy +
                previous.buy +
                previous.hold +
                previous.sell +
                previous.strongSell)) *
              100
          : null;

      findings.push({
        id: "analyst-positioning",
        title:
          share > 80
            ? "הצד המוכר חיובי כמעט פה אחד"
            : share < 40
              ? "הצד המוכר זהיר"
              : "הצד המוכר חלוק",
        body: `${bullish} מתוך ${total} אנליסטים בהמלצת קנייה, ${latest.hold} בהחזקה, ${bearish} במכירה.${
          share > 80
            ? " קונצנזוס כה חד-צדדי הוא בעיקר תיאור של מה שכבר קרה — וגם אומר שיש פחות קונים חדשים שנותרו להשתכנע."
            : ""
        }${shifted !== null && Math.abs(shifted) > 6 ? ` העמדה ${shifted > 0 ? "התחזקה" : "נחלשה"} ב-${Math.abs(shifted).toFixed(0)} נקודות אחוז מהחודש הקודם.` : ""}`,
        stance: "neutral",
        confidence: "medium",
        confidenceReason:
          "סנטימנט, לא ניתוח. המלצות מפגרות אחרי המחיר לעיתים קרובות.",
        evidence: [
          {
            label: "המלצות קנייה",
            value: `${bullish}/${total}`,
            source: finnhub(latest.period, "התפלגות אנליסטים"),
          },
        ],
        horizon: "short",
      });
    }
  } else {
    gaps.push("אין נתוני התפלגות אנליסטים לסימבול הזה.");
  }

  if (catalysts.length === 0) {
    gaps.push(
      "לא נמצא אף אירוע מתוזמן. האתר מדווח רק על אירועים עם תאריך — ציפיות בלי תאריך נמצאות בתזה, לא כאן.",
    );
  }

  return {
    report: { agent: "catalyst", label: "סוכן זרזים", findings, gaps },
    catalysts,
  };
}

/* ------------------------------------------------------------------ */

/**
 * Agent 8 — competitive intelligence.
 *
 * Uses the data provider's peer list rather than a hand-written one, so the
 * comparison does not quietly encode our own assumption about who competes
 * with whom. The comparison itself is deliberately shallow — valuation and
 * size — because that is what can be fetched for eight companies without
 * turning one page view into eighty requests.
 */
export function competitiveAgent(
  symbol: string,
  peers: string[],
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  if (peers.length === 0) {
    gaps.push("ספק הנתונים לא החזיר רשימת מתחרות לסימבול הזה.");
  } else {
    findings.push({
      id: "peer-set",
      title: `${peers.length} חברות בקבוצת ההשוואה`,
      body: `ספק הנתונים מסווג את ${peers.slice(0, 4).join(", ")}${peers.length > 4 ? ` ועוד ${peers.length - 4}` : ""} כמתחרות של ${symbol}. ההשוואה המספרית מופיעה בטבלה שמתחת.`,
      stance: "neutral",
      confidence: "medium",
      confidenceReason:
        "סיווג של ספק הנתונים. חברות בקבוצה אחת יכולות להיות בעסקים שונים מאוד.",
      evidence: [
        {
          label: "מתחרות",
          value: peers.join(", "),
          source: finnhub(null, "רשימת peers"),
        },
      ],
    });
  }

  gaps.push(
    "נתח שוק, מפת מוצרים וחוזק מותג אינם ניתנים לחילוץ מדוחות, ולכן אינם נמדדים כאן.",
  );

  return {
    agent: "competitive",
    label: "מודיעין תחרותי",
    findings,
    gaps,
  };
}

/* ------------------------------------------------------------------ */

/**
 * Agent 6 — technical, as a separate layer.
 *
 * Kept apart from the fundamental agents on purpose. They answer different
 * questions on different time horizons, and merging them produces a single
 * verdict that hides which half of it is doing the work.
 */
export function technicalAgent(technical: TechnicalRead | null): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  if (!technical) {
    return {
      agent: "technical",
      label: "אנליסט טכני",
      findings,
      gaps: ["היסטוריית מחירים לא נטענה."],
    };
  }

  const { stage, template, vcp, volume, relative } = technical;

  if (stage.stage !== null) {
    findings.push({
      id: "stage",
      title: stage.label,
      body: `${stage.note}${stage.daysInStage ? ` נמשך ${stage.daysInStage} ימי מסחר.` : ""}`,
      stance:
        stage.stage === 2 ? "supports" : stage.stage === 4 ? "opposes" : "neutral",
      confidence: stage.daysInStage && stage.daysInStage > 30 ? "high" : "medium",
      confidenceReason:
        stage.daysInStage && stage.daysInStage > 30
          ? `השלב מחזיק ${stage.daysInStage} ימי מסחר, כלומר אינו רעש של שבוע.`
          : "השלב התהפך לאחרונה, וקריאה טרייה יכולה להתהפך שוב.",
      evidence: [
        {
          label: "קריטריוני תבנית המגמה",
          value: `${template.passed}/${template.evaluated}`,
          source: derived("תבנית המגמה של מינרביני"),
        },
        ...(relative?.sixMonth != null
          ? [
              {
                label: "מול S&P 500, חצי שנה",
                value: `${relative.sixMonth > 0 ? "+" : ""}${relative.sixMonth.toFixed(1)} נק׳`,
                source: derived("תשואה עודפת"),
              },
            ]
          : []),
      ],
      horizon: "medium",
    });
  } else {
    gaps.push("אין די היסטוריה לקביעת שלב.");
  }

  if (vcp.verdict === "tight" || vcp.verdict === "forming") {
    findings.push({
      id: "base",
      title: vcp.verdict === "tight" ? "בסיס מהודק" : "בסיס בבנייה",
      body: `${vcp.note} ${volume.note}`,
      stance: vcp.verdict === "tight" && volume.dryUp ? "supports" : "neutral",
      confidence: volume.dryUp ? "medium" : "low",
      confidenceReason: volume.dryUp
        ? "ההתכווצות מלווה בהתייבשות מחזורים, שזה האישור שהתבנית דורשת."
        : "המחיר מתכווץ בלי שהמוכרים נעלמו — תבנית בלי אישור מחזור.",
      evidence: vcp.contractions.slice(-3).map((contraction, i) => ({
        label: `התכווצות ${i + 1}`,
        value: `${contraction.depthPercent.toFixed(1)}%`,
        source: derived(`שפל ב-${contraction.lowDate}`),
      })),
      horizon: "short",
    });
  }

  gaps.push(
    "הניתוח הטכני מתאר את מה שהמחיר כבר עשה. הוא אינו תחזית ואינו מתייחס לעסק.",
  );

  return { agent: "technical", label: "אנליסט טכני", findings, gaps };
}
