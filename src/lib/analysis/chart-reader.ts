import { generateJson, hasGeminiKey, type Attachment } from "@/lib/sources/gemini";

/**
 * Reading a chart from a picture of one.
 *
 * The brief was a portfolio manager going over the chart and giving a full
 * read. The thing that separates that from a chatbot describing an image is
 * not vocabulary — it is that a professional states what they see, says
 * where the evidence disagrees with itself, and names what would prove them
 * wrong. A read that cannot be falsified is a horoscope.
 *
 * A first version stopped at description: instrument, structure, levels,
 * volume, indicators. Correct, and thin. What a manager adds on top of the
 * description is four things, and each of them is now a field:
 *
 *   `pattern`   — the structure named in the standard vocabulary, with the
 *                 marks that make it that pattern and the pattern it would
 *                 be mistaken for. A name is only worth having if it is
 *                 falsifiable, so the lookalike is part of it.
 *   `control`   — who is working the tape right now, and the observable
 *                 evidence for that reading. This is the sentence that
 *                 turns a drawing into a market.
 *   `watch`     — the observable events that would confirm or break the
 *                 structure. Phrased so that a week later anyone can say
 *                 "that happened" or "that did not".
 *   `horizon`   — the span the structure actually speaks to, which a chart
 *                 states through its bar interval and the width of the
 *                 formation and which readers routinely get wrong.
 *
 * Three fields exist specifically to stop the whole thing drifting into
 * advice, and they got harder to skip rather than easier as the read got
 * more useful:
 *
 * `conflicts` makes the model say where the chart argues with itself. Any
 * chart worth looking at has something pulling the other way, and a read
 * that reports none has usually stopped reading.
 *
 * `invalidation` makes it name the price or behaviour that would break the
 * structure it just described. This is the sentence a manager is actually
 * judged on, and when it comes back empty the confidence is capped below
 * `high` here in the code — an unfalsifiable read does not get to claim it
 * is a confident one.
 *
 * `notVisible` makes it say what the image cannot settle. A screenshot has
 * no fundamentals, usually no volume, and often no scale — and a read that
 * quietly fills those gaps is inventing evidence.
 *
 * What it must never produce is a position: no entry, no target, no stop,
 * no "wait for", no position size. That is rule 8 of this project, and it
 * is enforced three times — in the instructions, in the shape, which has no
 * field for one, and in `scrub` below, which deletes any sentence that
 * slipped through and reports how many it deleted. An instruction is a
 * request; a filter is a guarantee.
 *
 * Rule 9 — a number nothing measured stays missing — now has the same
 * shape, for the one field that needs it. `tendency` speaks about a class
 * of pattern rather than about the picture, so a percentage or a case count
 * inside it was measured nowhere, and `scrubStatistic` below deletes the
 * sentence carrying one and counts it separately. Until it existed the page
 * could print "a pattern like this resolves upward in 68% of cases" and
 * then print, directly beneath it, that the line above is neither a
 * measurement of this chart nor a statistic computed here — the site
 * contradicting itself inside one block, with the invented figure as the
 * visible half.
 */

export type ChartLevel = {
  /** As printed on the chart's own axis, with its units. */
  price: string;
  kind: "support" | "resistance" | "pivot";
  /** How many times price turned there, by what is visible. */
  touches: number;
  note: string;
};

/**
 * The structure named in the vocabulary a desk actually speaks.
 *
 * `tendency` is the one field here that reaches outside the image, and it
 * is deliberately qualitative. What a pattern class usually resolves into
 * is textbook behaviour and worth saying; a percentage attached to it would
 * be a statistic nobody measured, which rule 9 of this project forbids,
 * which `scrubStatistic` deletes here when the model emits one anyway, and
 * which the renderer labels as a class tendency underneath.
 *
 * The sibling fields are not filtered the same way, and the reason is where
 * each of them looks. `maturity` and `evidence` read the picture, where a
 * number is a price or a count of weeks that rule 3 of the instructions
 * requires to be legible on the chart; `name` and `term` are names, and
 * some of them contain digits ("1-2-3 top"); `lookalike` separates two
 * shapes, and the thresholds that separate them are definitions rather than
 * frequencies. A digit filter over those would delete measured prose.
 */
