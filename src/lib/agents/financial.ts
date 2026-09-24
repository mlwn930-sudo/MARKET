import type { CapitalQuality } from "@/lib/metrics/capital";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import {
  ageInDays,
  derived,
  gradeConfidence,
  sec,
  stanceOf,
  type AgentReport,
  type Finding,
} from "./types";

/**
 * Agent 1 — the financial analyst.
 *
 * Reads what the company reported and says whether the business works.
 * Nothing here is forward-looking: every figure comes from a filed
 * statement, and the agent's job is to describe the machine, not to guess
 * where it is going.
 *
 * It does not compute anything itself. Every number arrives from
 * `metrics/fundamentals.ts` or `metrics/capital.ts`, which are the single
 * source of truth for formulas in this project — an agent that recomputed a
 * margin would be the second place a formula lives, and the two would
 * disagree within a month.
 */
export function financialAnalyst(
  fundamentals: Fundamentals,
  capital: CapitalQuality,
): AgentReport {
  const findings: Finding[] = [];
  const gaps: string[] = [];

  const asOf = fundamentals.asOf?.end ?? null;
  const age = ageInDays(asOf);
  const source = sec(asOf, "דוח שהוגש ל-SEC");

  const metric = (key: string) => {
    for (const group of fundamentals.groups) {
      const found = group.metrics.find((m) => m.key === key);
      if (found) return found;
    }
    return null;
  };

  /* ---- Does capital earn more than it costs ---- */

  const { costOfCapital, stockComp, cashCycle, leverage } = capital;

  if (costOfCapital.spread === null) {
    gaps.push(
      "לא ניתן היה לחשב מרווח מול עלות ההון — חסר נתון מאזני או beta.",
    );
  } else {
    const spread = costOfCapital.spread;
    const grade = gradeConfidence({
      evidenceCount: 3,
      ageDays: age,
      nearThreshold: Math.abs(spread) < 2,
    });

    findings.push({
      id: "spread",
      title:
        spread > 0
          ? "העסק מייצר תשואה מעל עלות ההון"
          : "התשואה על ההון נמוכה מעלותו",
      body: costOfCapital.note,
      stance: stanceOf(spread, { good: (v) => v > 2, bad: (v) => v < -2 }),
      confidence: grade.confidence,
      confidenceReason: `${grade.reason}. החישוב נשען על הנחות שמודפסות לצידו.`,
      evidence: [
        {
          label: "ROIC",
          value:
            costOfCapital.roic === null
              ? "—"
              : `${(costOfCapital.roic * 100).toFixed(1)}%`,
          source,
        },
        {
          label: "WACC",
          value:
            costOfCapital.wacc === null
              ? "—"
              : `${(costOfCapital.wacc * 100).toFixed(1)}%`,
          source: derived("CAPM עם beta מול S&P 500 וריבית מ-FRED"),
        },
        {
          label: "מרווח",
          value: `${spread > 0 ? "+" : ""}${spread.toFixed(1)} נק׳ אחוז`,
          source: derived("ROIC פחות WACC"),
        },
      ],
      horizon: "long",
    });
  }

  /* ---- Profitability and cash ---- */

  const operating = metric("operating_margin");
  const fcfMargin = metric("fcf_margin");

  if (operating?.value !== null && operating !== null) {
    const grade = gradeConfidence({
      evidenceCount: fcfMargin?.value !== null ? 2 : 1,
      ageDays: age,
      nearThreshold: Math.abs(operating.value!) < 2,
    });

    findings.push({
      id: "profitability",
      title:
        operating.value! > 0
          ? "הפעילות רווחית"
          : "הפעילות מפסידה ברמה התפעולית",
      body:
        operating.value! > 0
          ? "החברה מכסה את עלויות הפעילות מההכנסות שלה, לפני מימון ומס."
          : "ההוצאות התפעוליות גדולות מההכנסות. עסק במצב כזה תלוי בשוק ההון או ביתרת המזומן כדי להמשיך — וזו תלות שנעלמת בדיוק כשצריך אותה.",
      stance: stanceOf(operating.value, {
        good: (v) => v > 10,
        bad: (v) => v <= 0,
      }),
      confidence: grade.confidence,
      confidenceReason: grade.reason,
      evidence: [
        {
          label: "מרווח תפעולי",
          value: `${operating.value!.toFixed(1)}%`,
          source,
        },
        ...(fcfMargin?.value !== null && fcfMargin !== null
          ? [
              {
                label: "FCF Margin",
                value: `${fcfMargin.value!.toFixed(1)}%`,
                source,
              },
            ]
          : []),
      ],
    });
  } else {
    gaps.push("מרווח תפעולי אינו ניתן לחישוב מהדוחות.");
  }

  /* ---- Balance sheet ---- */

  const netDebt = metric("net_debt_ebitda");
  const current = metric("current_ratio");

  if (netDebt?.value !== null && netDebt !== null) {
    const grade = gradeConfidence({
      evidenceCount: current?.value !== null ? 2 : 1,
      ageDays: age,
      nearThreshold: Math.abs(netDebt.value! - 3) < 0.4,
    });

    findings.push({
      id: "balance-sheet",
      title:
        netDebt.value! > 3
          ? "מינוף פיננסי גבוה"
          : "המאזן אינו מגביל את החברה",
      body:
        netDebt.value! > 3
          ? `חוב נטו של פי ${netDebt.value!.toFixed(1)} מה-EBITDA. ברמה כזו רבעון חלש אחד מצמצם את מרחב התמרון, וכל מיחזור חוב מתייקר בסביבת ריבית גבוהה.`
          : `חוב נטו של פי ${netDebt.value!.toFixed(1)} מה-EBITDA — רמה שמשאירה לחברה מרחב פעולה גם ברבעון חלש.`,
      stance: stanceOf(netDebt.value, {
        good: (v) => v < 1.5,
        bad: (v) => v > 3,
      }),
      confidence: grade.confidence,
      confidenceReason: grade.reason,
      evidence: [
        {
          label: "חוב נטו / EBITDA",
          value: `${netDebt.value!.toFixed(1)}x`,
          source,
        },
        ...(current?.value !== null && current !== null
          ? [
              {
                label: "Current Ratio",
                value: `${current.value!.toFixed(1)}x`,
                source,
              },
            ]
          : []),
      ],
    });
  } else {
    gaps.push("יחס חוב נטו ל-EBITDA אינו ניתן לחישוב — ייתכן שאין חוב מדווח.");
  }

  /* ---- What the profit costs in ownership ---- */

  if (stockComp.shareCountChange === null) {
    gaps.push("אין די היסטוריה של ספירת מניות כדי לבדוק דילול.");
  } else {
    const change = stockComp.shareCountChange;
    const grade = gradeConfidence({
      evidenceCount: stockComp.shareOfFcf !== null ? 3 : 2,
      ageDays: age,
      nearThreshold: Math.abs(change) < 0.5,
    });

    findings.push({
      id: "dilution",
      title:
        change > 1
          ? "התגמול במניות מדלל את בעלי המניות"
          : change < -1
            ? "ספירת המניות מצטמצמת בפועל"
            : "הרכישות העצמיות סופגות דילול ולא מחזירות הון",
      body: stockComp.note,
      stance: stanceOf(change, { good: (v) => v < -1, bad: (v) => v > 1 }),
      confidence: grade.confidence,
      confidenceReason: grade.reason,
      evidence: [
        {
          label: "שינוי בספירת המניות",
          value: `${change > 0 ? "+" : "−"}${Math.abs(change).toFixed(1)}% ב-3 שנים`,
          source,
        },
        ...(stockComp.shareOfFcf !== null
          ? [
              {
                label: "תגמול במניות מתוך FCF",
                value: `${stockComp.shareOfFcf.toFixed(0)}%`,
                source,
              },
            ]
          : []),
      ],
      horizon: "long",
    });
  }

  /* ---- Working capital ---- */

  if (cashCycle.cycle !== null) {
    findings.push({
      id: "cash-cycle",
      title: cashCycle.financedBySuppliers
        ? "מחזור המזומנים שלילי"
        : `כל דולר כבול ${Math.round(cashCycle.cycle)} ימים`,
      body: cashCycle.note,
      stance: stanceOf(cashCycle.cycle, {
        good: (v) => v < 30,
        bad: (v) => v > 120,
      }),
      confidence: "medium",
      confidenceReason:
        "מחושב מיתרות מאזניות לסוף תקופה, שיכולות להיות עונתיות.",
      evidence: [
        {
          label: "מחזור המרת מזומנים",
          value: `${cashCycle.cycle.toFixed(0)} ימים`,
          source,
        },
      ],
      horizon: "medium",
    });
  }

  /* ---- Operating leverage ---- */

  if (leverage.turning === "inflecting" || leverage.turning === "eroding") {
    findings.push({
      id: "operating-leverage",
      title:
        leverage.turning === "inflecting"
          ? "המינוף התפעולי בנקודת מפנה"
          : "הצמיחה החדשה פחות רווחית מהקיימת",
      body: leverage.note,
      stance: leverage.turning === "inflecting" ? "supports" : "opposes",
      confidence: "medium",
      confidenceReason:
        "מבוסס על שינוי בין שתי שנים בלבד, ושנה חריגה אחת מזיזה את התוצאה.",
      evidence: [
        {
          label: "מרווח על ההכנסה השולית",
          value:
            leverage.incrementalMargin === null
              ? "—"
              : `${leverage.incrementalMargin.toFixed(0)}%`,
          source: derived("שינוי ברווח תפעולי חלקי שינוי בהכנסות"),
        },
        {
          label: "מרווח תפעולי נוכחי",
          value:
            leverage.currentMargin === null
              ? "—"
              : `${leverage.currentMargin.toFixed(0)}%`,
          source,
        },
      ],
      horizon: "medium",
    });
  }

  if (fundamentals.stale) {
    gaps.push(
      "הדוח האחרון בן יותר מ-120 יום — כל ממצא כאן מתאר תקופה שהסתיימה.",
    );
  }

  return {
    agent: "financial",
    label: "אנליסט פיננסי",
    findings,
    gaps,
  };
}
