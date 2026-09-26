import type { CompanyIntelligence } from "@/lib/agents";
import type { Confidence } from "@/lib/agents/types";
import type { ThesisStatus } from "@/lib/agents/synthesis";
import type { Fundamentals } from "@/lib/metrics/fundamentals";
import { materialityOf, type Signal, type SignalEvidence } from "./signals";
import type { Grade, GradedClaim } from "./confidence";

/**
 * What the site used to think, and whether it still thinks it.
 *
 * Every other surface here describes the present. This one is the only
 * part of the product with a memory, and it exists because the most useful
 * sentence a research tool can produce is not "the thesis is X" — it is
 * "the thesis used to be X and is now Y, and here is the filing that
 * changed it".
 *
 * Two rules keep that from becoming noise.
 *
 * **A change is only reported when the inputs changed.** A thesis whose
 * wording drifted because an agent ordered its findings differently is not
 * a thesis change. The fingerprint below captures the *inputs* — the
 * status, the verdict counts, the quadrant, the conditions, the breakers
 * and a handful of measured figures — and the diff runs on those.
 *
 * **The cause is classified, not assumed.** A status that moved because a
 * new 10-Q landed is a different event from one that moved because the
 * price rose and the multiple with it. The first says the business
 * changed; the second says only the price did. Collapsing them is how a
 * tool ends up announcing "thesis change" every time a stock has a good
 * week, and after the third time nobody reads it.
 */

/* ------------------------------------------------------------------ */
/* The fingerprint                                                     */
/* ------------------------------------------------------------------ */

/** The measured figures a thesis genuinely rests on. Keys are the ones
 *  `metrics/fundamentals.ts` already produces — this module defines no
 *  formula of its own, which is rule 4 of the project. */
const TRACKED = [
  "pe",
  "ev_ebitda",
  "operating_margin",
  "fcf_margin",
  "rev_cagr_3",
  "roic",
  "net_debt_ebitda",
] as const;

type TrackedKey = (typeof TRACKED)[number];

const METRIC_LABELS: Record<TrackedKey, string> = {
  pe: "P/E",
  ev_ebitda: "EV/EBITDA",
  operating_margin: "מרווח תפעולי",
  fcf_margin: "מרווח תזרים חופשי",
  rev_cagr_3: "צמיחת הכנסות 3ש׳",
  roic: "ROIC",
  net_debt_ebitda: "חוב נטו / EBITDA",
};

export type ThesisFingerprint = {
  ticker: string;
  /** When the snapshot was taken. */
  at: string;
  status: ThesisStatus;
  headline: string;
  confidence: Confidence;
  verdict: {
    passed: number;
    evaluated: number;
    corePassed: number;
    coreEvaluated: number;
  };
  quadrant: { businessQuality: string; priceLevel: string; verdict: string };
  conditions: string[];
  breakers: string[];
  metrics: Partial<Record<TrackedKey, number | null>>;
  /** The filing period the thesis was built on. This is what separates a
   *  business change from a price change. */
  filingEnd: string | null;
};

function metricOf(fundamentals: Fundamentals, key: string): number | null {
  for (const group of fundamentals.groups) {
    const found = group.metrics.find((metric) => metric.key === key);
    if (found) return found.value;
  }
  return null;
}