export type ChartPattern = {
  /** The name in Hebrew, one phrase. */
  name: string;
  /** The English term a desk would say out loud. */
  term: string;
  /** How much of the pattern is actually drawn yet. */
  maturity: string;
  /** The marks on this chart that make it this pattern. */
  evidence: string;
  /** What this class of pattern usually resolves into — a tendency, never
   *  a measurement of this instrument. */
  tendency: string;
  /** The pattern this would be confused with, and what separates them. */
  lookalike: string | null;
};

/** Who is working the tape, and what on the chart says so. */
export type ChartControl = {
  side: "buyers" | "sellers" | "balance" | "unclear";
  /** One sentence naming what is happening, in behavioural terms. */
  reading: string;
  /** The observable marks behind it: wicks, closes inside the bar's range,
   *  volume on up bars against down bars, failed breakouts, gaps. */
  evidence: string[];
};

/**
 * Something observable that would settle part of the read.
 *
 * Not advice, and the distinction is in the grammar: an event either
 * happens or it does not, and the field says what its happening would mean.
 * "If a daily close prints above 142 on above-average volume, the
 * breakout is confirmed" is an observation waiting to be made. "Wait for
 * 142" is an instruction, and it is forbidden.
 */
export type ChartWatch = {
  event: string;
  means: string;
  direction: "confirms" | "breaks" | "neutral";
};

/** The span the structure speaks to, and why that span. */
export type ChartHorizon = {
  label: string;
  why: string;
};

export type ChartRead = {
  /** What the image actually is, before any interpretation. */
  instrument: string | null;
  timeframe: string | null;
  /** The structure, in the terms a desk would use. */
  structure: string;
  trend: "uptrend" | "downtrend" | "range" | "unclear";
  phase: string;
  /** The structure named, or null when nothing on the chart earns a name. */
  pattern: ChartPattern | null;
  /** Who is in control of the tape right now. */
  control: ChartControl;
  levels: ChartLevel[];
  volume: string | null;
  indicators: string[];
  /** Observable events that would confirm or break the structure. */
  watch: ChartWatch[];
  /** The span the structure speaks to. */
  horizon: ChartHorizon | null;
  /** Where the chart argues with itself. */
  conflicts: string[];
  /** What would break the structure described above. */
  invalidation: string[];
  /** What this image cannot settle. */
  notVisible: string[];
  /** One paragraph a reader could repeat to someone else. */
  summary: string;
  /** How much of the above the image actually supports. */
  confidence: "high" | "medium" | "low";
  confidenceReason: string;
  /** True when the empty-invalidation rule below actually lowered the
   *  confidence. The page tells the reader which sentence is ours, and it can
   *  only do that honestly if it knows whether the cap fired — a read that
   *  came back "medium" with no invalidation was never capped, and saying it
   *  was would be the site inventing an enforcement it did not perform. */
  confidenceCapped: boolean;
  /** How many sentences were deleted here for reading as advice. Computed,
   *  never asked of the model — a model that is told it will be audited
   *  learns to phrase around the audit. */
  redacted: number;
  /** How many sentences were deleted for carrying a statistic nothing here
   *  measured. Counted apart from `redacted` because the reason the reader
   *  is owed is a different one: that sentence was not advice, it was a
   *  figure with no source. */
  fabricated: number;
};

