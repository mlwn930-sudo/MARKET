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
 * So the output is a fixed shape rather than prose, and three of its fields
 * exist specifically to stop it drifting into advice:
 *
 * `conflicts` makes the model say where the chart argues with itself. Any
 * chart worth looking at has something pulling the other way, and a read
 * that reports none has usually stopped reading.
 *
 * `invalidation` makes it name the price or behaviour that would break the
 * structure it just described. This is the sentence a manager is actually
 * judged on.
 *
 * `notVisible` makes it say what the image cannot settle. A screenshot has
 * no fundamentals, usually no volume, and often no scale — and a read that
 * quietly fills those gaps is inventing evidence.
 *
 * What it must never produce is a position: no buy, no sell, no wait, no
 * target. That is rule 8 of this project, and it is enforced twice — in the
 * instructions, and again by the shape, which has no field for one.
 */

export type ChartLevel = {
  /** As printed on the chart's own axis, with its units. */
  price: string;
  kind: "support" | "resistance" | "pivot";
  /** How many times price turned there, by what is visible. */
  touches: number;
  note: string;
};

export type ChartRead = {
  /** What the image actually is, before any interpretation. */
  instrument: string | null;
  timeframe: string | null;
  /** The structure, in the terms a desk would use. */
  structure: string;
  trend: "uptrend" | "downtrend" | "range" | "unclear";
  phase: string;
  levels: ChartLevel[];
  volume: string | null;
  indicators: string[];
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
};

const SYSTEM = `אתה אנליסט טכני בכיר בבית השקעות, ברמה של מנהל תיקים ותיק.
מולך צילום מסך של גרף. התפקיד שלך הוא לקרוא אותו כמו שאיש מקצוע קורא גרף
בישיבת בוקר: לומר מה רואים, איפה הראיות סותרות זו את זו, ומה יפריך את
הקריאה.

כללים מחייבים:

1. אתה לא ממליץ. אסור לכתוב "לקנות", "למכור", "להמתין", "נקודת כניסה",
   "יעד מחיר" או כל ניסוח שמבקש מהקורא לפעול. אתה מוסר לו את הטיעון, הוא
   מחליט. ההבדל: "המחיר נבלם שלוש פעמים ב-142, ובשתיים מהן הנר נסגר בשליש
   התחתון" הוא קריאה. "כדאי להמתין ל-142" הוא המלצה, והיא אסורה.

2. אתה לא ממציא מה שלא רואים. אם אין ווליום בגרף — תכתוב שאין. אם הסקאלה
   לא קריאה — תכתוב שהיא לא קריאה. אם אתה לא בטוח מה הנייר, תכתוב null.
   עדיף שדה ריק מניחוש שנראה כמו עובדה.

3. אתה מדויק במספרים. מחיר שאתה מצטט חייב להיות קריא בגרף עצמו. אל תעגל
   לערך "יפה" ואל תשלים ממה שאתה יודע על הנייר מחוץ לתמונה.

4. אתה כותב בעברית, אבל מונחים מקצועיים נשארים באנגלית: RSI, MACD,
   breakout, gap, higher low, moving average.

5. סתירות והפרכה הן החלק החשוב. גרף בלי שום דבר שמושך לכיוון השני הוא
   בדרך כלל גרף שלא קראת עד הסוף.

החזר JSON בלבד, בדיוק במבנה שהתבקש.`;

const SHAPE = `{
  "instrument": "שם הנייר או הסימול אם מופיע בגרף, אחרת null",
  "timeframe": "הטווח והגרעיניות אם מופיעים, למשל 'יומי, כשנה', אחרת null",
  "structure": "תיאור מבנה המחיר במשפט עד שניים: שיאים ושפלים, כיוון, רוחב התנועה",
  "trend": "uptrend | downtrend | range | unclear",
  "phase": "איפה המבנה נמצא ביחס לעצמו, במשפט",
  "levels": [
    { "price": "המחיר כפי שקריא בגרף", "kind": "support | resistance | pivot", "touches": 0, "note": "מה קרה שם" }
  ],
  "volume": "מה הווליום מראה, או null אם אין ווליום בתמונה",
  "indicators": ["אינדיקטורים שנראים בגרף ומה הם מראים"],
  "conflicts": ["איפה הראיות בגרף סותרות זו את זו"],
  "invalidation": ["מה יפריך את המבנה שתיארת — מחיר, סגירה, התנהגות"],
  "notVisible": ["מה התמונה הזאת לא יכולה להכריע"],
  "summary": "פסקה אחת שאפשר למסור למישהו אחר",
  "confidence": "high | medium | low",
  "confidenceReason": "למה — איכות התמונה, קריאות הסקאלה, כמה היסטוריה נראית"
}`;

export type ChartReadResult =
  | { ok: true; read: ChartRead }
  | { ok: false; reason: string };

/**
 * Reads one chart image.
 *
 * Temperature is held low. This is a description task with a right answer
 * on the page in front of it, and the failure mode of a warmer setting here
 * is a confident number that is not on the chart.
 */
export async function readChartImage(
  image: Attachment,
  context?: string,
): Promise<ChartReadResult> {
  if (!hasGeminiKey()) {
    return { ok: false, reason: "no-key" };
  }

  const prompt = [
    "קרא את הגרף שבתמונה.",
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
    const read = await generateJson<ChartRead>({
      system: SYSTEM,
      prompt,
      images: [image],
      temperature: 0.15,
      maxOutputTokens: 2200,
      timeoutMs: 60_000,
    });

    /* A shape check rather than trust. The model is reliable about the
       structure and not perfectly so, and a page that renders
       `read.levels.map` over undefined is a page that crashes on a bad
       day. */
    if (!read || typeof read.summary !== "string" || !read.summary.trim()) {
      return { ok: false, reason: "empty" };
    }

    return {
      ok: true,
      read: {
        ...read,
        levels: Array.isArray(read.levels) ? read.levels : [],
        indicators: Array.isArray(read.indicators) ? read.indicators : [],
        conflicts: Array.isArray(read.conflicts) ? read.conflicts : [],
        invalidation: Array.isArray(read.invalidation) ? read.invalidation : [],
        notVisible: Array.isArray(read.notVisible) ? read.notVisible : [],
      },
    };
  } catch (error) {
    return { ok: false, reason: (error as Error).message.slice(0, 160) };
  }
}
