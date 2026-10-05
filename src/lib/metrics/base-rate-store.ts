import { readFile } from "node:fs/promises";
import { join } from "node:path";
import type { BaseRateRead, Outcome } from "./base-rates";
import { MIN_SAMPLE } from "./base-rates";

/**
 * The measured file, read back, and the one sentence that turns a row of
 * figures into a reading.
 *
 * The file is written by `scripts/build-base-rates.ts` on a schedule. The
 * site never measures during a request: ten years of candles for a
 * hundred and twenty-three names is minutes of work.
 */

type File = { builtAt: string; reads: Record<string, BaseRateRead> };

let cache: File | null = null;

export async function getBaseRates(): Promise<File> {
  if (cache) return cache;
  try {
    const raw = await readFile(
      join(process.cwd(), "content/base-rates/latest.json"),
      "utf8",
    );
    cache = JSON.parse(raw) as File;
  } catch {
    cache = { builtAt: "", reads: {} };
  }
  return cache;
}

export async function baseRatesFor(
  ticker: string,
): Promise<BaseRateRead | null> {
  const file = await getBaseRates();
  return file.reads[ticker.toUpperCase()] ?? null;
}

/* ------------------------------------------------------------------ */
/* The reading                                                         */
/* ------------------------------------------------------------------ */

/**
 * How far a conditional rate has to sit from its own baseline before it is
 * worth a sentence.
 *
 * Ten points is not a significance test and is not presented as one. It is
 * the distance below which a difference measured on tens of overlapping
 * windows is indistinguishable from the window you happened to measure —
 * and the measurements say that most conditions, on most names, sit well
 * inside it. That is the finding, not a failure of the method.
 */
const MEANINGFUL_PP = 10;

export type Verdict = "no-signal" | "leans-up" | "leans-down" | "too-few";

export type Reading = {
  verdict: Verdict;
  /** One sentence, in the reader's language, stating what was measured. */
  sentence: string;
};

const horizonWord = (days: number) =>
  days === 5 ? "שבוע" : days === 10 ? "שבועיים" : days === 21 ? "חודש" : "רבעון";

/**
 * Says what the numbers say, and says "nothing" out loud when that is the
 * answer.
 *
 * The temptation in a feature like this is to always produce a direction,
 * because a row that says "no signal" looks like the product failed. It is
 * the opposite: a reader told that the fifty-day reclaim on this name has
 * historically been worth two points against its own baseline has learned
 * something real and slightly unwelcome, and that is the whole value.
 * Rule 8 is satisfied the same way — this describes a measurement, it does
 * not say what to do about one.
 */
export function readOutcome(label: string, outcome: Outcome): Reading {
  if (outcome.n < MIN_SAMPLE) {
    return {
      verdict: "too-few",
      sentence: `${label}: רק ${outcome.n} מופעים בעשר השנים — מעט מדי מכדי להציג שיעור.`,
    };
  }

  const span = horizonWord(outcome.days);
  const cond = Math.round(outcome.up * 100);
  const base = Math.round(outcome.baselineUp * 100);
  const lift = Math.round(outcome.liftPp);

  /* "measurable" and not "all of them": an occurrence in the last few
     weeks has no month after it yet, so it is counted in the header and
     not in this horizon. Without the word the two numbers on screen look
     like a contradiction. */
  const counted = `${outcome.n} המופעים שניתן למדוד לטווח הזה`;

  if (Math.abs(outcome.liftPp) < MEANINGFUL_PP) {
    return {
      verdict: "no-signal",
      sentence:
        `${label}: ${cond}% מתוך ${counted} היו גבוהים יותר אחרי ${span} — ` +
        `אבל יום אקראי במניה הזו היה גבוה יותר ב-${base}% מהמקרים. ` +
        `ההפרש ${lift >= 0 ? "+" : ""}${lift} נקודות אחוז, כלומר התנאי לא הוסיף מידע מעבר למגמה.`,
    };
  }

  return {
    verdict: outcome.liftPp > 0 ? "leans-up" : "leans-down",
    sentence:
      `${label}: ${cond}% מתוך ${counted} היו גבוהים יותר אחרי ${span}, ` +
      `מול ${base}% ביום אקראי — הפרש של ${lift >= 0 ? "+" : ""}${lift} נקודות אחוז. ` +
      `חציון התנועה ${outcome.medianPct.toFixed(1)}% מול ${outcome.baselineMedianPct.toFixed(1)}%, ` +
      `והמקרה הגרוע ביותר היה ${outcome.worstPct.toFixed(1)}%.`,
  };
}

export { MIN_SAMPLE };