const SYSTEM = `אתה אנליסט טכני בכיר בבית השקעות — הרמה של מנהל תיקים שעומד
מול מסך בישיבת בוקר ומוסר קריאה של גרף לשולחן. מולך צילום מסך של גרף אחד.

מה שמפריד קריאה מקצועית מתיאור של תמונה הוא לא אוצר מילים. זה שלושה דברים:
כל קביעה נתלית בסימן שרואים בגרף; כל קביעה ניתנת להפרכה; ואף קביעה לא
הופכת לפעולה שהקורא צריך לעשות.

הקריאה שאתה מוסר כוללת: מה המבנה, איך קוראים לו בשפה המקצועית, מי שולט
בסחר ולפי איזה סימן, מה דפוס כזה נוטה להיפתר אליו, מה יאשר אותו, מה ישבור
אותו, לאיזה אופק זמן המבנה מדבר, ומה התמונה הזאת לא יכולה להכריע.

כללים מחייבים:

1. אסור להמליץ ואסור לתזמן. אין "לקנות", אין "למכור", אין "להמתין", אין
   "כדאי", אין "מומלץ", אין נקודת כניסה, אין יעד מחיר, אין סטופ ואין גודל
   פוזיציה. אתה מוסר לקורא מבנה ותנאים; הוא מחליט מה לעשות איתם.

2. "כיוון ברור" בלי המלצה — כך זה נראה בפועל:
   מותר: "המבנה הוא ascending triangle בן שבעה שבועות. דפוס כזה נוטה
   להיפתר בכיוון המגמה שקדמה לו, ודפוס שנכשל מחזיר בדרך כלל את כל בסיס
   התבנית. מה שיאשר אותו הוא סגירה יומית מעל 142 בווליום גבוה מהממוצע
   שנראה בגרף; מה שישבור אותו הוא סגירה מתחת לקו התחתון, שהיא גם שבירה של
   ה-higher low מ-128."
   אסור: "כדאי להיכנס מעל 142, סטופ ב-128, יעד 160."
   ההבדל אינו בניסוח. הראשון מוסר לקורא את הטיעון; השני מוסר לו פקודה.

3. מדויק במספרים. מחיר שאתה מצטט חייב להיות קריא בגרף עצמו. אל תעגל לערך
   "יפה" ואל תשלים ממה שאתה יודע על הנייר מחוץ לתמונה.

4. אתה לא ממציא מה שלא רואים. אין ווליום בגרף — תכתוב שאין. הסקאלה לא
   קריאה — תכתוב שהיא לא קריאה. לא בטוח מה הנייר — null. שדה ריק עדיף על
   ניחוש שנראה כמו עובדה.

5. pattern — שם הדפוס במונחים המקצועיים המקובלים (double top, bull flag,
   head and shoulders, falling wedge, cup and handle, ascending triangle,
   rounding bottom, וכו'). חייב להיות גם maturity — כמה מהדפוס כבר מצויר,
   כי דפוס שליש-מצויר אינו דפוס — וגם lookalike: הדפוס שאפשר לבלבל איתו ומה
   מבדיל ביניהם. אם שום דבר בגרף לא מצדיק שם, החזר null. שם שגוי גרוע
   מחוסר שם.

6. tendency — מה דפוס מהמחלקה הזאת נוטה להיפתר אליו. זאת התנהגות הדפוס
   כמחלקה, לא מדידה על הגרף שלפניך. אסור להמציא אחוזים או בסיס סטטיסטי.
   ניסוח איכותי בלבד: "לרוב", "בדרך כלל", "לעיתים רחוקות". ראית תמונה אחת
   ולא מדדת כלום.

7. control — מי שולט בסחר כרגע: buyers (קונים סופגים היצע), sellers
   (מוכרים מחלקים סחורה), balance (איזון), unclear. הראיות חייבות להיות
   סימנים שנראים: אורך הפתילים ולאיזה כיוון, איפה הנר נסגר בתוך הטווח שלו,
   ווליום בנרות עולים מול יורדים, gap שנסגר או שנשאר פתוח, breakout שנכשל,
   מהירות ההתאוששות מירידה, פער בין שיא מחיר חדש לאינדיקטור שלא מאשר אותו.
   אמירה על שליטה בלי סימן כזה היא ניחוש.

8. watch — אירועים שאפשר להבחין בהם, לא פעולות. כל פריט מנוסח כך שבעוד
   שבוע אפשר לומר עליו "זה קרה" או "זה לא קרה". אסור פועל בציווי ואסור
   "להמתין ל". הצורה היא "אם X יקרה — המשמעות היא Y". direction הוא
   confirms אם האירוע מאשר את המבנה שתיארת, breaks אם הוא שובר אותו,
   neutral אם הוא לא מכריע.

9. horizon — לאיזה אופק זמן המבנה מדבר, נגזר מגרעיניות הנרות ומרוחב
   המבנה. גרף יומי עם תבנית בת שבעה שבועות לא מדבר על מחר.

10. conflicts, invalidation, notVisible הם החלק החשוב, ושלושתם חייבים
    להכיל לפחות פריט אחד. גרף בלי שום דבר שמושך לכיוון השני הוא בדרך כלל
    גרף שלא נקרא עד הסוף. אם באמת אין לך פריט לשדה — כתוב בו את המשפט
    שמסביר למה אין, ולא רשימה ריקה.

11. עברית, אבל מונחים מקצועיים נשארים באנגלית: RSI, MACD, breakout, gap,
    higher low, moving average, distribution, accumulation.

החזר JSON בלבד, בדיוק במבנה שהתבקש.`;

