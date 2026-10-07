/**
 * How much a finding is worth a reader's attention, and why.
 *
 * Three levels, because that is what a person can act on in an inbox:
 * something to look at now, something to know, and something that is true
 * but ordinary. A digest where every line looks equally urgent is a digest
 * read once.
 *
 * THE LEVEL IS EARNED, NOT ASSIGNED. The obvious implementation is to cut
 * the existing weight into thirds and print a word next to each band,
 * which would be a relabelled sort order wearing the authority of a
 * judgement. What decides it here is what the site actually measured:
 *
 *   how RARE the event is on this instrument — a condition that fires
 *   forty times a year is not news whatever it is called, and one that
 *   has fired nine times in a decade is;
 *
 *   whether its measured track record says anything — the distance
 *   between the conditional rate and the instrument's own baseline, which
 *   is the only number in this project that is about the SIGNAL rather
 *   than about the stock;
 *
 *   and how far outside normal the move itself was, in the instrument's
 *   own distribution rather than in percent.
 *
 * A finding with no measurement behind it cannot reach the top level. It
 * is not being punished — a news story has no base rate and never will —
 * it is that "very relevant" has to mean something, and on this site the
 * only thing it can honestly mean is that the site measured it and the
 * measurement was not flat.
 *
 * AND THE REASON TRAVELS WITH THE LEVEL. `why` is rendered beside the
 * label in the email, so a reader is never asked to accept a ranking they
 * cannot check. That is rule 8 applied to a sort order: handing somebody a
 * verdict without its argument is the thing this project does not do.
 */

export type Relevance = "high" | "medium" | "low";

export const RELEVANCE_LABELS: Record<Relevance, string> = {
  high: "רלוונטי מאוד",
  medium: "רלוונטי",
  low: "לא כזה רלוונטי",
};

/** Ordered for sorting: the top of a digest is what was measured to
 *  matter, not what happens to have the largest raw weight. */
export const RELEVANCE_ORDER: Record<Relevance, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export type RelevanceInput = {
  /** How many times this condition has fired on this instrument in the
   *  measured window. Undefined for a finding with no counted history,
   *  such as a news story. */
  occurrences?: number | null;
  /** Trading days the occurrences were counted over. */
  sessions?: number | null;
  /** Conditional rate minus the instrument's own baseline, in percentage
   *  points. The only figure here that is about the signal. */
  liftPp?: number | null;
  /** Observations behind that lift. Under the sample floor it is not a
   *  rate and must not lift anything. */
  sampleSize?: number | null;
  /** How far outside normal the move was, in standard deviations of the
   *  instrument's own daily range. */
  sigma?: number | null;
  /** Where the triggering volume ranked in the instrument's trailing
   *  year, 0..1. */
  volumePercentile?: number | null;

  /* ---- For a story, where the measurement is the model's reading ----

     A news item has no base rate and never will: it happened once. What
     it does have is the reading the site already produces for every
     article through its three lenses, and that reading answers exactly
     the question a tier is for. `catalystKind` is the model saying
     whether the story changes anything or is noise; `significance` is how
     far it reaches. Using them is better than inventing a second opinion
     here, and it means the tier in the inbox and the badge on the site
     cannot disagree about the same story. */
  catalystKind?: "catalyst" | "noise" | "unclear" | null;
  significance?: "high" | "medium" | "low" | null;
  /** The sentence the model wrote explaining that judgement, carried so
   *  the tier can show its reasoning instead of asserting itself. */
  catalystNote?: string | null;
};

export type RelevanceRead = {
  level: Relevance;
  /** Why it landed there, in the reader's language, naming the number
   *  that decided it. */
  why: string;
};

/** Under this, a share is not a rate — the same floor `base-rates.ts`
 *  applies, restated here rather than imported so this module stays free
 *  of a dependency it would otherwise only need for one constant. */
const MIN_SAMPLE = 8;

/** A measured distance from baseline at or above this is the project's
 *  own standing definition of "the condition added information". Below
 *  it, every panel on the site says so in words, and so does this. */
const MEANINGFUL_LIFT = 10;

/** Roughly one firing a quarter over ten years. More often than this and
 *  the event is a feature of the instrument rather than news about it. */
const RARE_PER_YEAR = 4;

/** Three standard deviations. A day outside this is not a big move, it is
 *  a different kind of day. */
const EXTREME_SIGMA = 3;

/** Top two per cent of the year's volume. */
const EXTREME_VOLUME = 0.98;

