/**
 * What happened the last hundred times this chart looked like this.
 *
 * Everything else in `metrics/` describes the state the price is in now:
 * the stage, the trend template, the contraction, the distance to the
 * fifty-day. None of it says what that state has historically been
 * followed by — so the site could tell a reader "price reclaimed the
 * fifty-day today" and stop at the one sentence that raises the question.
 *
 * This measures the answer, on the instrument in front of them, out of
 * their own price history. Not a published study, not a figure a model
 * remembered, not a rule of thumb: every number here is counted from the
 * candles the chart is drawn from, and the count is printed beside it.
 *
 * WHY THIS IS NOT A FORECAST, AND WHY THAT MATTERS MORE THAN IT SOUNDS.
 * A base rate is a statement about the past of one instrument. It is
 * conditional on a regime that may have ended, the sample is small by the
 * standards of real statistics, and the same ticker supplies every
 * observation, so the trials are not independent — three bull years will
 * make almost any bullish condition look excellent. The output therefore
 * carries `n`, the window it was measured over, and the plain warning that
 * overlapping windows are correlated. A rate without its sample is the
 * exact failure rule 9 exists to prevent, which is why `scrubStatistic` in
 * the chart reader deletes percentages a model produced: those had no
 * sample behind them. These do.
 *
 * WHAT IT WILL NOT DO. It will not rank conditions, score them, or say
 * which is worth acting on. It reports, for a named and observable
 * condition, the distribution of what came next. The reader does the
 * arithmetic about whether that is worth anything — which is rule 8, and
 * also simply true: a 70% rate on eleven overlapping observations is not
 * a 70% chance of anything.
 */

import type { Candle } from "@/lib/sources/prices";
import { rsi, sma } from "./technical";
import { readBar, type BarRead } from "./tape";
import {
  PRICE_CRITERIA,
  priceCriteriaPassed,
  templateFactsAt,
} from "./technical";

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

/** Trading days ahead that a reader can actually hold a view over. One
 *  week, two weeks, a month, a quarter — the spans a swing position is
 *  judged on, and short enough that a daily chart has something to say
 *  about them. */
export const HORIZONS = [5, 10, 21, 63] as const;
export type Horizon = (typeof HORIZONS)[number];

export type Outcome = {
  /** Trading days forward. */
  days: Horizon;
  /** How many of the occurrences had this much history left after them. */
  n: number;
  /** Share of those that were higher than the trigger close, 0..1. */
  up: number;
  /** Median move, in percent. The median rather than the mean: one 2020
   *  candle drags an average somewhere no typical case ever went. */
  medianPct: number;
  /** The middle half of the outcomes, in percent — the honest picture of
   *  the spread that a single number hides. */
  p25Pct: number;
  p75Pct: number;
  /** The worst single outcome, in percent. A reader deciding what they are
   *  exposed to needs the tail, not just the centre. */
  worstPct: number;
  /**
   * The same two figures for EVERY day in the window, condition or not.
   *
   * This is the most important pair in the file and it was not in the
   * first version, which is how the first version came out wrong. Measured
   * on NVDA over ten years, "closed back above the fifty-day" was followed
   * by a higher price 67% of the time — and so was "closed back BELOW the
   * fifty-day", 72% of the time. On TTWO the death cross came in at 88%.
   * Nothing is inverted; the stock simply rose, and a condition measured
   * against nothing reports the drift it was riding.
   *
   * So the conditional rate is never shown alone. What a reader needs is
   * the distance between the two, and when that distance is small the
   * honest reading is that the signal carried no information.
   */
  baselineUp: number;
  baselineMedianPct: number;
  /** Conditional minus unconditional, in percentage points. The only
   *  number here that is about the SIGNAL rather than about the stock. */
  liftPp: number;
  /**
   * The path, not just the destination.
   *
   * `medianAdversePct` is the typical furthest the price fell below the
   * trigger close during the window, and `medianFavourablePct` the
   * typical furthest it rose above it. Both are medians of the
   * per-occurrence extreme, so they describe a middling case rather than
   * the worst one.
   *
   * They are here because the close at the horizon hides the only thing
   * that decides whether a setup was survivable. Each is printed beside
   * its unconditional twin for the reason every rate in this file is:
   * a drawdown of six per cent means nothing until you know that an
   * arbitrary month on the same stock also drew down six.
   */
  medianAdversePct: number;
  medianFavourablePct: number;
  baselineAdversePct: number;
  baselineFavourablePct: number;
};