const SHAPE = `{
  "instrument": "שם הנייר או הסימול אם מופיע בגרף, אחרת null",
  "timeframe": "הטווח והגרעיניות אם מופיעים, למשל 'יומי, כשנה', אחרת null",
  "structure": "תיאור מבנה המחיר במשפט עד שניים: שיאים ושפלים, כיוון, רוחב התנועה",
  "trend": "uptrend | downtrend | range | unclear",
  "phase": "איפה המבנה נמצא ביחס לעצמו, במשפט",
  "pattern": {
    "name": "שם הדפוס בעברית, ביטוי אחד",
    "term": "המונח המקצועי באנגלית",
    "maturity": "כמה מהדפוס כבר מצויר ומה עוד חסר כדי שיהיה שלם",
    "evidence": "הסימנים בגרף הזה שעושים אותו הדפוס הזה",
    "tendency": "למה דפוס מהמחלקה הזאת נוטה להיפתר — איכותי, בלי אחוזים",
    "lookalike": "הדפוס שאפשר לבלבל איתו ומה מבדיל, או null"
  },
  "control": {
    "side": "buyers | sellers | balance | unclear",
    "reading": "משפט אחד על מה שקורה בסחר",
    "evidence": ["הסימנים הנראים שמאחורי הקריאה הזאת"]
  },
  "levels": [
    { "price": "המחיר כפי שקריא בגרף", "kind": "support | resistance | pivot", "touches": 0, "note": "מה קרה שם" }
  ],
  "volume": "מה הווליום מראה, או null אם אין ווליום בתמונה",
  "indicators": ["אינדיקטורים שנראים בגרף ומה הם מראים"],
  "watch": [
    { "event": "אירוע שאפשר להבחין בו", "means": "מה המשמעות שלו למבנה", "direction": "confirms | breaks | neutral" }
  ],
  "horizon": { "label": "האופק, למשל 'שבועות עד חודשיים'", "why": "למה האופק הזה ולא אחר" },
  "conflicts": ["איפה הראיות בגרף סותרות זו את זו"],
  "invalidation": ["מה יפריך את המבנה שתיארת — מחיר, סגירה, התנהגות"],
  "notVisible": ["מה התמונה הזאת לא יכולה להכריע"],
  "summary": "פסקה אחת שאפשר למסור למישהו אחר",
  "confidence": "high | medium | low",
  "confidenceReason": "למה — איכות התמונה, קריאות הסקאלה, כמה היסטוריה נראית"
}`;

/* ------------------------------------------------------------------ */
/* Rule 8, in code                                                     */
/* ------------------------------------------------------------------ */

