/**
 * The contract every agent answers to.
 *
 * The whole point of the shape below is that a finding cannot exist without
 * the thing that produced it. There is no field for a bare assertion: a
 * finding carries its evidence, its evidence carries its source, and its
 * source carries a date. An agent that wants to say something it cannot
 * support has nowhere to put it, which is the only reliable way to stop a
 * system like this drifting into confident invention.
 *
 * Two rules follow from that and are not negotiable.
 *
 * Missing data is reported as missing. An agent that cannot evaluate
 * something records it in `gaps` and returns no finding. It never reasons
 * from an absence — "no debt disclosed" is not "no debt".
 *
 * Confidence is explained, not asserted. Every finding says why it is as
 * confident as it is, because "medium confidence" on its own is a decoration.
 */

export type Confidence = "high" | "medium" | "low";

/** Where a number came from. Attached to every piece of evidence. */
export type SourceRef = {
  origin: "SEC" | "Finnhub" | "Yahoo" | "FRED" | "חישוב";
  /** The date the underlying data describes, not when we fetched it. */
  asOf: string | null;
  note?: string;
};

export type Evidence = {
  label: string;
  /** Already formatted for display — the agent owns its own units. */
  value: string;
  source: SourceRef;
};

/**
 * Which way a finding points.
 *
 * Deliberately not "positive/negative". A finding supports or opposes a
 * *thesis*; whether that is good news depends on which side of the position
 * the reader is on, and the site does not know that.
 */
export type Stance = "supports" | "opposes" | "neutral" | "unknown";

export type Finding = {
  id: string;
  title: string;
  /** One or two sentences in Hebrew, explaining the mechanism. */
  body: string;
  stance: Stance;
  confidence: Confidence;
  /** Why the confidence is what it is. Required. */
  confidenceReason: string;
  evidence: Evidence[];
  /** Which horizon this bears on, when it is specific to one. */
  horizon?: "short" | "medium" | "long";
};

export type AgentReport = {
  /** Stable id, used by the audit trail. */
  agent: string;
  label: string;
  findings: Finding[];
  /**
   * What this agent could not evaluate, and why. Shown to the reader
   * rather than hidden: a gap is information about the limits of the
   * analysis, and concealing it makes the rest look more complete than it
   * is.
   */
  gaps: string[];
};

/* ------------------------------------------------------------------ */
/* Helpers                                                             */
/* ------------------------------------------------------------------ */

export const sec = (asOf: string | null, note?: string): SourceRef => ({
  origin: "SEC",
  asOf,
  note,
});

export const finnhub = (asOf: string | null, note?: string): SourceRef => ({
  origin: "Finnhub",
  asOf,
  note,
});

export const yahoo = (asOf: string | null, note?: string): SourceRef => ({
  origin: "Yahoo",
  asOf,
  note,
});

export const derived = (note: string): SourceRef => ({
  origin: "חישוב",
  asOf: null,
  note,
});

/** The stance a numeric comparison implies, or unknown when it cannot be
 *  computed. Keeps every agent from writing the same three-way branch. */
export function stanceOf(
  value: number | null | undefined,
  { good, bad }: { good: (v: number) => boolean; bad: (v: number) => boolean },
): Stance {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "unknown";
  }
  if (good(value)) return "supports";
  if (bad(value)) return "opposes";
  return "neutral";
}

/**
 * Confidence from how much the finding rests on.
 *
 * Three inputs, because they are the three ways a finding here gets weaker:
 * the data is old, there is only one measurement behind it, or the figure
 * sits close enough to the threshold that a small revision would flip it.
 */
export function gradeConfidence({
  evidenceCount,
  ageDays,
  nearThreshold,
}: {
  evidenceCount: number;
  ageDays: number | null;
  nearThreshold?: boolean;
}): { confidence: Confidence; reason: string } {
  const reasons: string[] = [];
  let score = 2; // medium

  if (evidenceCount >= 3) {
    score++;
    reasons.push(`${evidenceCount} נתונים תומכים`);
  } else if (evidenceCount <= 1) {
    score--;
    reasons.push("נשען על נתון בודד");
  }

  if (ageDays !== null) {
    if (ageDays > 180) {
      score--;
      reasons.push(`הדוח בן ${Math.round(ageDays / 30)} חודשים`);
    } else if (ageDays <= 100) {
      reasons.push("מבוסס על הדוח האחרון");
    }
  }

  if (nearThreshold) {
    score--;
    reasons.push("הערך קרוב לסף, ותיקון קטן היה הופך את התשובה");
  }

  const confidence: Confidence =
    score >= 3 ? "high" : score <= 1 ? "low" : "medium";

  return {
    confidence,
    reason: reasons.length > 0 ? reasons.join(" · ") : "הערכה סטנדרטית",
  };
}

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  high: "ודאות גבוהה",
  medium: "ודאות בינונית",
  low: "ודאות נמוכה",
};

export const STANCE_LABELS: Record<Stance, string> = {
  supports: "תומך",
  opposes: "מתנגד",
  neutral: "ניטרלי",
  unknown: "לא ניתן לקבוע",
};

/** Days between a reported date and now. Null when there is no date. */
export function ageInDays(asOf: string | null | undefined): number | null {
  if (!asOf) return null;
  const then = Date.parse(asOf);
  if (!Number.isFinite(then)) return null;
  return (Date.now() - then) / 86_400_000;
}