export type ConditionRead = {
  key: string;
  /** What was measured, as an observable event rather than a judgement. */
  label: string;
  /** Whether the condition is true on the final candle. */
  activeNow: boolean;
  /** Every time it fired in the window, oldest first. */
  occurrences: number;
  /** The most recent firing, as a date, or null when it never fired. */
  lastAt: string | null;
  outcomes: Outcome[];
};

export type BaseRateRead = {
  symbol: string;
  /** First and last candle actually measured. */
  from: string;
  to: string;
  sessions: number;
  conditions: ConditionRead[];
  /** The caveats that belong beside every figure above, in the reader's
   *  language. Carried in the data so no page can render the numbers and
   *  forget the sentence. */
  caveats: string[];
};

/**
 * Below this, a share is not reported as a share.
 *
 * Eight is not a statistically respectable sample and is not claimed to
 * be. It is the point under which a percentage is actively misleading —
 * three out of four is "75%" and is nothing at all — and the output says
 * "too few" instead. Above it the number is still fragile, which is what
 * `n` printed beside it is for.
 */
export const MIN_SAMPLE = 8;

/* ------------------------------------------------------------------ */
/* Conditions                                                          */
/* ------------------------------------------------------------------ */

/**
 * A condition is a pure predicate over the series at one index.
 *
 * Every one of them is an EVENT rather than a STATE — the day the cross
 * happened, not every day the average stayed above. Measuring a state
 * counts the same advance five hundred times and reports the trend it was
 * already in as if it had predicted it; measuring the event counts each
 * occurrence once.
 */
type Series = {
  candles: Candle[];
  sma20: (number | null)[];
  sma50: (number | null)[];
  sma200: (number | null)[];
  rsi14: (number | null)[];
  /**
   * How many of the trend template's seven price criteria held on each
   * bar, from the same reader the panel uses.
   *
   * This is the site measuring its own instrument. Everything else in this
   * file counts a condition somebody else wrote down — a moving-average
   * cross, an RSI threshold, a volume multiple — and reports what followed.
   * None of it asks the question a reader of THIS site would ask first:
   * when this page said a stock met the template, what happened next.
   */
  template: { passed: number; evaluated: number }[];

  /**
   * Every bar read by `tape.ts`, computed once for the whole series.
   *
   * The volume conditions below are defined by the character the tape
   * assigns, not by a second copy of the thresholds — rule 4. That matters
   * more here than usual: if this file decided for itself what "extreme
   * volume" meant, a panel could report absorption on today's bar and the
   * base rate beside it could have been measured on a different event
   * wearing the same word. The reading and its track record have to come
   * from one definition or the pairing is a lie.
   *
   * Null where the history behind the bar is too short to rank it.
   */
  bars: (BarRead | null)[];
};

type Condition = {
  key: string;
  label: string;
  /** True on the bar where the event occurs. */
  at: (s: Series, i: number) => boolean;
};

const above = (value: number | null | undefined, line: number | null) =>
  value != null && line != null && value > line;

const below = (value: number | null | undefined, line: number | null) =>
  value != null && line != null && value < line;