/**
 * Phrases that turn a read into a recommendation.
 *
 * Every Hebrew entry is more than one word, and that is the whole design.
 * The single words they are built from are legitimate on a chart: "לחץ
 * קנייה" is a reading of the tape and "גל מכירות" is a description of one,
 * while "כדאי לקנות" is advice. Matching the word would delete the reading
 * along with the advice; matching the phrase deletes only the advice.
 *
 * The English entries are bounded for the same reason — "sell-off" and
 * "buyers" have to survive, "price target" and "stop loss" must not.
 */
const ADVISORY = [
  /* Opinion about what the reader should do. */
  "כדאי",
  "מומלץ",
  "מומלצת",
  "ההמלצה",
  "ממליץ",
  "עדיף ל",
  "יש לשקול",
  /* An instruction to transact. */
  "יש לקנות",
  "יש למכור",
  "צריך לקנות",
  "צריך למכור",
  "אפשר לקנות",
  "אפשר למכור",
  "שווה לקנות",
  "הזדמנות קנייה",
  "הזדמנות מכירה",
  /* The furniture of a trade: entry, exit, target, stop, size. */
  "נקודת כניסה",
  "נקודת יציאה",
  "יעד",
  "סטופ",
  "גודל פוזיציה",
  "לשקול כניסה",
  /* Timing the reader rather than describing the chart. */
  "להמתין",
  "להיכנס",
  "לצאת מהפוזיציה",
  /* English. */
  "price target",
  "stop loss",
  "stop-loss",
  "take profit",
  "entry point",
  "exit point",
  "position siz",
  "should buy",
  "should sell",
  "buy the dip",
];

function isAdvisory(text: string): boolean {
  const lower = text.toLowerCase();
  return ADVISORY.some((phrase) => lower.includes(phrase));
}

/** How many sentences the scrubs took out, carried through one read. Two
 *  counters rather than one, because the page tells the reader why. */
type Tally = { removed: number; fabricated: number };

/** Sentences, roughly. Terminators are kept so the surviving prose still
 *  punctuates, and a line with none comes back as one sentence. */
function splitSentences(value: string): string[] {
  return value.match(/[^.!?…\n]+[.!?…]*\s*/g) ?? [value];
}

/**
 * Deletes the sentences that read as advice and keeps the rest.
 *
 * Sentence granularity rather than field granularity, because the usual
 * failure is one helpful sentence at the end of five good ones — dropping
 * the field would cost the read, and dropping nothing would publish a
 * recommendation. Splitting on terminators keeps the surviving prose
 * readable, and the count surfaces on the page so a reader can see that
 * something was taken out rather than wonder why a paragraph ends early.
 *
 * The match is deliberately broader than the offence. "יעד" catches a
 * sentence in `notVisible` that only observed the image does not show
 * analysts' targets, and that is the right direction to be wrong in: the
 * cost of deleting an innocent sentence is one sentence, and the cost of
 * keeping a guilty one is a site that gives price targets. The page says
 * as much where it reports the count.
 */
function scrubText(value: unknown, tally: Tally): string {
  if (typeof value !== "string" || !value.trim()) return "";

  const kept = splitSentences(value).filter((sentence) => {
    if (!isAdvisory(sentence)) return true;
    tally.removed++;
    return false;
  });

  return kept.join("").replace(/\s+/g, " ").trim();
}

/** The same, for a field that is allowed to be absent. */
function scrubNullable(value: unknown, tally: Tally): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = scrubText(value, tally);
  return cleaned || null;
}

/** A list, with the advisory entries removed whole. A bullet is one
 *  thought, so there is nothing to salvage inside it. */
function scrubList(value: unknown, tally: Tally): string[] {
  if (!Array.isArray(value)) return [];
  const out: string[] = [];
  for (const item of value) {
    if (typeof item !== "string" || !item.trim()) continue;
    if (isAdvisory(item)) {
      tally.removed++;
      continue;
    }
    out.push(item.trim());
  }
  return out;
}

/* ------------------------------------------------------------------ */
/* Rule 9, in code                                                     */
/* ------------------------------------------------------------------ */

