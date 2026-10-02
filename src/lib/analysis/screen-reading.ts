/**
 * Why the screener flagged a company — the argument, not the score.
 *
 * The register shows a number and ten ticks. That is a result, and a result
 * is not a reason: "passed nine of ten" tells a reader where to look and
 * nothing about what they will find there. A company that passes nine
 * because it is cheap, growing and profitable and fails on leverage is a
 * different object from one whose balance sheet is spotless and whose
 * revenue has not grown in three years — and the two sort to the same
 * place in the list.
 *
 * So this module turns the criteria a company already has into a short
 * reading: which tests it passed, what those tests mean when taken
 * together, and — the half a score always loses — what argues the other
 * way.
 *
 * Four constraints shaped it.
 *
 * It is deterministic and free. No model is called. Every sentence is
 * selected by a branch over criteria statuses, so the same filings produce
 * the same reading, and generating it for the whole universe on every
 * build costs nothing.
 *
 * It states and does not rate (CLAUDE.md rule 8). Nothing here says a
 * company is worth buying, worth avoiding, cheap, expensive or good.
 * "Both multiples sit above the sector median, so the market already pays
 * more for this company than for the ones doing the same thing" is a
 * description; "overvalued" is a rating. The difference is that the first
 * hands the reader the argument and the second asks for their trust.
 *
 * Its prose carries no digits. Figures live in `counters` and in the
 * lead's own segments so the page can set each one in the tabular `.num`
 * face — which is what keeps a leading minus on the correct side of a
 * number inside an RTL paragraph.
 *
 * And it repeats as little per row as it can. This page once shipped the
 * same ten criterion explanations inside all forty-eight rows, three
 * megabytes of identical Hebrew. The meanings below come from a fixed
 * table and so do recur across companies, but each row carries only the
 * branches its own numbers actually reached.
 */

import type { Criterion, ScreenResult } from "@/lib/screener";

/** How a group of tests came out. Deliberately not a grade: `counter` means
 *  the evidence in that group argues the other way, not that the company
 *  failed something. */
export type ReadingTone = "support" | "mixed" | "counter";

/** A run of text, optionally a figure. The page sets `num` runs in the
 *  tabular face; see the file header for why that matters in RTL. */
export type ReadingSegment = { text: string; num?: boolean };

/** A test that did not pass, with what the company actually reported. */
/** A figure and the bar it was measured against. The second half is the
 *  site’s fifth rule: the screener knew the sector median when it decided
 *  pass or fail, and until now it discarded it on the way to the page. */
export type ReadingEvidence = {
  label: string;
  detail: string;
  benchmark: string | null;
};

export type ReadingClause = {
  key: string;
  label: string;
  tone: ReadingTone;
  /** Out of the tests that could be computed — never out of the whole pool,
   *  because a figure the filings do not carry is absent, not failed. */
  passed: number;
  total: number;
  /** Only the tests that did not pass. The ones that did are counted above
   *  and listed in full in the criteria ledger under the reading, so
   *  naming them twice would be a second copy of the same ten rows. */
  counters: ReadingEvidence[];
  /** What this group of tests means when read together. */
  meaning: string;
};

export type ScreenReading = {
  /** One sentence: the standing, and where the counter-argument sits. */
  lead: ReadingSegment[];
  /** The groups in a fixed order, for the meters — the columns only line
   *  up down the register if every row draws them in the same sequence. */
  axes: ReadingClause[];
  /** The same clause objects, reordered so the argument reads: what the
   *  evidence supports, then what is split, then what argues against. */
  clauses: ReadingClause[];
  /** Where the two sides contradict each other. Null when they do not —
   *  there is no filler sentence for agreement. */
  tension: string | null;
  /** What the filings could not answer (CLAUDE.md rule 9). */
  missing: ReadingSegment[] | null;
};

/* ------------------------------------------------------------------ */
/* The four groups                                                     */
/* ------------------------------------------------------------------ */

type ThemeContext = {
  passed: number;
  /** Tests in this group that could be computed. */
  total: number;
  /** `absent` is a criterion the screener never emitted, which is a
   *  different thing from one it could not compute. */
  statusOf: (key: string) => Criterion["status"] | "absent";
  /** Computed once by the caller, because almost every branch below opens
   *  with it. */
  tone: ReadingTone;
};

