import type { EarningsSurprise } from "@/lib/sources/finnhub";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import {
  finnhub,
  gradeConfidence,
  sec,
  stanceOf,
  type AgentReport,
  type Finding,
} from "./types";

/**
 * Agent 3 — the growth analyst.
 *
 * Two questions: is the business still growing, and does it land where it
 * said it would.
 *
 * The second one is the useful one and is new to this project. A company
 * that has beaten its own quarter eight times running is telling you
 * something about how it guides; one that misses regularly is telling you
 * something about how well it knows its own business. Neither is a
 * prediction — both are a track record, which is the only forward-looking
 * thing a filing can honestly support.
 *
 * Forward revenue and analyst targets are absent on purpose: the endpoint
 * that carries them is not on this plan, and a growth rate we cannot fetch
 * is not one we may estimate.
 */
export function growthAnalyst(
  fundamentals: Fundamentals,
  surprises: EarningsSurprise[],
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

  /* ---- Reported growth ---- */

  const cagr3 = metric("rev_cagr_3");
  const cagr5 = metric("rev_cagr_5");
  const opCagr = metric("op_cagr_3");

  if (cagr3 !== null) {
    const accelerating = cagr5 !== null && cagr3 > cagr5 + 2;
    const decelerating = cagr5 !== null && cagr3 < cagr5 - 2;

    const grade = gradeConfidence({
      evidenceCount: [cagr3, cagr5, opCagr].filter((v) => v !== null).length,
      ageDays: null,
    });

    findings.push({
      id: "revenue-growth",
      title: accelerating
        ? "הצמיחה מאיצה"
        : decelerating
          ? "הצמיחה מאטה"
          : cagr3 > 0
            ? "ההכנסות צומחות"
            : "ההכנסות מצטמקות",
      body: accelerating
        ? `הקצב בשלוש השנים האחרונות (${cagr3.toFixed(1)}%) גבוה מהקצב בחמש (${cagr5!.toFixed(1)}%) — כלומר התקופה האחרונה חזקה מהממוצע ארוך הטווח.`
        : decelerating
          ? `הקצב בשלוש השנים האחרונות (${cagr3.toFixed(1)}%) נמוך מהקצב בחמש (${cagr5!.toFixed(1)}%). ההאטה עצמה אינה בעיה — השאלה היא אם המכפיל עדיין מתמחר את הקצב הישן.`
          : `ההכנסות ${cagr3 > 0 ? "צומחות" : "מצטמקות"} בקצב שנתי של ${Math.abs(cagr3).toFixed(1)}% בשלוש השנים האחרונות.`,
      stance: stanceOf(cagr3, { good: (v) => v > 8, bad: (v) => v < 0 }),
      confidence: grade.confidence,
      confidenceReason: grade.reason,
      evidence: [
        { label: "צמיחת הכנסות 3ש׳", value: `${cagr3.toFixed(1)}%`, source },
        ...(cagr5 !== null
          ? [
              {
                label: "צמיחת הכנסות 5ש׳",
                value: `${cagr5.toFixed(1)}%`,
                source,
              },
            ]
          : []),
        ...(opCagr !== null
          ? [
              {
                label: "צמיחת רווח תפעולי 3ש׳",
                value: `${opCagr.toFixed(1)}%`,
                source,
              },
            ]
          : []),
      ],
      horizon: "long",
    });
  } else {
    gaps.push("אין די שנים של דוחות שנתיים לחישוב קצב צמיחה.");
  }

  /* ---- Track record against expectations ---- */

  const reported = surprises.filter(
    (row) => row.actual !== null && row.estimate !== null,
  );

  if (reported.length >= 4) {
    const recent = reported.slice(-8);
    const beats = recent.filter((row) => (row.surprise ?? 0) > 0).length;
    const misses = recent.filter((row) => (row.surprise ?? 0) < 0).length;
    const lastFour = recent.slice(-4);
    const averageSurprise =
      lastFour.reduce((sum, row) => sum + (row.surprisePercent ?? 0), 0) /
      lastFour.length;

    const grade = gradeConfidence({
      evidenceCount: recent.length >= 6 ? 3 : 2,
      ageDays: null,
      nearThreshold: beats === misses,
    });

    findings.push({
      id: "delivery",
      title:
        beats >= recent.length - 1
          ? "החברה עומדת בציפיות באופן עקבי"
          : misses > beats
            ? "החברה מפספסת את הציפיות לעיתים קרובות"
            : "היסטוריה מעורבת מול הציפיות",
      body:
        beats >= recent.length - 1
          ? `הכתה את תחזית הרווח ב-${beats} מתוך ${recent.length} הרבעונים האחרונים, בממוצע ${averageSurprise.toFixed(1)}% ברבעונים האחרונים. זה לא אומר שהיא תמשיך — זה אומר משהו על איך היא מנחה.`
          : misses > beats
            ? `פספסה את תחזית הרווח ב-${misses} מתוך ${recent.length} הרבעונים האחרונים. פספוס חוזר אומר בדרך כלל שהחברה מתקשה לחזות את העסק שלה עצמה.`
            : `הכתה ב-${beats} ופספסה ב-${misses} מתוך ${recent.length} הרבעונים האחרונים — בלי דפוס ברור.`,
      stance: stanceOf(beats - misses, {
        good: (v) => v >= 4,
        bad: (v) => v <= -2,
      }),
      confidence: grade.confidence,
      confidenceReason: `${grade.reason}. תחזית הקונצנזוס מגיעה מספק הנתונים ולא מהחברה.`,
      evidence: [
        {
          label: "הכתה את התחזית",
          value: `${beats}/${recent.length} רבעונים`,
          source: finnhub(recent[recent.length - 1]?.period ?? null),
        },
        {
          label: "הפתעה ממוצעת",
          value: `${averageSurprise > 0 ? "+" : ""}${averageSurprise.toFixed(1)}%`,
          source: finnhub(null, "ארבעת הרבעונים האחרונים"),
        },
      ],
      horizon: "short",
    });
  } else {
    gaps.push("אין די רבעונים מדווחים כדי לבחון עמידה בציפיות.");
  }

  /* ---- The one forward figure available ---- */

  const pending = surprises.find(
    (row) => row.actual === null && row.estimate !== null,
  );

  if (pending) {
    findings.push({
      id: "next-quarter",
      title: "תחזית הרווח לרבעון הקרוב",
      body: `הקונצנזוס לרבעון שמסתיים ${pending.period} עומד על ${pending.estimate!.toFixed(2)} דולר למניה. זו ציפייה של אנליסטים, לא הנחיה של החברה, והיא הנתון היחיד צופה-פני-עתיד באתר.`,
      stance: "neutral",
      confidence: "low",
      confidenceReason:
        "תחזית אנליסטים משתנה עד לרגע הדיווח, וממוצע אינו הבטחה.",
      evidence: [
        {
          label: `EPS צפוי · ${pending.period}`,
          value: `$${pending.estimate!.toFixed(2)}`,
          source: finnhub(pending.period, "קונצנזוס אנליסטים"),
        },
      ],
      horizon: "short",
    });
  }

  gaps.push(
    "תחזית הכנסות עתידית, TAM והנחיית החברה אינם זמינים במסלול הנתונים של האתר.",
  );

  return { agent: "growth", label: "אנליסט צמיחה", findings, gaps };
}