/**
 * A number the model could not have measured, matched by the construction
 * that makes it a statistic rather than by the digit alone.
 *
 * The digit alone is the wrong test, and that is the whole difficulty here.
 * A tendency sentence has every right to say "1-2-3 top", "a pattern seven
 * weeks wide" or "usually matures within four to eight weeks" — a name, a
 * width and a duration are not claims about how often anything happens.
 * What has no source is a frequency: a percentage, a share of the cases, a
 * sample that was counted, a probability named as one. So each entry below
 * pairs a quantity with the word that turns it into a rate, and the gaps
 * between the two are short on purpose — a number at one end of a sentence
 * and "מקרים" at the other end are usually unrelated.
 *
 * "מתוך" needs a number on both sides for the same reason: "7 מתוך 10" is a
 * statistic and "מתוך תבנית של עשרה שבועות" is ordinary prose.
 */
const NUM = String.raw`\d+(?:[.,]\d+)?`;
/** The quantities that do a percentage's work without a digit. */
const PART = "(?:מחצית|חצי|שליש|שלישים|רבע|רבעים|חמישית)";
/** The words that turn a quantity into "out of how many times". */
const RATE = "(?:מהמקרים|מהפעמים|מהזמן|מהמצבים|מהדפוסים|מהתבניות|מהניסיונות)";

const STATISTIC: RegExp[] = [
  /* A percentage, in either order and in either language. The instructions
     forbid one in this field outright, so no window is needed. */
  new RegExp(`${NUM}\\s*%|%\\s*${NUM}`),
  new RegExp(`${NUM}\\s*(?:אחוז|אחוזי|אחוזים)`),
  new RegExp(`${NUM}\\s*(?:percent|pct)\\b`, "i"),
  /* A share of the cases: "ב-68 מהמקרים", "בשני שלישים מהפעמים". */
  new RegExp(`(?:${NUM}|${PART})[^.!?…\\n]{0,14}?${RATE}`),
  new RegExp(`${RATE}[^.!?…\\n]{0,14}?(?:${NUM}|${PART})`),
  /* "7 מתוך 10", "2 מכל 3". */
  new RegExp(`${NUM}[^\\s]{0,2}\\s*(?:מתוך|מכל)\\s*(?:כ-?)?${NUM}`),
  /* A sample, counted. The quantity has to sit against the noun; a digit a
     clause away from "מקרים" is a different sentence. */
  new RegExp(`${NUM}\\s*(?:מקרים|המקרים|פעמים|הפעמים|תצפיות|דגימות)`),
  new RegExp(`(?:מדגם|תצפיות|נבדקו|נמדדו|מחקרים|סטטיסטי)[^.!?…\\n]{0,18}?${NUM}`),
  /* A probability, named as one. */
  new RegExp(`(?:הסתברות|סיכוי|סיכויים|שכיחות|תוחלת)[^.!?…\\n]{0,14}?(?:${NUM}|${PART})`),
  /* English, which arrives mixed into the Hebrew with the terminology. */
  /\b\d+(?:[.,]\d+)?\s*%?\s*of (?:the )?(?:time|cases|instances|setups)\b/i,
  /\b\d+\s*(?:out of|in)\s*\d+\b/i,
  /\b(?:win|hit|success|failure)\s+rate\b/i,
  /\bbacktest/i,
  /\b(?:probability|odds|frequency|statistic\w*)\b[^.!?…\n]{0,16}?\d/i,
];

function hasStatistic(text: string): boolean {
  return STATISTIC.some((pattern) => pattern.test(text));
}

/**
 * Deletes the sentences that assert a statistic and keeps the rest.
 *
 * Sentence granularity, like the advisory scrub above and for the same
 * reason: the usual failure is a correct qualitative tendency followed by
 * one helpful figure. Dropping the sentence keeps the tendency and loses
 * the figure, which is the outcome rule 9 asks for. When the figure was the
 * whole field the field comes back empty, the renderer's guard hides the
 * block, and the count below tells the reader a line was taken out — a
 * shorter paragraph with no explanation reads as a model that ran out of
 * things to say.
 */