const CONDITIONS: Condition[] = [
  {
    key: "reclaim-50",
    label: "סגירה מעל הממוצע הנע 50 אחרי שהייתה מתחתיו",
    at: (s, i) =>
      i > 0 &&
      above(s.candles[i].close, s.sma50[i]) &&
      below(s.candles[i - 1].close, s.sma50[i - 1]),
  },
  {
    key: "lose-50",
    label: "סגירה מתחת לממוצע הנע 50 אחרי שהייתה מעליו",
    at: (s, i) =>
      i > 0 &&
      below(s.candles[i].close, s.sma50[i]) &&
      above(s.candles[i - 1].close, s.sma50[i - 1]),
  },
  {
    key: "golden-cross",
    label: "הממוצע הנע 50 חוצה מעלה את 200",
    at: (s, i) =>
      i > 0 &&
      above(s.sma50[i], s.sma200[i]) &&
      below(s.sma50[i - 1], s.sma200[i - 1]),
  },
  {
    key: "death-cross",
    label: "הממוצע הנע 50 חוצה מטה את 200",
    at: (s, i) =>
      i > 0 &&
      below(s.sma50[i], s.sma200[i]) &&
      above(s.sma50[i - 1], s.sma200[i - 1]),
  },
  {
    key: "rsi-leaves-oversold",
    label: "RSI עולה בחזרה מעל 30",
    at: (s, i) => {
      const now = s.rsi14[i];
      const prev = s.rsi14[i - 1];
      return now != null && prev != null && prev <= 30 && now > 30;
    },
  },
  {
    key: "rsi-leaves-overbought",
    label: "RSI יורד בחזרה מתחת ל-70",
    at: (s, i) => {
      const now = s.rsi14[i];
      const prev = s.rsi14[i - 1];
      return now != null && prev != null && prev >= 70 && now < 70;
    },
  },
  {
    key: "high-52w",
    /* 252 sessions is the year. Measured on closes, not intraday highs:
       a wick that printed for one second is not the same event as a
       market that settled there. */
    label: "סגירה בשיא של 52 שבועות",
    at: (s, i) => {
      if (i < 252) return false;
      const close = s.candles[i].close;
      for (let k = i - 252; k < i; k++) {
        if (s.candles[k].close >= close) return false;
      }
      return true;
    },
  },
  {
    key: "volume-thrust",
    /* A day that closes up on volume at least double the recent average.
       The two parts matter together: volume alone says a lot of shares
       changed hands, and the direction says who needed to. */
    label: "יום עולה במחזור כפול מהממוצע",
    at: (s, i) => {
      if (i < 50) return false;
      const c = s.candles[i];
      if (c.close <= s.candles[i - 1].close) return false;
      let sum = 0;
      for (let k = i - 50; k < i; k++) sum += s.candles[k].volume;
      const average = sum / 50;
      return average > 0 && c.volume >= average * 2;
    },
  },

  /* ---- The tape ---------------------------------------------------- */
  /*
     Six readings of the volume, each defined by `tape.ts` and measured
     here the same way the fifty-day is. This is the half of the subject
     that is normally asserted rather than counted: every book on volume
     says a climax bar marks the end of a move, and none of them says how
     often it did so on the instrument in front of you.

     The answers are frequently unflattering, which is the point. A
     condition that fires forty times in ten years and moves the rate two
     points against its own baseline has told the reader nothing, and the
     panel is built to say so in words.
  */
  {
    key: "climax-bar",
    label: "נר שיא: מחזור בחמישון העליון, טווח רחב, וסגירה שהחזירה את הקצה",
    at: (s, i) => s.bars[i]?.character === "climax",
  },
  {
    key: "absorption-bar",
    label: "ספיגה: מחזור קיצוני בטווח צר",
    at: (s, i) => s.bars[i]?.character === "absorption",
  },
  {
    key: "thrust-bar",
    label: "דחיפה: מחזור כבד, טווח רחב, סגירה בקצה",
    at: (s, i) => s.bars[i]?.character === "thrust",
  },
  {
    key: "no-demand-bar",
    label: "חוסר ביקוש: סגירה חיובית על מחזור ברבעון התחתון",
    at: (s, i) => s.bars[i]?.character === "no-demand",
  },
  {
    key: "effort-without-result",
    /* The measurement the adjectives stand for, taken on its own rather
       than through a label: volume two deviations above normal while the
       move stayed below it. A bar can show this without being extreme
       enough to be called a climax, and the gap is what is being counted. */
    label: "מאמץ בלי תוצאה: מחזור 2 סטיות מעל הרגיל והתנועה מתחת לרגיל",
    at: (s, i) => {
      const bar = s.bars[i];
      return bar != null && bar.effortZ >= 2 && bar.resultZ <= 0;
    },
  },
  /* ---- The site measuring itself ----------------------------------- */
  /*
     Every other condition in this file was written down by somebody else
     and this file reports what followed it. These two are the site's own
     instrument turned on its own history, which is the question a reader
     of THIS page would ask first and the one it has never answered: when
     this site said a stock met the trend template, what happened next.

     Measured as EVENTS, like everything else here. The day the template
     completed, not every day it stayed complete — a stock that holds all
     seven criteria for a year would otherwise contribute two hundred and
     fifty observations of the same advance and report the trend it was
     already in as though it had predicted it.

     SEVEN OF EIGHT, AND THE LABEL SAYS SO. The eighth criterion is a rank
     against the universe on that date, and reconstructing the universe at
     every historical bar is a different and far larger job. What is
     counted here is the seven that need only this instrument's own price.
  */
  {
    key: "template-complete",
    label: `היום שבו תבנית המגמה הושלמה (${PRICE_CRITERIA} מתוך ${PRICE_CRITERIA} קריטריוני המחיר)`,
    at: (s, i) => {
      if (i < 1) return false;
      const now = s.template[i];
      const prev = s.template[i - 1];
      return (
        now.evaluated === PRICE_CRITERIA &&
        now.passed === PRICE_CRITERIA &&
        prev.passed < PRICE_CRITERIA
      );
    },
  },
  {
    key: "template-broken",
    label: "היום שבו תבנית המגמה נשברה אחרי שהייתה שלמה",
    at: (s, i) => {
      if (i < 1) return false;
      const now = s.template[i];
      const prev = s.template[i - 1];
      return (
        prev.evaluated === PRICE_CRITERIA &&
        prev.passed === PRICE_CRITERIA &&
        now.passed < PRICE_CRITERIA
      );
    },
  },

  {
    key: "breakout-on-volume",
    /* The one condition here that pairs volume with a price event, because
       it is the one claim about volume that every trading book makes: a
       breakout "needs" volume. A twenty-day closing high is the breakout,
       the top fifth of the year's volume is the confirmation, and the
       measurement says whether the pair did better than the breakout
       alone — which is a comparison the reader can make, since
       `high-52w` and this sit in the same table. */
    label: "פריצה לשיא 20 יום על מחזור בחמישון העליון",
    at: (s, i) => {
      if (i < 20) return false;
      const bar = s.bars[i];
      if (!bar || bar.volumePercentile == null || bar.volumePercentile < 0.8) {
        return false;
      }
      const close = s.candles[i].close;
      for (let k = i - 20; k < i; k++) if (s.candles[k].close >= close) return false;
      return true;
    },
  },
];

