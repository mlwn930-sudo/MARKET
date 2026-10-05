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