type Theme = {
  key: string;
  label: string;
  /** Criterion keys from lib/screener.ts, named exactly.
   *
   *  Exactly, and not by substring. The grouping was once done by matching
   *  fragments of the key, and `rev_growth` contains "ev" while `ev_fcf`
   *  contains "fcf" — so growth was counted inside the valuation meter and
   *  cash flow inside both quality and valuation. Four criteria showed in
   *  a group that holds two. */
  keys: string[];
  meaning: (ctx: ThemeContext) => string;
};

const THEMES: Theme[] = [
  {
    key: "quality",
    label: "איכות",
    keys: ["roic", "operating_margin", "fcf_margin"],
    meaning: (ctx) => {
      const roic = ctx.statusOf("roic");
      const margin = ctx.statusOf("operating_margin");
      const cash = ctx.statusOf("fcf_margin");

      if (ctx.tone === "support") {
        /* The three-test wording earns its force from agreement between
           independent parts of the report, so it cannot be spoken over one
           test. Eleven companies arrive here with only the cash test
           computable — the sentence promised corroboration that did not
           exist, and the honest version is the weaker one. */
        if (ctx.total === 1) {
          const only =
            cash === "pass"
              ? "התזרים החופשי חיובי, והוא המבחן היחיד בקבוצה הזו שניתן היה לחשב. תזרים חיובי אומר שהרווח מתורגם למזומן — הוא לא אומר שהרווחיות טובה מהמתחרות, כי שני המבחנים שהיו משווים אותה אינם בדוחות."
              : "מבחן אחד בלבד בקבוצה הזו ניתן היה לחשב, והוא עבר. ראיה אחת אינה הסכמה בין ראיות, וזה ההבדל בין איכות מוכחת לאיכות שלא נסתרה.";
          return only;
        }
        return ctx.total === 3
          ? "המבחנים שעברו נשענים על חלקים שונים בדוח — הרווח התפעולי, בסיס ההון והתזרים — ולכן הסכמה ביניהם קשה יותר לייצר מפריט חשבונאי חד-פעמי אחד."
          : "המבחנים שעברו נשענים על חלקים שונים בדוח, ולכן הסכמה ביניהם קשה יותר לייצר מפריט חשבונאי חד-פעמי אחד.";
      }

      /* "pass", not "not fail". A criterion that could not be computed is
         also not a failure, and this branch used to collect it: Citigroup
         arrives with ROIC and operating margin both uncomputable and was
         told its profitability sits above the sector median, two lines
         above a table printing "—" for each of them. The sentence and the
         ledger in the same open row contradicted each other. */
      if (cash === "fail" && roic === "pass" && margin === "pass") {
        return "הרווחיות מעל חציון הסקטור בזמן שהתזרים החופשי שלילי. הפער בין רווח למזומן הוא המקום שבו השקעה כבדה, הון חוזר תופח או תגמול במניות נבלעים — והוא נקרא בדוח התזרים, לא בשורה התחתונה.";
      }
      /* The same shape with the profitability side missing rather than
         strong. Only the one figure that exists is spoken about. */
      if (cash === "fail" && roic !== "fail" && margin !== "fail") {
        return "התזרים החופשי שלילי, ושני מבחני הרווחיות האחרים לא ניתנים לחישוב מהדוחות שהוגשו — כך שאין כאן במה להעמיד את התזרים. תזרים שלילי לבדו אינו מבדיל בין חברה שמשקיעה בכוונה לבין חברה ששורפת מזומן.";
      }
      if (roic === "fail" && margin === "pass") {
        return "המרווח התפעולי מעל חציון הסקטור אבל התשואה על ההון מתחתיו. זה הפרופיל של עסק שמרוויח טוב על כל מכירה וצריך הרבה הון כדי לייצר אותה — מרווח גבוה על בסיס נכסים כבד.";
      }
      if (margin === "fail" && roic === "pass") {
        return "ה-ROIC מעל חציון הסקטור בזמן שהמרווח התפעולי מתחתיו — עסק שמסתובב מהר על מעט הון, ולא עסק עם כוח תמחור.";
      }
      if (ctx.passed === 0) {
        return "הרווחיות מתחת לחציון הסקטור: החברה מקבלת פחות על אותה פעילות מהמתחרות שלה. הדוח לא מפריד בין תמהיל מוצרים לחולשה בכוח התמחור, ואלה שתי סיבות שונות לחלוטין לאותו מספר.";
      }
      return "המדדים האלה בודקים את אותה שאלה מזוויות שונות, ואי-הסכמה ביניהם היא בדרך כלל הסימן שאחת הזוויות נושאת פריט חד-פעמי או בסיס נכסים יוצא דופן.";
    },
  },
  {
    key: "growth",
    label: "צמיחה",
    keys: ["rev_growth", "rev_growth_sector"],
    meaning: (ctx) => {
      const absolute = ctx.statusOf("rev_growth");
      const relative = ctx.statusOf("rev_growth_sector");

      if (ctx.tone === "support") {
        return ctx.total === 2
          ? "ההכנסות צומחות, וצומחות מהר מחציון הסקטור. שני המבחנים נגזרים מאותו CAGR תלת-שנתי ולכן אינם שני עדים נפרדים — אבל חלון של שלוש שנים מחליק מעל רבעון חלש אחד, וזה מה שמבדיל מגמה מתיקון."
          : "ההכנסות צומחות על חלון של שלוש שנים — חלון שמחליק מעל רבעון חלש אחד.";
      }
      if (absolute === "pass" && relative === "fail") {
        return "ההכנסות צומחות אבל איטי מחציון הסקטור. גם צמיחה חיובית שמפגרת אחרי החציון היא אובדן נתח שוק — רק אטי מספיק כדי לא להיראות כך בדוח רבעוני.";
      }
      if (relative === "pass" && absolute === "fail") {
        return "ההכנסות אינן צומחות, אך הצטמקו פחות מחציון הסקטור. זה ממצא על הסקטור שסביב החברה לפני שהוא ממצא על החברה.";
      }
      if (absolute === "fail" && relative === "fail") {
        return "ההכנסות לא צמחו בשלוש השנים האחרונות וגם לא מול חציון הסקטור. חלון תלת-שנתי מחליק מעל רבעון חלש אחד, ולכן מספר שלילי כאן מתאר מגמה ולא תקלה.";
      }
      return "מבחני הצמיחה אינם מסכימים ביניהם, והם נגזרים מאותו CAGR תלת-שנתי — כלומר ההבדל ביניהם הוא החציון שאליו הם מושווים.";
    },
  },
  {
    key: "value",
    label: "תמחור",
    keys: ["pe", "ev_fcf"],
    meaning: (ctx) => {
      const earnings = ctx.statusOf("pe");
      const cash = ctx.statusOf("ev_fcf");

      if (ctx.tone === "support") {
        return ctx.total === 2
          ? "זולה מחציון הסקטור גם על הרווח וגם על התזרים. שני המכפילים נמדדים מול הסקטור ולא מול סף מוחלט, ולכן מה שהם אומרים הוא ״זולה מול מי שעושה את אותו דבר״ — ולא ״זולה״."
          : "המכפיל שנבדק נמוך מחציון הסקטור. הוא נמדד מול הסקטור ולא מול סף מוחלט, ולכן הוא אומר ״זולה מול מי שעושה את אותו דבר״ — ולא ״זולה״.";
      }
      if (earnings === "pass" && cash === "fail") {
        return "זולה על הרווח ולא על התזרים. EV/FCF סופר את החוב ואת ההשקעות ו-P/E לא, כך שהפער בין שני המכפילים הוא בדרך כלל המאזן — שמופיע באחד ונעדר מהשני.";
      }
      if (cash === "pass" && earnings === "fail") {
        return "זולה על התזרים ולא על הרווח. זה מה שקורה כשפחת, מחיקה או תגמול במניות מכים ברווח החשבונאי בזמן שהמזומן עצמו ממשיך לזרום.";
      }
      if (earnings === "fail" && cash === "fail") {
        return "שני המכפילים מעל חציון הסקטור: השוק משלם כאן יותר מאשר על המתחרות. פרמיה אינה טעות — היא ציפייה, והיא מחייבת שמה שמצדיק אותה יימשך.";
      }
      if (earnings === "fail") {
        return "ה-P/E מעל חציון הסקטור. זה לא אומר יקרה, אלא שהשוק מתמחר כאן משהו שהמתחרות לא מקבלות עליו קרדיט — ומה שנשאר לקרוא הוא מה.";
      }
      return "ה-EV/FCF מעל חציון הסקטור. המכפיל הזה סופר את החוב, ולכן חברה שנראית זולה על הרווח יכולה להיראות יקרה עליו.";
    },
  },
  {
    key: "strength",
    label: "איתנות",
    keys: ["net_debt_ebitda", "interest_coverage", "altman_z"],
    meaning: (ctx) => {
      const leverage = ctx.statusOf("net_debt_ebitda");
      const coverage = ctx.statusOf("interest_coverage");
      const distress = ctx.statusOf("altman_z");

      if (ctx.tone === "support") {
        /* Same plural trap as the quality group. With one test computed the
           sentence cannot speak about "these tests" agreeing, and which one
           survived changes what may be claimed: Altman Z alone is a
           distress model, not a statement about debt service. */
        if (ctx.total === 1) {
          if (distress === "pass") {
            return "Altman Z באזור הבטוח, והוא המבחן היחיד בקבוצה הזו שניתן היה לחשב. המודל מסמן שהסתברות המצוקה נמוכה — הוא אינו מודד את גודל החוב ואינו אומר שכיסוי הריבית נוח, ושני המבחנים שהיו אומרים זאת אינם בדוחות.";
          }
          return "מבחן מאזני אחד בלבד ניתן היה לחשב, והוא עבר. שלושת מבחני הקבוצה נגזרים מאותו מאזן, ולכן ראיה אחת מתוכם היא זווית אחת על אותה שאלה — לא שלוש.";
        }
        return "המבחנים האלה לא מודדים את גודל החוב אלא את היכולת לשרת אותו ולמחזר אותו. כשהם עוברים, רבעון חלש נשאר רבעון חלש ולא הופך לשאלה על המאזן.";
      }
      if (ctx.passed === 0 && ctx.total === 3) {
        return "המינוף, כיסוי הריבית ומדד המצוקה כולם מחוץ לטווח. שלושתם נגזרים מאותו מאזן ולכן אינם שלוש ראיות נפרדות — הם אותה ראיה משלוש זוויות, וזו גם הסיבה שהם נוטים לזוז יחד.";
      }
      if (leverage === "fail") {
        return "המינוף הוא מה שלא עבר כאן, והוא קריטריון שמתנהג אחרת מכל השאר: הוא אינו מוריד את התשואה אלא מקצר את הזמן שיש לעסק לטעות בו. חוב נטו גבוה אינו סותר רווחיות גבוהה — הוא קובע מה יקרה אם הרווחיות תיחלש.";
      }
      if (coverage === "fail") {
        return "כיסוי הריבית דק. כל עוד הרווח התפעולי מחזיק זה לא נראה בדוח; הוא נראה ברבעון שבו הוא לא מחזיק, וזה גם הרבעון שבו מחזור חוב מתייקר.";
      }
      if (distress === "fail") {
        return "Altman Z מתחת לרף שהמודל מגדיר כאזור בטוח. המדד נבנה כדי לסמן מצוקה פיננסית מחמישה יחסים מאזניים, והוא אינו תחזית לחדלות פירעון — הוא אומר שהמאזן נמצא מחוץ לרשת הביטחון שהמודל מצייר.";
      }
      return "חלק ממבחני המאזן לא עברו. שלושתם נגזרים מאותו דוח, ולכן כישלון באחד מהם הוא בדרך כלל הסימן המוקדם של השניים האחרים.";
    },
  },
];

