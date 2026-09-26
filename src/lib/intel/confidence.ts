/**
 * How much the site is allowed to claim.
 *
 * The intelligence layer connects things — a rate move to a sector, a
 * filing to a thesis, a headline to a price. Every one of those
 * connections is a causal claim, and a causal claim is exactly the kind of
 * sentence a financial site writes carelessly: "NVDA fell on profit
 * taking" is a story that fits any Tuesday.
 *
 * So nothing in this layer may assert a connection without saying what
 * grade of evidence stands behind it. Four grades, and they are not
 * decoration — they are defined by what kind of measurement exists, and
 * the definition is what stops the scale drifting until everything is
 * "likely".
 *
 *   CONFIRMED    The claim restates a fact. It is in a filing, in a
 *                company statement, or it is a print that was measured.
 *                "Revenue grew 12%" from a 10-Q is confirmed. Nothing
 *                about *why* is ever confirmed.
 *
 *   LIKELY       A measurement is strong enough that the alternative needs
 *                explaining. The index moved 1.8% and the stock moved 2.0%
 *                the same way: the market explains most of this, and a
 *                company-specific story would have to account for why the
 *                stock did *not* move more.
 *
 *   POSSIBLE     A measurement is consistent with the claim but does not
 *                distinguish it from the others. A story was published
 *                today and the stock moved; so did four hundred other
 *                stories.
 *
 *   SPECULATIVE  A mechanism with no measurement behind it today. It may
 *                be a good mechanism — rates rising should compress long
 *                duration valuations — but nothing here has measured it
 *                happening in this instance.
 *
 * Every graded claim carries `basis` (the measurement it rests on) and
 * `limits` (what it does not prove). Both are required. A grade without a
 * basis is a confidence score, and a confidence score is the thing this
 * module exists to avoid.
 */

export type Grade = "confirmed" | "likely" | "possible" | "speculative";

export const GRADE_LABELS: Record<Grade, string> = {
  confirmed: "מאושש",
  likely: "סביר",
  possible: "אפשרי",
  speculative: "השערה",
};

/**
 * What each grade means, in the reader's language.
 *
 * Shown in the interface beside the grade rather than kept here as a
 * comment. A four-level scale that is never defined on screen is a scale
 * the reader invents their own meaning for.
 */
export const GRADE_MEANING: Record<Grade, string> = {
  confirmed:
    "הטענה חוזרת על עובדה שדווחה או נמדדה. לא מדובר בהסבר לסיבה — סיבה לעולם אינה מאוששת.",
  likely:
    "יש מדידה שחזקה מספיק כדי שההסבר החלופי ידרוש הצדקה משלו.",
  possible:
    "יש מדידה שמתיישבת עם הטענה, אבל היא מתיישבת גם עם הסברים אחרים.",
  speculative:
    "יש מנגנון הגיוני ואין לו מדידה במקרה הזה. מוצג כדי שיהיה אפשר לחפש אותו, לא כדי להסתמך עליו.",
};

const ORDER: Record<Grade, number> = {
  confirmed: 3,
  likely: 2,
  possible: 1,
  speculative: 0,
};

export function isAtLeast(grade: Grade, floor: Grade): boolean {
  return ORDER[grade] >= ORDER[floor];
}

/** Strongest first — the order a reader should meet a list of claims in. */
export function byGrade<T extends { grade: Grade }>(a: T, b: T): number {
  return ORDER[b.grade] - ORDER[a.grade];
}

/**
 * The weakest grade in a chain.
 *
 * A chain of reasoning is exactly as good as its weakest link, and
 * averaging grades is how a speculative step disappears into a list of
 * confirmed ones. The macro-to-company chain is the reason this exists:
 * "rates rose" is confirmed, "semiconductors are rate-sensitive" is a
 * mechanism, and the chain as a whole is the second one.
 */
export function weakestGrade(grades: Grade[]): Grade {
  if (grades.length === 0) return "speculative";
  return grades.reduce((lowest, grade) =>
    ORDER[grade] < ORDER[lowest] ? grade : lowest,
  );
}

/**
 * A claim that knows what it rests on.
 *
 * Used everywhere in this layer. The shape is the argument: there is no
 * field for a bare assertion, and `limits` is not optional — a claim that
 * cannot say what it fails to prove has not been thought about.
 */
export type GradedClaim = {
  grade: Grade;
  /** The measurement behind it, with its figure. */
  basis: string;
  /** What this does not establish. Required. */
  limits: string;
};

/**
 * Grades a proportional explanation.
 *
 * The common case in this layer: something accounts for a share of an
 * observed move. The thresholds are stated rather than tuned — 60% of a
 * move is where an explanation stops being one candidate among several,
 * and 25% is where it stops being worth mentioning as a cause at all.
 */
export function gradeByShare(share: number | null): Grade {
  if (share === null || !Number.isFinite(share)) return "speculative";
  if (share >= 0.6) return "likely";
  if (share >= 0.25) return "possible";
  return "speculative";
}

/**
 * Grades a same-direction association between two series measured today.
 *
 * Direction agreement alone is never better than "possible": on a day the
 * whole market rises, every sector rises with it, and the agreement
 * carries almost no information. Size is what adds something — a sector
 * that moved three times the index moved for its own reasons.
 */
export function gradeByCoMovement(
  subject: number | null,
  reference: number | null,
): Grade {
  if (
    subject === null ||
    reference === null ||
    !Number.isFinite(subject) ||
    !Number.isFinite(reference) ||
    reference === 0
  ) {
    return "speculative";
  }

  const sameWay = subject * reference > 0;
  if (!sameWay) return "speculative";

  return gradeByShare(Math.min(Math.abs(reference / subject), 1));
}
