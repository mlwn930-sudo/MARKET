import type { SourceRef } from "@/lib/agents/types";
import type { Grade, GradedClaim } from "./confidence";

/**
 * The unit of the intelligence layer.
 *
 * Every conclusion this layer produces — a thesis change, a transmission
 * from rates to a sector, a reason a stock moved, an earnings surprise —
 * is a Signal, and they all carry the same four things:
 *
 *   what happened      one sentence, no hedging
 *   why it matters     the consequence, or it does not get published
 *   the grade          how much evidence stands behind the claim
 *   the evidence       every figure, with its source and date
 *
 * The evidence array is the point. A signal that says "momentum shift"
 * and cannot be opened into the price, the volume, the sector and the
 * indicator behind it is a horoscope. Opening it is a UI affordance; the
 * data being there is a contract, and this type is where the contract
 * lives — `evidence` is not optional and an empty array is a bug, not an
 * edge case.
 *
 * `materiality` is the other half. The site watches forty-eight companies
 * across nine sectors and a macro board; if everything it noticed were
 * shown, the reader would be handed a log instead of a briefing. Every
 * surface that lists signals sorts by this and cuts somewhere.
 */

export type SignalKind =
  /** The thesis for a company no longer says what it said. */
  | "thesis-change"
  /** A filing or a report landed and changed a measured figure. */
  | "earnings"
  /** A macro variable moved and the chain reaches a sector. */
  | "transmission"
  /** Something specific to one company: a story graded as a catalyst. */
  | "company-news"
  /** A price move large enough to be worth explaining. */
  | "price-move"
  /** A measured risk got worse or better. */
  | "risk"
  /** Something with a date the reader can wait for. */
  | "catalyst"
  /** What the price implies drifted away from what was reported. */
  | "valuation";

export const SIGNAL_KIND_LABELS: Record<SignalKind, string> = {
  "thesis-change": "שינוי בתזה",
  earnings: "דוח",
  transmission: "שרשרת מאקרו",
  "company-news": "חדשה על החברה",
  "price-move": "תנועת מחיר",
  risk: "סיכון",
  catalyst: "זרז",
  valuation: "תמחור",
};

export type SignalEvidence = {
  label: string;
  /** Already formatted. The producer owns its own units. */
  value: string;
  source: SourceRef;
  /** What this particular figure contributes to the claim. */
  note?: string;
};

export type Signal = {
  /** Stable within a build, so a list can be keyed and a card linked. */
  id: string;
  kind: SignalKind;
  /** What happened. One sentence. */
  headline: string;
  /** Why it matters. Required — a signal that cannot say this is noise
   *  that got through the filter. */
  soWhat: string;
  claim: GradedClaim;
  evidence: SignalEvidence[];
  /**
   * 0–100. Not a score of how good the news is — a score of how much it
   * should displace something else on a screen.
   */
  materiality: number;
  ticker?: string;
  sector?: string;
  href?: string;
  /** When the underlying thing happened, not when this was computed. */
  at: string;
};

/* ------------------------------------------------------------------ */
/* Materiality                                                         */
/* ------------------------------------------------------------------ */

/**
 * The base weight of each kind of event.
 *
 * Written down rather than decided per call site, because the whole value
 * of a materiality number is that a thesis change and a 4% day are scored
 * on the same scale by the same rule. These are the project's priorities
 * in one table: something that changes what the reader believes outranks
 * something that changes what the reader sees.
 */
const BASE: Record<SignalKind, number> = {
  "thesis-change": 85,
  earnings: 75,
  valuation: 55,
  risk: 55,
  "company-news": 50,
  transmission: 45,
  "price-move": 40,
  catalyst: 35,
};

/** Evidence grade moves the score, because a speculative claim should not
 *  outrank a confirmed one purely on its category. */
const GRADE_WEIGHT: Record<Grade, number> = {
  confirmed: 12,
  likely: 4,
  possible: -6,
  speculative: -18,
};

export function materialityOf({
  kind,
  grade,
  /** How unusual the magnitude is, 0–1. A 6% day scores higher than a 2%
   *  day of the same kind. */
  magnitude = 0,
  /** True when the reader follows this company. Personal relevance is a
   *  real input: the same filing matters more to someone holding it. */
  watched = false,
}: {
  kind: SignalKind;
  grade: Grade;
  magnitude?: number;
  watched?: boolean;
}): number {
  const score =
    BASE[kind] +
    GRADE_WEIGHT[grade] +
    Math.max(0, Math.min(magnitude, 1)) * 15 +
    (watched ? 10 : 0);

  return Math.max(0, Math.min(Math.round(score), 100));
}

/** Loudest first. Ties break towards the more recent event. */
export function byMateriality(a: Signal, b: Signal): number {
  if (b.materiality !== a.materiality) return b.materiality - a.materiality;
  return b.at.localeCompare(a.at);
}

/**
 * The cut.
 *
 * A briefing that lists everything is a log, and a log is what the reader
 * came here to avoid. The floor is deliberately high enough that a quiet
 * day produces a short briefing — and a short briefing on a quiet day is
 * the correct output, not a failure to find something.
 */
export const MATERIAL_FLOOR = 45;

export function material(signals: Signal[], floor = MATERIAL_FLOOR): Signal[] {
  return signals.filter((signal) => signal.materiality >= floor).sort(byMateriality);
}