/* ------------------------------------------------------------------ */
/* Measurement                                                         */
/* ------------------------------------------------------------------ */

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  if (lo === hi) return sorted[lo];
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

/** Forward moves from a set of bar indices, in percent, sorted. */
function movesFrom(candles: Candle[], from: number[], days: number): number[] {
  const moves: number[] = [];
  for (const i of from) {
    const target = i + days;
    /* An occurrence with less history after it than the horizon is not a
       loss and not a gain — it is unmeasured, and dropping it is the only
       honest option. Counting it as flat would quietly pull every long
       horizon toward zero. */
    if (target >= candles.length) continue;
    const start = candles[i].close;
    if (!(start > 0)) continue;
    moves.push(((candles[target].close - start) / start) * 100);
  }
  return moves.sort((a, b) => a - b);
}

/**
 * How far it went against you, and how far in your favour, on the way.
 *
 * `movesFrom` measures the close at the horizon and nothing in between,
 * which answers the wrong question for anybody who would actually have
 * acted on a setup. A condition can end the month +5% having been −12%
 * on day four. The reader who sees only +5% is being told the outcome of
 * a position nobody could have held.
 *
 * So this walks every bar in the window and records the two extremes
 * relative to the trigger close: the lowest low and the highest high.
 * Lows and highs rather than closes, deliberately — the question is how
 * far the price actually travelled, and a wick is where a stop would
 * have been taken out.
 *
 * WHAT IT IS NOT. This is not a stop level, a position size or a risk
 * budget, and it must never be presented as one. It is a distribution of
 * what already happened on this instrument, printed next to the
 * unconditional distribution so the reader can see whether the condition
 * changed anything at all. The site does not size trades.
 */