/** Criteria the four groups above do not claim. Not expected today, and the
 *  screener gains tests over time — a criterion that lands here is counted
 *  in the score and left uninterpreted rather than quietly dropped into a
 *  group whose sentence does not describe it. */
const RESIDUAL = {
  key: "other",
  label: "נוספים",
  meaning:
    "מבחנים שאינם משתייכים לאחת מארבע הקבוצות. הם נספרים בציון, והקריאה הזו אינה מפרשת אותם.",
};

/* ------------------------------------------------------------------ */
/* Assembly                                                            */
/* ------------------------------------------------------------------ */

function toneOf(passed: number, total: number): ReadingTone {
  if (passed === total) return "support";
  if (passed === 0) return "counter";
  return "mixed";
}

function clauseFrom(
  key: string,
  label: string,
  members: Criterion[],
  meaning: (ctx: ThemeContext) => string,
): ReadingClause | null {
  /* A test the filings do not support is absent from the denominator, not
     a miss in it — the same rule the meters are drawn under. */
  const evaluated = members.filter((c) => c.status !== "insufficient-data");
  if (evaluated.length === 0) return null;

  const passed = evaluated.filter((c) => c.status === "pass").length;
  const tone = toneOf(passed, evaluated.length);

  const ctx: ThemeContext = {
    passed,
    total: evaluated.length,
    statusOf: (wanted) =>
      members.find((c) => c.key === wanted)?.status ?? "absent",
    tone,
  };

  return {
    key,
    label,
    tone,
    passed,
    total: evaluated.length,
    counters: evaluated
      .filter((c) => c.status === "fail")
      .map((c) => ({ label: c.label, detail: c.detail, benchmark: c.benchmark })),
    meaning: meaning(ctx),
  };
}