function scrubStatistic(value: string, tally: Tally): string {
  if (!value) return "";

  const kept = splitSentences(value).filter((sentence) => {
    if (!hasStatistic(sentence)) return true;
    tally.fabricated++;
    return false;
  });

  return kept.join("").replace(/\s+/g, " ").trim();
}

/* ------------------------------------------------------------------ */
/* Shape, not trust                                                    */
/* ------------------------------------------------------------------ */

/** Keeps an enum inside its own set. The model is reliable about these and
 *  not perfectly so, and a stray value reaches the page as a missing label
 *  rather than as an error. */
function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

function normalizeLevels(value: unknown, tally: Tally): ChartLevel[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((level): level is Record<string, unknown> => Boolean(level) && typeof level === "object")
    .map((level) => ({
      price: typeof level.price === "string" ? level.price.trim() : "",
      kind: oneOf(level.kind, ["support", "resistance", "pivot"] as const, "pivot"),
      touches: Number.isFinite(Number(level.touches)) ? Math.max(0, Math.trunc(Number(level.touches))) : 0,
      note: scrubText(level.note, tally),
    }))
    .filter((level) => level.price.length > 0);
}

function normalizePattern(value: unknown, tally: Tally): ChartPattern | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;

  const name = scrubText(raw.name, tally);
  const term = typeof raw.term === "string" ? raw.term.trim() : "";
  if (!name && !term) return null;

  return {
    name: name || term,
    term,
    maturity: scrubText(raw.maturity, tally),
    evidence: scrubText(raw.evidence, tally),
    /* Both filters, in the order the offences differ: the advisory scrub
       first, then the statistic. A sentence can fail either test. */
    tendency: scrubStatistic(scrubText(raw.tendency, tally), tally),
    lookalike: scrubNullable(raw.lookalike, tally),
  };
}

function normalizeControl(value: unknown, tally: Tally): ChartControl {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    side: oneOf(raw.side, ["buyers", "sellers", "balance", "unclear"] as const, "unclear"),
    reading: scrubText(raw.reading, tally),
    evidence: scrubList(raw.evidence, tally),
  };
}

function normalizeWatch(value: unknown, tally: Tally): ChartWatch[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
    .map((item) => ({
      event: scrubText(item.event, tally),
      means: scrubText(item.means, tally),
      direction: oneOf(item.direction, ["confirms", "breaks", "neutral"] as const, "neutral"),
    }))
    .filter((item) => item.event.length > 0);
}

function normalizeHorizon(value: unknown, tally: Tally): ChartHorizon | null {
  if (!value || typeof value !== "object") return null;
  const raw = value as Record<string, unknown>;
  const label = scrubText(raw.label, tally);
  if (!label) return null;
  return { label, why: scrubText(raw.why, tally) };
}

export type ChartReadResult =
  | { ok: true; read: ChartRead }
  | { ok: false; reason: string };

/**
 * Reads one chart image.
 *
 * Temperature is held low. This is a description task with a right answer
 * on the page in front of it, and the failure mode of a warmer setting here
 * is a confident number that is not on the chart.
 *
 * The token budget is generous because the shape is wide: the pattern, the
 * control reading and the watch list roughly doubled the object, and a cut
 * object does not parse at all — the model wrapper treats a truncated JSON
 * answer as the failure it is rather than handing back half of one.
 *
 * The timeout is shorter than the route's sixty-second ceiling on purpose.
 * A read that has hung needs to fail inside the function, where the page
 * can say so in a sentence; a read still waiting when the platform cuts
 * the function reaches the browser as a bare gateway error.
 */