function excursionsFrom(
  candles: Candle[],
  from: number[],
  days: number,
): { adverse: number[]; favourable: number[] } {
  const adverse: number[] = [];
  const favourable: number[] = [];

  for (const i of from) {
    const target = i + days;
    /* Dropped for the same reason `movesFrom` drops it: unmeasured is
       not the same as flat. */
    if (target >= candles.length) continue;
    const start = candles[i].close;
    if (!(start > 0)) continue;

    let low = Infinity;
    let high = -Infinity;
    /* From the bar AFTER the trigger. The trigger bar's own low is
       history by the time its close exists, and counting it would charge
       every occurrence for a dip that had already finished. */
    for (let k = i + 1; k <= target; k++) {
      if (candles[k].low < low) low = candles[k].low;
      if (candles[k].high > high) high = candles[k].high;
    }
    if (!Number.isFinite(low) || !Number.isFinite(high)) continue;

    adverse.push(((low - start) / start) * 100);
    favourable.push(((high - start) / start) * 100);
  }

  return {
    adverse: adverse.sort((a, b) => a - b),
    favourable: favourable.sort((a, b) => a - b),
  };
}

function outcomesFor(
  candles: Candle[],
  triggers: number[],
  /** Every index the baseline is measured over, computed once per read
   *  rather than once per condition. */
  allBars: number[],
): Outcome[] {
  return HORIZONS.map((days) => {
    const sorted = movesFrom(candles, triggers, days);
    const n = sorted.length;

    const base = movesFrom(candles, allBars, days);
    const baselineUp = base.length
      ? base.filter((m) => m > 0).length / base.length
      : 0;
    const baselineMedianPct = base.length ? quantile(base, 0.5) : 0;

    const path = excursionsFrom(candles, triggers, days);
    const basePath = excursionsFrom(candles, allBars, days);

    const up = n === 0 ? 0 : sorted.filter((m) => m > 0).length / n;

    return {
      days,
      n,
      up,
      medianPct: n === 0 ? 0 : quantile(sorted, 0.5),
      p25Pct: n === 0 ? 0 : quantile(sorted, 0.25),
      p75Pct: n === 0 ? 0 : quantile(sorted, 0.75),
      worstPct: n === 0 ? 0 : sorted[0],
      baselineUp,
      baselineMedianPct,
      liftPp: n === 0 ? 0 : (up - baselineUp) * 100,
      medianAdversePct: path.adverse.length ? quantile(path.adverse, 0.5) : 0,
      medianFavourablePct: path.favourable.length
        ? quantile(path.favourable, 0.5)
        : 0,
      baselineAdversePct: basePath.adverse.length
        ? quantile(basePath.adverse, 0.5)
        : 0,
      baselineFavourablePct: basePath.favourable.length
        ? quantile(basePath.favourable, 0.5)
        : 0,
    };
  });
}