/** `support` first, then `mixed`, then `counter`; inside a tone, the
 *  strongest showing first. Index breaks ties so the order is stable
 *  between builds rather than depending on the sort implementation. */
const TONE_ORDER: Record<ReadingTone, number> = {
  support: 0,
  mixed: 1,
  counter: 2,
};

/** "באיכות, בתמחור ובאיתנות" — the Hebrew list, with the preposition on
 *  every item and the conjunction only on the last. Written out because
 *  joining with a plain separator produces a sentence nobody would say. */
function joinWithPrefix(labels: string[]): string {
  const parts = labels.map((label) => `ב${label}`);
  const last = parts.pop() ?? "";
  return parts.length === 0 ? last : `${parts.join(", ")} ו${last}`;
}

function leadFrom(
  result: ScreenResult,
  axes: ReadingClause[],
  themeOf: (key: string) => string,
): ReadingSegment[] {
  const evaluated = result.evaluatedCount;
  const passed = result.score;
  const failures = result.criteria.filter((c) => c.status === "fail");

  if (evaluated === 0) {
    return [
      { text: "אף אחד מ-" },
      { text: String(result.maxScore), num: true },
      {
        text: " המבחנים אינו ניתן לחישוב מהדוחות של החברה הזו. מה שיש כאן אינו קריאה אלא היעדר נתונים.",
      },
    ];
  }

  if (failures.length === 0) {
    return [
      { text: "כל " },
      { text: String(evaluated), num: true },
      {
        text: " המבחנים שניתן היה לחשב עברו. מה שזה אומר הוא שבמספרים האלה אין צד שני — לא שאין צד שני.",
      },
    ];
  }

  if (passed === 0) {
    return [
      { text: "אף אחד מ-" },
      { text: String(evaluated), num: true },
      {
        text: " המבחנים שניתן היה לחשב לא עבר. זה אינו תיאור של חברה בדרך לקריסה — זה אומר שבמדדים האלה אין צד שמחזיק טיעון לטובתה.",
      },
    ];
  }

  if (failures.length === 1) {
    const only = failures[0];
    return [
      { text: "עברה " },
      { text: String(passed), num: true },
      { text: " מתוך " },
      { text: String(evaluated), num: true },
      { text: ` המבחנים שניתן היה לחשב. היחיד שלא עבר הוא ״${only.label}״ — ` },
      { text: only.detail, num: true },
      ...(only.benchmark
        ? [{ text: " מול " }, { text: only.benchmark, num: true }]
        : []),
      { text: ` — כך שכל הטיעון הנגדי כאן יושב ${joinWithPrefix([themeOf(only.key)])}.` },
    ];
  }

  /* In the meters' order, not in the reading's. The lead is read while the
     eye is still on the row above it, and naming the groups in the sequence
     they are drawn in is what lets a reader find them. */
  const against = axes.filter((c) => c.tone !== "support").map((c) => c.label);
  const hollow = axes.filter((c) => c.tone === "counter").map((c) => c.label);
  /* Every failure in one group, and that group holding nothing else, is the
     common case — naming it twice ("the other side sits in valuation. In
     valuation nothing passed") is the sentence this guard exists to avoid. */
  const concentrated = hollow.length > 0 && hollow.length === against.length;

  return [
    { text: "עברה " },
    { text: String(passed), num: true },
    { text: " מתוך " },
    { text: String(evaluated), num: true },
    {
      text: ` המבחנים שניתן היה לחשב, והצד הנגדי יושב ${
        concentrated ? "כולו " : ""
      }${joinWithPrefix(against)}${
        concentrated
          ? " — שם לא עבר אף מבחן."
          : hollow.length > 0
            ? `. ${joinWithPrefix(hollow)} לא עבר אף מבחן.`
            : "."
      }`,
    },
  ];
}