export function readRelevance(input: RelevanceInput): RelevanceRead {
  const reasons: string[] = [];
  let level: Relevance = "low";

  const { occurrences, sessions, liftPp, sampleSize, sigma, volumePercentile } =
    input;

  /* ---- The measured track record, which is the strongest thing here ---- */
  const hasRate =
    liftPp !== null &&
    liftPp !== undefined &&
    sampleSize !== null &&
    sampleSize !== undefined &&
    sampleSize >= MIN_SAMPLE;

  if (hasRate && Math.abs(liftPp!) >= MEANINGFUL_LIFT) {
    level = "high";
    reasons.push(
      `הפרש של ${liftPp! > 0 ? "+" : ""}${Math.round(liftPp!)} נקודות מול שיעור הבסיס של הנייר, על ${sampleSize} מופעים`,
    );
  } else if (hasRate) {
    /* Measured and flat. This is the common case and the honest one: the
       condition happened, the site counted what followed it, and the
       answer was nothing in particular. */
    level = "low";
    reasons.push(
      `נמדד על ${sampleSize} מופעים והפרש מול הבסיס קטן מ-${MEANINGFUL_LIFT} נקודות — התנאי לא הוסיף מידע`,
    );
  }

  /* ---- Rarity, which can lift a finding on its own ---- */
  if (
    occurrences !== null &&
    occurrences !== undefined &&
    sessions !== null &&
    sessions !== undefined &&
    sessions > 250
  ) {
    const years = sessions / 252;
    const perYear = occurrences / years;
    if (perYear <= RARE_PER_YEAR) {
      reasons.push(
        `קרה ${occurrences} פעמים ב-${years.toFixed(0)} שנים — נדיר על הנייר הזה`,
      );
      if (level === "low") level = "medium";
    } else {
      reasons.push(`קורה כ-${perYear.toFixed(0)} פעמים בשנה על הנייר הזה`);
    }
  }

  /* ---- How far outside normal the day itself was ---- */
  if (sigma !== null && sigma !== undefined && Math.abs(sigma) >= EXTREME_SIGMA) {
    reasons.push(`פי ${Math.abs(sigma).toFixed(1)} מסטיית התקן היומית שלו`);
    level = "high";
  } else if (sigma !== null && sigma !== undefined && Math.abs(sigma) >= 2) {
    reasons.push(`פי ${Math.abs(sigma).toFixed(1)} מסטיית התקן היומית שלו`);
    if (level === "low") level = "medium";
  }

  if (volumePercentile !== null && volumePercentile !== undefined) {
    const rank = Math.round(volumePercentile * 100);
    if (volumePercentile >= EXTREME_VOLUME) {
      reasons.push(`מחזור באחוזון ${rank} של השנה האחרונה`);
      level = "high";
    } else if (volumePercentile <= 1 - EXTREME_VOLUME) {
      /* The other tail is a measurement too, and it is the one a tiering
         rule written only for excitement would throw away. A session in
         the bottom two per cent of the year is a real statement about
         participation — it is simply not a reason to interrupt anybody,
         so it is recorded and lifts nothing. */
      reasons.push(`מחזור באחוזון ${rank} — מהשקטים של השנה`);
    }
  }

  /* ---- A story, judged by the reading the site already wrote ---- */
  const { catalystKind, significance, catalystNote } = input;
  if (catalystKind || significance) {
    if (catalystKind === "noise") {
      level = "low";
      reasons.push("הקריאה מסווגת את הכתבה כרעש ולא כזרז עסקי");
    } else if (catalystKind === "catalyst" && significance === "high") {
      level = "high";
      reasons.push("זרז עסקי בעל השפעה גבוהה לפי הקריאה");
    } else if (catalystKind === "catalyst") {
      level = "medium";
      reasons.push("זרז עסקי, בהשפעה בינונית או נמוכה");
    } else if (significance === "high") {
      level = "medium";
      reasons.push("השפעה גבוהה, אבל הקריאה לא מזהה זרז עסקי מובהק");
    } else if (significance === "low") {
      level = "low";
      reasons.push("השפעה נמוכה לפי הקריאה");
    } else {
      level = "medium";
      reasons.push("השפעה בינונית לפי הקריאה");
    }
    /* The model's own sentence, which is the actual argument. The label
       above is a sort order; this is the reason a person can disagree
       with. */
    if (catalystNote) reasons.push(catalystNote.slice(0, 180));
  }

  /* Nothing measurable at all — a date on a calendar, a thesis line with
     no counted history behind it. Reported, and not claiming a rank it
     cannot support. */
  if (reasons.length === 0) {
    return {
      level: "medium",
      why: "אין מדידה מאחורי הפריט הזה — הוא מדווח, ולא מדורג",
    };
  }

  return { level, why: reasons.join(" · ") };
}