const CAVEATS = [
  "כל מספר כאן נספר מההיסטוריה של המניה הזו עצמה, ולא ממחקר חיצוני.",
  "חלונות חופפים אינם בלתי תלויים: שלוש שנות עלייה יגרמו כמעט לכל תנאי חיובי להיראות טוב.",
  "המדגם קטן. מתחת ל-8 מופעים לא מוצג שיעור כלל, ומעליו הספירה מודפסת ליד השיעור.",
  "העבר אינו טוען דבר על העתיד. זו התפלגות של מה שכבר קרה, לא תחזית.",
];

/**
 * Measure every condition over one instrument's history.
 *
 * Needs enough history for the two-hundred-day average to exist and for
 * the longest horizon to have somewhere to land after it; below that the
 * read comes back null rather than measured on whatever happened to be
 * there.
 */
export function readBaseRates(
  symbol: string,
  candles: Candle[],
): BaseRateRead | null {
  const MIN_HISTORY = 200 + 63 + 20;
  if (candles.length < MIN_HISTORY) return null;

  const series: Series = {
    candles,
    sma20: sma(candles, 20),
    sma50: sma(candles, 50),
    sma200: sma(candles, 200),
    rsi14: rsi(candles, 14),
    /* Once for the series, not once per condition. Six of the conditions
       below read this array, and `readBar` ranks each bar against the year
       behind it — doing that six times over ten years of candles for every
       name in the universe is the difference between a nightly job that
       finishes and one that does not. */
    bars: candles.map((_, i) => readBar(candles, i)),
    /* The same three averages the template reads, computed once for the
       series instead of once per bar — `sma` over ten years of candles,
       2,500 times, is the difference between a nightly job that finishes
       and one that does not. */
    template: (() => {
      const ma50 = sma(candles, 50);
      const ma150 = sma(candles, 150);
      const ma200 = sma(candles, 200);
      return candles.map((_, i) =>
        priceCriteriaPassed(templateFactsAt(candles, i, ma50, ma150, ma200)),
      );
    })(),
  };

  const last = candles.length - 1;

  /* Every bar is a baseline observation, computed once. */
  const allBars = Array.from({ length: candles.length }, (_, i) => i);

  const conditions = CONDITIONS.map((condition) => {
    const triggers: number[] = [];
    for (let i = 1; i < candles.length; i++) {
      if (condition.at(series, i)) triggers.push(i);
    }

    return {
      key: condition.key,
      label: condition.label,
      activeNow: condition.at(series, last),
      occurrences: triggers.length,
      lastAt: triggers.length ? candles[triggers[triggers.length - 1]].date : null,
      outcomes: outcomesFor(candles, triggers, allBars),
    };
  });

  return {
    symbol: symbol.toUpperCase(),
    from: candles[0].date.slice(0, 10),
    to: candles[last].date.slice(0, 10),
    sessions: candles.length,
    conditions,
    caveats: CAVEATS,
  };
}

/**
 * The conditions that fired on the most recent candle.
 *
 * This is what a page shows first, because it is the only part that is
 * about today. Everything else is a reference table.
 */
export function activeConditions(read: BaseRateRead): ConditionRead[] {
  return read.conditions.filter((c) => c.activeNow);
}

/** Whether a share may be shown as a share at all. */
export function reportable(outcome: Outcome): boolean {
  return outcome.n >= MIN_SAMPLE;
}

/* ------------------------------------------------------------------ */
/* The reading                                                         */
/* ------------------------------------------------------------------ */

/**
 * The sentence, kept HERE rather than beside the file reader.
 *
 * It lived in base-rate-store.ts next to the function that reads the
 * measured file, which was tidy and broke the site. The store imports
 * node:fs;  imports the sentence;  is a
 * client component. So one import pulled node:fs into the browser bundle
 * and every page that reaches the chart reader returned a 500 — sixteen
 * of eighteen. Neither tsc nor eslint sees it, because it is not a type
 * error and not a lint rule: it is a boundary, and the only thing that
 * reports it is actually loading the pages.
 *
 * Turning a figure into a sentence needs no filesystem, so it belongs
 * with the numbers it describes and the boundary stops being crossable.
 */

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