/**
 * Where the two sides contradict each other.
 *
 * This is the part worth reading twice, and the reason the module exists:
 * a company that is cheap on every measure and shrinking on every measure
 * is telling the reader something that averaging the two into a score
 * throws away. The rules are ordered by how much they explain, and the
 * first match wins — a row gets one tension, not a list.
 */
function tensionFrom(
  find: (key: string) => ReadingClause | null,
  statusOf: (key: string) => Criterion["status"] | null,
): string | null {
  const quality = find("quality");
  const growth = find("growth");
  const value = find("value");
  const strength = find("strength");

  const holds = (clause: ReadingClause | null) => clause !== null && clause.tone === "support";
  const opposes = (clause: ReadingClause | null) => clause !== null && clause.tone === "counter";

  /**
   * The valuation group holds two tests, and for part of the universe only
   * one of them can be computed — EV/FCF needs a positive free cash flow
   * the filings do not always carry. The clause above the tension already
   * says "ה-P/E" in the singular in that case; these sentences said "שני
   * המכפילים" regardless, so the same open panel made two different claims
   * about how many figures exist. Ten names in the universe hit it.
   *
   * Two forms, because the phrase appears in two grammatical positions.
   */
  /**
   * The same trap one level up, and it caught these sentences too.
   *
   * A clause's tone is "support" when every test that could be computed
   * passed — which is not the same as every test existing. Seven names in
   * the universe arrive with ROIC and operating margin both uncomputable
   * and only the cash test standing, and the sentences below told the
   * reader their profitability sits above the sector median on the
   * strength of two figures nobody calculated.
   *
   * So the quality side only speaks about profitability when at least one
   * of the two sector-relative profitability tests was actually measured.
   * The cash test is "free cash flow positive" — a sign test, not a
   * comparison — so it cannot stand in for that sentence, and the
   * cash-only case gets its own wording below instead of borrowing it.
   */
  const profitMeasured =
    statusOf("roic") !== "insufficient-data" ||
    statusOf("operating_margin") !== "insufficient-data";

  const bothMultiples = (value?.total ?? 0) >= 2;
  const multiplesBelow = bothMultiples
    ? "המכפילים מתחת לחציון הסקטור"
    : "המכפיל שנבדק מתחת לחציון הסקטור";
  const multiplesAbove = bothMultiples
    ? "המכפילים מעל חציון הסקטור"
    : "המכפיל שנבדק מעל חציון הסקטור";
  const alsoAbove = bothMultiples
    ? "והמכפילים מעליו גם הם"
    : "והמכפיל שנבדק מעליו גם הוא";

  /* And the same again for the profitability side. "הרווחיות" unqualified
     stands for two sector-relative tests; when only one of them exists the
     sentence names it, so the prose and the ledger under it count the same
     figures. ISRG arrives with ROIC uncomputable and its operating margin
     above the median — true of the margin, not of "profitability".
     The gender flag is not decoration: "הרווחיות ... מתחתיו גם היא" and
     "המרווח התפעולי ... מתחתיו גם הוא" are both required, and Hebrew has
     no neutral form to fall back on. */
  const bothProfit =
    statusOf("roic") !== "insufficient-data" &&
    statusOf("operating_margin") !== "insufficient-data";
  const profit = bothProfit
    ? "הרווחיות"
    : statusOf("roic") !== "insufficient-data"
      ? "ה-ROIC"
      : "המרווח התפעולי";
  const profitFem = bothProfit;

  /* And once more for the balance sheet. The strength group holds two
     leverage tests — net debt to EBITDA and interest coverage — plus
     Altman Z, which is a distress probability model and not a debt ratio.
     Four names (PGR, BMY, SCHW, COP) arrive with both leverage tests
     uncomputable and Altman Z as the only evidence, and the sentences
     below argued from a leverage figure the repo does not have. When that
     is the case the sentence names the model instead, and says what the
     model can and cannot settle. */
  const leverageMeasured =
    statusOf("net_debt_ebitda") !== "insufficient-data" ||
    statusOf("interest_coverage") !== "insufficient-data";

  /* The quality group exists but only its cash test could be computed. That
     is a real finding — and the honest version of it is shorter than the
     profitability sentence it replaces, because it has one figure behind it
     instead of three. It is stated rather than dropped: a reader looking at
     a premium multiple is owed the fact that the evidence which would
     normally justify one is missing from the filings, not merely weak. */
  if (!profitMeasured && quality !== null && opposes(value)) {
    return `התזרים החופשי חיובי, אבל שני מבחני הרווחיות מול הסקטור — ROIC ומרווח תפעולי — אינם ניתנים לחישוב מהדוחות שהוגשו, ו${multiplesAbove}. פרמיה נקראת מול רווחיות, וכאן יש מזומן בלי שתי הראיות שהיו מעמידות אותו מול המתחרות.`;
  }
  if (!profitMeasured && quality !== null && opposes(growth)) {
    return "התזרים החופשי חיובי וההכנסות אינן צומחות, בזמן ששני מבחני הרווחיות מול הסקטור אינם ניתנים לחישוב מהדוחות. מזומן בלי צמיחה הוא תיאור של עסק יציב או של עסק שנעצר, וההבדל ביניהם נקרא ברווחיות — שחסרה כאן.";
  }

  if (profitMeasured && holds(quality) && opposes(value)) {
    return `${profit} מעל חציון הסקטור ${alsoAbove}. אין כאן אי-הסכמה בין המדדים אלא העסקה שהשוק מציע: האיכות הזו כבר מתומחרת, והמחיר מניח שהיא נמשכת. מה שנשאר לקרוא הוא לכמה זמן.`;
  }
  if (profitMeasured && holds(value) && opposes(quality)) {
    return `${multiplesBelow} ו${profit} מתחתיו גם ${profitFem ? "היא" : "הוא"}. מכפיל נמוך על עסק שמרוויח פחות מהמתחרות אינו בהכרח הנחה — הוא גם התיאור של מה שהשוק מתמחר, ושני ההסברים נראים אותו דבר בטבלה.`;
  }
  if (profitMeasured && holds(quality) && opposes(strength)) {
    return leverageMeasured
      ? `${profit} מעל חציון הסקטור והמאזן נושא את העומס. שתי הראיות אינן סותרות זו את זו אלא פועלות בזמנים שונים: הרווחיות היא מה שקורה עכשיו, המינוף הוא מה שקובע כמה זמן יש אם היא נחלשת.`
      : `${profit} מעל חציון הסקטור ו-Altman Z מתחת לאזור הבטוח, בזמן ששני מבחני המינוף עצמם — חוב נטו ל-EBITDA וכיסוי ריבית — אינם ניתנים לחישוב מהדוחות שהוגשו. Altman Z הוא מודל הסתברות למצוקה ולא יחס חוב: הוא מצביע על כיוון בלי לומר כמה חוב יש ומתי הוא נפרע.`;
  }
  if (holds(value) && opposes(growth)) {
    return `${multiplesBelow} וההכנסות אינן צומחות. זו אותה תצורה שנראית כמו הזדמנות וכמו מלכודת, וההבדל ביניהן הוא האם הצמיחה נעצרה מסיבה שחולפת — מה שאין בדוחות האלה תשובה עליו.`;
  }
  if (profitMeasured && holds(growth) && opposes(quality)) {
    return `ההכנסות גדלות מהר מהסקטור בלי ש${profit} ${profitFem ? "מגיעה" : "מגיע"} אחריהן. צמיחה שאינה מתורגמת למרווח היא בדרך כלל צמיחה שנקנית — בהנחות, בשיווק או בכוח אדם — וכל אחד מהשלושה נראה אחרת כשהקצב מואט.`;
  }
  if (profitMeasured && holds(strength) && opposes(quality)) {
    return leverageMeasured
      ? `המאזן איתן ו${profit} מתחת לחציון הסקטור. מאזן חזק קונה זמן, הוא לא קונה תשואה על ההון — והראיה הזו אומרת שהזמן קיים, לא שמשתמשים בו.`
      : `Altman Z באזור הבטוח ו${profit} מתחת לחציון הסקטור, בזמן ששני מבחני המינוף עצמם אינם ניתנים לחישוב מהדוחות. המודל אומר שהסיכון למצוקה נמוך — הוא לא אומר שהמאזן איתן, ואלה שתי קביעות שונות.`;
  }
  if (profitMeasured && holds(quality) && opposes(growth)) {
    return `${profit} מעל חציון הסקטור וההכנסות אינן צומחות. עסק רווחי שאינו גדל תלוי כולו בשמירה על המרווח, וזה בדיוק מה שתחרות תוקפת ראשון.`;
  }
  if (holds(growth) && opposes(value)) {
    return `הצמיחה מעל חציון הסקטור ${alsoAbove}. זו צמיחה במחיר, וזה טיעון שלם רק עם המספר שלא נמצא כאן: כמה שנים של צמיחה המכפיל הזה כבר מניח.`;
  }
  return null;
}