export async function readChartImage(
  image: Attachment,
  context?: string,
): Promise<ChartReadResult> {
  if (!hasGeminiKey()) {
    return { ok: false, reason: "no-key" };
  }

  const prompt = [
    "קרא את הגרף שבתמונה כמו שאנליסט בכיר קורא אותו לשולחן.",
    context?.trim()
      ? `הקשר שהמשתמש הוסיף (אל תתייחס אליו כעובדה אם הוא סותר את מה שרואים): ${context.trim()}`
      : "",
    "",
    "החזר JSON במבנה הבא:",
    SHAPE,
  ]
    .filter(Boolean)
    .join("\n");

  try {
    const raw = await generateJson<Partial<ChartRead>>({
      system: SYSTEM,
      prompt,
      images: [image],
      temperature: 0.15,
      maxOutputTokens: 4600,
      /* 24 seconds a model, 44 for everything together.

         It asked for 45 per model before, which read as caution and
         was the opposite. Three models in the chain and two passes
         when the JSON does not parse is six attempts; at 45 seconds
         each that is 270, and the route is cut at 60. The upload
         spun and then nothing came back, because the platform killed
         the function while an attempt was still in flight and no code
         of ours survived to explain.

         44 leaves the route sixteen seconds to corroborate the read
         against real candles and answer. 24 a model fits two attempts
         inside that, which is what the retry was for; a vision read
         that has not answered in 24 seconds is not about to. */
      timeoutMs: 24_000,
      budgetMs: 44_000,
    });

    /* A shape check rather than trust. The model is reliable about the
       structure and not perfectly so, and a page that renders
       `read.levels.map` over undefined is a page that crashes on a bad
       day. */
    if (!raw || typeof raw.summary !== "string" || !raw.summary.trim()) {
      return { ok: false, reason: "empty" };
    }

    const tally: Tally = { removed: 0, fabricated: 0 };

    const summary = scrubText(raw.summary, tally);
    /* The summary is the one field a reader cannot do without. If the scrub
       emptied it, the whole answer was a recommendation, and the honest
       outcome is no read rather than a read with its spine removed. */
    if (!summary) {
      return { ok: false, reason: "advisory" };
    }

    const invalidation = scrubList(raw.invalidation, tally);
    let confidence = oneOf(raw.confidence, ["high", "medium", "low"] as const, "medium");
    let confidenceReason = scrubText(raw.confidenceReason, tally);

    /* A read nobody can falsify is not a high-confidence read, whatever it
       says about itself. Capping it here rather than asking the model to be
       modest keeps the rule enforceable: the condition is mechanical and
       the reader is told which sentence is ours. */
    let confidenceCapped = false;
    if (invalidation.length === 0 && confidence === "high") {
      confidence = "medium";
      confidenceCapped = true;
      confidenceReason = [
        confidenceReason,
        "הקריאה לא ציינה מה היה מפריך אותה, ולכן הביטחון מוגבל כאן לבינוני.",
      ]
        .filter(Boolean)
        .join(" ");
    }

    return {
      ok: true,
      read: {
        instrument: scrubNullable(raw.instrument, tally),
        timeframe: scrubNullable(raw.timeframe, tally),
        structure: scrubText(raw.structure, tally),
        trend: oneOf(raw.trend, ["uptrend", "downtrend", "range", "unclear"] as const, "unclear"),
        phase: scrubText(raw.phase, tally),
        pattern: normalizePattern(raw.pattern, tally),
        control: normalizeControl(raw.control, tally),
        levels: normalizeLevels(raw.levels, tally),
        volume: scrubNullable(raw.volume, tally),
        indicators: scrubList(raw.indicators, tally),
        watch: normalizeWatch(raw.watch, tally),
        horizon: normalizeHorizon(raw.horizon, tally),
        conflicts: scrubList(raw.conflicts, tally),
        invalidation,
        notVisible: scrubList(raw.notVisible, tally),
        summary,
        confidence,
        confidenceReason,
        confidenceCapped,
        redacted: tally.removed,
        fabricated: tally.fabricated,
      },
    };
  } catch (error) {
    return { ok: false, reason: (error as Error).message.slice(0, 160) };
  }
}