export function fingerprint(
  ticker: string,
  intelligence: CompanyIntelligence,
  fundamentals: Fundamentals,
): ThesisFingerprint {
  const metrics: Partial<Record<TrackedKey, number | null>> = {};
  for (const key of TRACKED) metrics[key] = metricOf(fundamentals, key);

  return {
    ticker: ticker.toUpperCase(),
    at: new Date().toISOString(),
    status: intelligence.thesis.status,
    headline: intelligence.thesis.headline,
    confidence: intelligence.thesis.confidence,
    verdict: {
      passed: intelligence.verdict.passed,
      evaluated: intelligence.verdict.evaluated,
      corePassed: intelligence.verdict.corePassed,
      coreEvaluated: intelligence.verdict.coreEvaluated,
    },
    quadrant: {
      businessQuality: intelligence.quadrant.businessQuality,
      priceLevel: intelligence.quadrant.priceLevel,
      verdict: intelligence.quadrant.verdict,
    },
    conditions: intelligence.thesis.conditions,
    breakers: intelligence.thesis.breakers,
    metrics,
    filingEnd: fundamentals.asOf?.end ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* The diff                                                            */
/* ------------------------------------------------------------------ */

export type ThesisDelta = {
  field: string;
  before: string;
  after: string;
  /** Contribution to how much this change matters, 0–1. */
  weight: number;
};

/**
 * What moved the thesis.
 *
 * `filing` — a new report landed, so the measured inputs genuinely changed.
 * `price` — the same report, a different market price; the multiple moved
 *           and nothing about the business did.
 * `both`  — a new report *and* a repricing.
 * `wording` — neither changed, so this is not a thesis change and is not
 *           published.
 */
export type ChangeDriver = "filing" | "price" | "both" | "wording";

export const DRIVER_LABELS: Record<ChangeDriver, string> = {
  filing: "דוח חדש",
  price: "תמחור בלבד",
  both: "דוח חדש ותמחור",
  wording: "ניסוח בלבד",
};

export type ThesisChange = {
  ticker: string;
  companyName: string;
  from: string;
  to: string;
  driver: ChangeDriver;
  /** The previous position, in one sentence. */
  oldView: string;
  newView: string;
  /** Why it changed. One line per reason, each pointing at a delta. */
  why: string[];
  deltas: ThesisDelta[];
  evidence: SignalEvidence[];
  claim: GradedClaim;
  materiality: number;
};

const STATUS_WORDS: Record<ThesisStatus, string> = {
  positive: "תזה חיובית",
  watch: "במעקב — דורש אישור",
  "high-risk": "סיכון גבוה",
  negative: "תזה שלילית",
  insufficient: "אין די נתונים",
};

const QUALITY_WORDS: Record<string, string> = {
  strong: "חזק",
  weak: "חלש",
  mixed: "מעורב",
  unknown: "לא ידוע",
};

const PRICE_WORDS: Record<string, string> = {
  cheap: "נמוך",
  rich: "גבוה",
  fair: "סביר",
  unknown: "לא ידוע",
};

/** A metric has to move by more than this to count. Below it, the change
 *  is the denominator wobbling — a P/E recomputed on a price that moved
 *  1% is not news about the company. */
const METRIC_NOISE = 8;

function fmt(key: TrackedKey, value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (key === "pe" || key === "ev_ebitda" || key === "net_debt_ebitda") {
    return `${value.toFixed(1)}x`;
  }
  return `${value.toFixed(1)}%`;
}

/** Items in `next` that were not in `prev`, and the reverse. */
function setDiff(prev: string[], next: string[]) {
  const before = new Set(prev);
  const after = new Set(next);
  return {
    added: next.filter((item) => !before.has(item)),
    removed: prev.filter((item) => !after.has(item)),
  };
}

export function diffThesis(
  previous: ThesisFingerprint,
  current: ThesisFingerprint,
  companyName: string,
): ThesisChange | null {
  const deltas: ThesisDelta[] = [];
  const why: string[] = [];

  /* ---- The headline state ---- */
  if (previous.status !== current.status) {
    deltas.push({
      field: "מצב התזה",
      before: STATUS_WORDS[previous.status],
      after: STATUS_WORDS[current.status],
      weight: 1,
    });
    why.push(
      `מצב התזה עבר מ״${STATUS_WORDS[previous.status]}״ ל״${STATUS_WORDS[current.status]}״.`,
    );
  }

  /* ---- The Core Test ---- */
  if (previous.verdict.passed !== current.verdict.passed) {
    deltas.push({
      field: "בדיקות שעברו",
      before: `${previous.verdict.passed}/${previous.verdict.evaluated}`,
      after: `${current.verdict.passed}/${current.verdict.evaluated}`,
      weight: 0.6,
    });
    const direction =
      current.verdict.passed > previous.verdict.passed ? "עלה" : "ירד";
    why.push(
      `מספר הבדיקות שהחברה עוברת ${direction} מ-${previous.verdict.passed} ל-${current.verdict.passed}.`,
    );
  }

  if (previous.verdict.corePassed !== current.verdict.corePassed) {
    deltas.push({
      field: "בדיקות ליבה",
      before: `${previous.verdict.corePassed}/${previous.verdict.coreEvaluated}`,
      after: `${current.verdict.corePassed}/${current.verdict.coreEvaluated}`,
      weight: 0.8,
    });
  }

  /* ---- Business or price ---- */
  if (previous.quadrant.businessQuality !== current.quadrant.businessQuality) {
    deltas.push({
      field: "איכות העסק",
      before: QUALITY_WORDS[previous.quadrant.businessQuality] ?? "—",
      after: QUALITY_WORDS[current.quadrant.businessQuality] ?? "—",
      weight: 0.9,
    });
    why.push("האבחנה בין העסק למחיר השתנתה בצד של העסק.");
  }

  if (previous.quadrant.priceLevel !== current.quadrant.priceLevel) {
    deltas.push({
      field: "רמת המחיר",
      before: PRICE_WORDS[previous.quadrant.priceLevel] ?? "—",
      after: PRICE_WORDS[current.quadrant.priceLevel] ?? "—",
      weight: 0.5,
    });
    why.push("רמת המחיר מול הסקטור וההיסטוריה עברה קטגוריה.");
  }

  /* ---- The measured figures ---- */
  for (const key of TRACKED) {
    const before = previous.metrics[key];
    const after = current.metrics[key];
    if (
      before === null ||
      before === undefined ||
      after === null ||
      after === undefined ||
      !Number.isFinite(before) ||
      !Number.isFinite(after) ||
      before === 0
    ) {
      continue;
    }

    const movePercent = Math.abs((after - before) / Math.abs(before)) * 100;
    if (movePercent < METRIC_NOISE) continue;

    deltas.push({
      field: METRIC_LABELS[key],
      before: fmt(key, before),
      after: fmt(key, after),
      weight: 0.4,
    });
  }

  /* ---- What has to go right, and what would break it ---- */
  const conditions = setDiff(previous.conditions, current.conditions);
  const breakers = setDiff(previous.breakers, current.breakers);

  for (const item of breakers.added) {
    deltas.push({ field: "שובר תזה חדש", before: "—", after: item, weight: 0.7 });
    why.push(`נוסף גורם שיכול לשבור את התזה: ${item}`);
  }
  for (const item of breakers.removed) {
    deltas.push({ field: "שובר תזה שהוסר", before: item, after: "—", weight: 0.5 });
  }
  for (const item of conditions.added) {
    deltas.push({ field: "תנאי חדש", before: "—", after: item, weight: 0.4 });
  }

  if (deltas.length === 0) return null;

  /* ---- What drove it ---- */
  const newFiling =
    previous.filingEnd !== null &&
    current.filingEnd !== null &&
    previous.filingEnd !== current.filingEnd;

  /* A repricing shows up as the two multiples moving while the operating
     figures stand still — the same report, a different market price. */
  const repriced = (["pe", "ev_ebitda"] as const).some((key) =>
    deltas.some((delta) => delta.field === METRIC_LABELS[key]),
  );
  const operatingMoved = (["operating_margin", "fcf_margin", "rev_cagr_3", "roic"] as const).some(
    (key) => deltas.some((delta) => delta.field === METRIC_LABELS[key]),
  );

  const driver: ChangeDriver = newFiling
    ? repriced
      ? "both"
      : "filing"
    : repriced && !operatingMoved
      ? "price"
      : deltas.some((delta) => delta.weight >= 0.6)
        ? "filing"
        : "wording";

  /* A change the site cannot attribute to either a filing or a repricing
     is a change in wording, and wording is not news. */
  if (driver === "wording") return null;

  /* ---- The grade ----
     A new filing makes the *inputs* a matter of record: the figures moved
     because the company reported them moving. A repricing is equally
     factual, but calling the resulting thesis change a change in the
     business would be wrong, so it is graded down and named. */
  const grade: Grade = newFiling ? "confirmed" : "likely";

  const evidence: SignalEvidence[] = [
    {
      label: "מצב התזה",
      value: `${STATUS_WORDS[previous.status]} ← ${STATUS_WORDS[current.status]}`,
      source: { origin: "חישוב", asOf: current.at.slice(0, 10) },
      note: "נגזר מהממצאים של הסוכנים, לא נכתב ידנית",
    },
    {
      label: "הדוח שעליו נשענת התזה",
      value: current.filingEnd
        ? newFiling
          ? `${previous.filingEnd} ← ${current.filingEnd}`
          : current.filingEnd
        : "—",
      source: { origin: "SEC", asOf: current.filingEnd },
      note: newFiling
        ? "דוח חדש הוגש מאז המדידה הקודמת"
        : "אותו דוח — מה שהשתנה אינו הנתון המדווח",
    },
    ...deltas.slice(0, 6).map((delta) => ({
      label: delta.field,
      value: `${delta.before} ← ${delta.after}`,
      source: { origin: "חישוב" as const, asOf: current.filingEnd },
    })),
  ];

  const weight = Math.min(
    deltas.reduce((total, delta) => total + delta.weight, 0) / 2.5,
    1,
  );

  return {
    ticker: current.ticker,
    companyName,
    from: previous.at,
    to: current.at,
    driver,
    oldView: previous.headline,
    newView: current.headline,
    why:
      why.length > 0
        ? why
        : ["המדדים שהתזה נשענת עליהם זזו מספיק כדי לשנות את הניסוח שלה."],
    deltas,
    evidence,
    claim: {
      grade,
      basis: newFiling
        ? `דוח חדש לתקופה שמסתיימת ב-${current.filingEnd}, ו-${deltas.length} מדדים שזזו מעבר לסף הרעש`
        : `${deltas.length} מדדים שזזו מעבר לסף הרעש, על אותו דוח`,
      limits:
        driver === "price"
          ? "מה שהשתנה הוא המחיר, לא העסק. אותו דוח, מכפיל אחר — וזו אמירה על מה שהשוק מוכן לשלם, לא על מה שהחברה עשתה."
          : "שינוי בתזה אינו תחזית ואינו המלצה. הוא אומר שהנתונים שהמסקנה הקודמת נשענה עליהם כבר לא אותם נתונים.",
    },
    materiality: materialityOf({
      kind: "thesis-change",
      grade,
      magnitude: weight,
    }),
  };
}

/** The change, as a signal for the briefing. */
export function thesisChangeSignal(change: ThesisChange): Signal {
  return {
    id: `thesis:${change.ticker}:${change.to}`,
    kind: "thesis-change",
    headline: `${change.companyName} — ${change.deltas[0].field}: ${change.deltas[0].before} ← ${change.deltas[0].after}`,
    soWhat: change.why[0],
    claim: change.claim,
    evidence: change.evidence,
    materiality: change.materiality,
    ticker: change.ticker,
    href: `/company/${change.ticker}`,
    at: change.to,
  };
}