function missingFrom(result: ScreenResult): ReadingSegment[] | null {
  const absent = result.criteria.filter((c) => c.status === "insufficient-data");
  if (absent.length === 0) return null;

  const labels = absent.map((c) => c.label).join(" · ");
  if (absent.length === 1) {
    return [{ text: `מבחן אחד אינו ניתן לחישוב מהדוחות: ${labels}.` }];
  }
  return [
    { text: String(absent.length), num: true },
    { text: ` מבחנים אינם ניתנים לחישוב מהדוחות: ${labels}.` },
  ];
}

/**
 * The reading for one screened company.
 *
 * Reads nothing but the result it is handed, so it is safe to call once per
 * row while the register renders.
 */
export function readScreen(result: ScreenResult): ScreenReading {
  const claimed = new Set(THEMES.flatMap((theme) => theme.keys));

  const axes: ReadingClause[] = [];
  for (const theme of THEMES) {
    const members = result.criteria.filter((c) => theme.keys.includes(c.key));
    const clause = clauseFrom(theme.key, theme.label, members, theme.meaning);
    if (clause) axes.push(clause);
  }

  const residual = result.criteria.filter((c) => !claimed.has(c.key));
  if (residual.length > 0) {
    const clause = clauseFrom(
      RESIDUAL.key,
      RESIDUAL.label,
      residual,
      () => RESIDUAL.meaning,
    );
    if (clause) axes.push(clause);
  }

  /* The same objects, in reading order. The meters need the fixed sequence
     above so the columns align down the register; the prose needs the
     supporting side first. */
  const clauses = axes
    .map((clause, index) => ({ clause, index }))
    .sort(
      (a, b) =>
        TONE_ORDER[a.clause.tone] - TONE_ORDER[b.clause.tone] ||
        b.clause.passed / b.clause.total - a.clause.passed / a.clause.total ||
        a.index - b.index,
    )
    .map((entry) => entry.clause);

  const themeOf = (key: string) =>
    THEMES.find((theme) => theme.keys.includes(key))?.label ?? RESIDUAL.label;

  return {
    lead: leadFrom(result, axes, themeOf),
    axes,
    clauses,
    tension: tensionFrom(
      (key) => axes.find((clause) => clause.key === key) ?? null,
      (key) => result.criteria.find((c) => c.key === key)?.status ?? null,
    ),
    missing: missingFrom(result),
  };
}
