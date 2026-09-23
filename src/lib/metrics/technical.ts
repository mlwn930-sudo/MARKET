/**
 * Every price-derived measure in the project. One source of truth, per the
 * project rules: nothing recomputes a moving average or a trend verdict
 * anywhere else.
 *
 * The frameworks implemented here — Weinstein's stage analysis, Minervini's
 * trend template, the volatility contraction pattern and the SEPA risk
 * arithmetic — describe what the price has already done. They say nothing
 * about what it will do next, and the language used throughout reflects
 * that: a setup "meets the criteria", it is never "a buy".
 *
 * Two rules govern the code below.
 *
 * A measure that cannot be computed returns null, never a substitute. An
 * average over fewer days than its period is a different measure wearing
 * the same name, and a trend read from forty days of history is a guess
 * with a decimal point on it.
 *
 * Every threshold is a named constant with its reason beside it. Unexplained
 * numbers are how a framework quietly turns into superstition.
 */

import type { Candle } from "@/lib/sources/prices";

/* ------------------------------------------------------------------ */
/* Indicators                                                          */
/* ------------------------------------------------------------------ */

/** Simple moving average, aligned to the candles. The first `period - 1`
 *  entries are null: an average over fewer days than the period is a
 *  different measure wearing the same name. */
export function sma(
  candles: Candle[],
  period: number,
  pick: (c: Candle) => number = (c) => c.close,
): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length < period) return out;

  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += pick(candles[i]);
    if (i >= period) sum -= pick(candles[i - period]);
    if (i >= period - 1) out[i] = sum / period;
  }
  return out;
}

/**
 * Relative strength index, Wilder's smoothing.
 *
 * Above 70 is conventionally "overbought" and below 30 "oversold", but the
 * convention misleads in a strong trend: a stock in a real advance can hold
 * above 70 for months, and selling on that basis is a common way to be
 * early and wrong. The site shows the number and the trend together for
 * exactly that reason.
 */
export function rsi(candles: Candle[], period = 14): (number | null)[] {
  const out: (number | null)[] = new Array(candles.length).fill(null);
  if (candles.length <= period) return out;

  let gains = 0;
  let losses = 0;
  for (let i = 1; i <= period; i++) {
    const change = candles[i].close - candles[i - 1].close;
    if (change >= 0) gains += change;
    else losses -= change;
  }

  let avgGain = gains / period;
  let avgLoss = losses / period;
  out[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);

  for (let i = period + 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }

  return out;
}

/** Annualised volatility from daily returns, as a percentage. */
export function volatility(candles: Candle[], window = 60): number | null {
  if (candles.length < window + 1) return null;
  const slice = candles.slice(-(window + 1));

  const returns: number[] = [];
  for (let i = 1; i < slice.length; i++) {
    returns.push(Math.log(slice[i].close / slice[i - 1].close));
  }

  const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
  const variance =
    returns.reduce((sum, r) => sum + (r - mean) ** 2, 0) / (returns.length - 1);

  return Math.sqrt(variance) * Math.sqrt(252) * 100;
}

/**
 * Average true range — the average daily range in dollars, gaps included.
 *
 * Used here for one purpose: sizing a stop in the units the stock actually
 * moves in. A 5% stop is loose on a utility and inside the daily noise on a
 * high-growth name, and ATR is what tells the two apart.
 */
export function atr(candles: Candle[], period = 14): number | null {
  if (candles.length < period + 1) return null;

  const trueRanges: number[] = [];
  for (let i = candles.length - period; i < candles.length; i++) {
    const previousClose = candles[i - 1].close;
    trueRanges.push(
      Math.max(
        candles[i].high - candles[i].low,
        Math.abs(candles[i].high - previousClose),
        Math.abs(candles[i].low - previousClose),
      ),
    );
  }

  return trueRanges.reduce((a, b) => a + b, 0) / trueRanges.length;
}

export type Cross = { kind: "golden" | "death"; date: string; ago: number };

/**
 * The most recent crossing of the short average over the long one.
 *
 * Reported with how long ago it happened, because the age is the whole
 * story: a cross from two days ago is news, and one from eight months ago
 * is just the current state described in a dramatic way.
 */
export function lastCross(
  candles: Candle[],
  short: (number | null)[],
  long: (number | null)[],
): Cross | null {
  for (let i = candles.length - 1; i > 0; i--) {
    const s = short[i];
    const l = long[i];
    const prevS = short[i - 1];
    const prevL = long[i - 1];
    if (s === null || l === null || prevS === null || prevL === null) continue;

    const crossedUp = prevS <= prevL && s > l;
    const crossedDown = prevS >= prevL && s < l;
    if (crossedUp || crossedDown) {
      return {
        kind: crossedUp ? "golden" : "death",
        date: candles[i].date,
        ago: candles.length - 1 - i,
      };
    }
  }
  return null;
}

export type TrendRead = {
  vsAveragePercent: number | null;
  averageDirection: "rising" | "falling" | "flat" | null;
  verdict: "uptrend" | "downtrend" | "mixed" | null;
  high52: number | null;
  low52: number | null;
  fromHighPercent: number | null;
  fromLowPercent: number | null;
};

/**
 * Trend as two separate questions, because they can disagree and the
 * disagreement is the interesting case.
 *
 * Price above a rising long average is the textbook uptrend. Price above a
 * falling average usually means a bounce inside a decline, and price below
 * a rising average usually means a pullback inside an advance — both are
 * reported as "mixed" rather than forced into one of the two clean answers,
 * because calling either of them a trend would be a guess.
 */
export function readTrend(
  candles: Candle[],
  longAverage: (number | null)[],
): TrendRead {
  const empty: TrendRead = {
    vsAveragePercent: null,
    averageDirection: null,
    verdict: null,
    high52: null,
    low52: null,
    fromHighPercent: null,
    fromLowPercent: null,
  };
  if (candles.length === 0) return empty;

  const lastClose = candles[candles.length - 1].close;
  const lastAverage = longAverage[longAverage.length - 1];
  const monthAgoIndex = Math.max(0, longAverage.length - 22);
  const averageThen = longAverage[monthAgoIndex];

  const window = candles.slice(-252);
  const high52 = window.length ? Math.max(...window.map((c) => c.high)) : null;
  const low52 = window.length ? Math.min(...window.map((c) => c.low)) : null;

  const fromHighPercent =
    high52 && high52 > 0 ? ((lastClose - high52) / high52) * 100 : null;
  const fromLowPercent =
    low52 && low52 > 0 ? ((lastClose - low52) / low52) * 100 : null;

  if (lastAverage === null) {
    return { ...empty, high52, low52, fromHighPercent, fromLowPercent };
  }

  const vsAveragePercent = ((lastClose - lastAverage) / lastAverage) * 100;

  let averageDirection: TrendRead["averageDirection"] = null;
  if (averageThen !== null && averageThen !== undefined && averageThen > 0) {
    const change = ((lastAverage - averageThen) / averageThen) * 100;
    averageDirection = change > 1 ? "rising" : change < -1 ? "falling" : "flat";
  }

  const above = vsAveragePercent > 0;
  let verdict: TrendRead["verdict"] = "mixed";
  if (above && averageDirection === "rising") verdict = "uptrend";
  else if (!above && averageDirection === "falling") verdict = "downtrend";

  return {
    vsAveragePercent,
    averageDirection,
    verdict,
    high52,
    low52,
    fromHighPercent,
    fromLowPercent,
  };
}

export const TREND_LABELS: Record<
  NonNullable<TrendRead["verdict"]>,
  { he: string; note: string }
> = {
  uptrend: {
    he: "מגמה עולה",
    note: "המחיר מעל הממוצע הארוך, והממוצע עצמו עולה",
  },
  downtrend: {
    he: "מגמה יורדת",
    note: "המחיר מתחת לממוצע הארוך, והממוצע עצמו יורד",
  },
  mixed: {
    he: "מגמה מעורבת",
    note: "המחיר והממוצע אינם מצביעים לאותו כיוון",
  },
};

/* ------------------------------------------------------------------ */
/* Stage analysis                                                      */
/* ------------------------------------------------------------------ */

/**
 * Weinstein's four stages, decided by the 30-week average and its slope.
 *
 * The whole point of the framework is that most of the money is made in one
 * of the four, and most of the damage is taken in another. It is treated
 * here as a description of the present, not a forecast: stage 2 says the
 * advance has been under way, not that it will continue.
 *
 * 150 trading days stands in for 30 weeks. The slope is measured over a
 * month because a weekly average that has only turned in the last few days
 * has not turned yet — it has wobbled.
 */
export type Stage = 1 | 2 | 3 | 4;

export type StageRead = {
  stage: Stage | null;
  label: string;
  note: string;
  /** Trading days the current stage has held, as far back as the data goes. */
  daysInStage: number | null;
};

/** A slope this small is noise on a 150-day average, not a turn. */
const FLAT_SLOPE_PERCENT = 1.5;
/** Trading days used to measure the slope of the 30-week average. */
const SLOPE_WINDOW = 22;

const STAGE_LABELS: Record<Stage, { he: string; note: string }> = {
  1: {
    he: "שלב 1 — בסיס",
    note: "המחיר נע לרוחב סביב ממוצע שטוח אחרי ירידה. לא מגמה, צבירה.",
  },
  2: {
    he: "שלב 2 — עלייה",
    note: "המחיר מעל ממוצע 30 השבועות והממוצע עולה. זה השלב שבו מתרחשת רוב העלייה.",
  },
  3: {
    he: "שלב 3 — פסגה",
    note: "אחרי עלייה, הממוצע מתיישר והמחיר מתנדנד סביבו. חלוקה, לא צבירה.",
  },
  4: {
    he: "שלב 4 — ירידה",
    note: "המחיר מתחת לממוצע והממוצע יורד. השלב שבו נגרם רוב הנזק.",
  },
};

function stageAt(
  close: number,
  average: number | null,
  slopePercent: number | null,
  priorReturnPercent: number | null,
): Stage | null {
  if (average === null || slopePercent === null) return null;

  const above = close > average;
  const rising = slopePercent > FLAT_SLOPE_PERCENT;
  const falling = slopePercent < -FLAT_SLOPE_PERCENT;

  if (above && rising) return 2;
  if (!above && falling) return 4;

  // A flat average is either a base or a top. What separates them is what
  // came before it: a flat average after a decline is accumulation, and the
  // same flat average after an advance is distribution.
  if (priorReturnPercent !== null && priorReturnPercent > 0) return above ? 3 : 4;
  return above ? 2 : 1;
}

export function readStage(candles: Candle[]): StageRead {
  const empty: StageRead = {
    stage: null,
    label: "אין די היסטוריה",
    note: "נדרשים לפחות 150 ימי מסחר כדי לקבוע שלב.",
    daysInStage: null,
  };
  if (candles.length < 150 + SLOPE_WINDOW) return empty;

  const ma150 = sma(candles, 150);

  const slopeAt = (i: number): number | null => {
    const now = ma150[i];
    const then = ma150[i - SLOPE_WINDOW];
    if (now === null || then === null || then <= 0) return null;
    return ((now - then) / then) * 100;
  };

  /** Six-month return, used only to tell a base apart from a top. */
  const priorAt = (i: number): number | null => {
    const back = i - 126;
    if (back < 0) return null;
    const then = candles[back].close;
    if (then <= 0) return null;
    return ((candles[i].close - then) / then) * 100;
  };

  const last = candles.length - 1;
  const stage = stageAt(candles[last].close, ma150[last], slopeAt(last), priorAt(last));
  if (stage === null) return empty;

  let daysInStage = 0;
  for (let i = last; i > 0; i--) {
    if (stageAt(candles[i].close, ma150[i], slopeAt(i), priorAt(i)) !== stage) break;
    daysInStage++;
  }

  return {
    stage,
    label: STAGE_LABELS[stage].he,
    note: STAGE_LABELS[stage].note,
    daysInStage,
  };
}

/* ------------------------------------------------------------------ */
/* Trend template                                                      */
/* ------------------------------------------------------------------ */

/**
 * Minervini's trend template, as eight separate questions.
 *
 * It is reported criterion by criterion rather than as a score, because the
 * failures are the useful part. "Seven of eight" tells you nothing; "every
 * criterion met except that the stock is 31% off its high" tells you what
 * the stock is actually doing.
 *
 * One honest substitution. The original eighth criterion is a relative
 * strength *rating* — a percentile against every other stock in the market,
 * which needs a universe this project does not have. What is used instead is
 * relative performance against the S&P 500 over six months, which is the
 * same idea without the ranking. It is labelled as such and never called an
 * RS Rating.
 */
export type TemplateCheck = {
  key: string;
  label: string;
  pass: boolean | null;
  detail: string;
};

export type TrendTemplate = {
  checks: TemplateCheck[];
  passed: number;
  /** Checks that could actually be evaluated. A null check is not a failure. */
  evaluated: number;
  total: number;
};

/** Minervini asks for 30% above the low; 25% is the commonly used floor and
 *  is what is applied here, with the figure always shown beside it. */
const MIN_ABOVE_LOW_PERCENT = 25;
/** Within 25% of the 52-week high. Further than that is not a leader. */
const MAX_BELOW_HIGH_PERCENT = 25;

export function trendTemplate(
  candles: Candle[],
  relativeStrength6m: number | null,
): TrendTemplate {
  const unknown = (key: string, label: string): TemplateCheck => ({
    key,
    label,
    pass: null,
    detail: "אין די היסטוריה",
  });

  const checks: TemplateCheck[] = [];
  const last = candles.length - 1;
  const close = candles[last]?.close ?? null;

  const ma50 = sma(candles, 50)[last];
  const ma150 = sma(candles, 150)[last];
  const ma200full = sma(candles, 200);
  const ma200 = ma200full[last];
  const ma200Month = ma200full[Math.max(0, last - SLOPE_WINDOW)];

  const window = candles.slice(-252);
  const high52 = window.length ? Math.max(...window.map((c) => c.high)) : null;
  const low52 = window.length ? Math.min(...window.map((c) => c.low)) : null;

  const fmt = (n: number | null, digits = 2) =>
    n === null ? "—" : n.toFixed(digits);

  if (close !== null && ma150 !== null && ma200 !== null) {
    checks.push({
      key: "above_150_200",
      label: "המחיר מעל ממוצע 150 ומעל ממוצע 200",
      pass: close > ma150 && close > ma200,
      detail: `מחיר ${fmt(close)} · MA150 ${fmt(ma150)} · MA200 ${fmt(ma200)}`,
    });
  } else checks.push(unknown("above_150_200", "המחיר מעל ממוצע 150 ומעל ממוצע 200"));

  if (ma150 !== null && ma200 !== null) {
    checks.push({
      key: "150_above_200",
      label: "ממוצע 150 מעל ממוצע 200",
      pass: ma150 > ma200,
      detail: `${fmt(ma150)} מול ${fmt(ma200)}`,
    });
  } else checks.push(unknown("150_above_200", "ממוצע 150 מעל ממוצע 200"));

  if (ma200 !== null && ma200Month != null) {
    const change = ((ma200 - ma200Month) / ma200Month) * 100;
    checks.push({
      key: "200_rising",
      label: "ממוצע 200 עולה לפחות חודש",
      pass: change > 0,
      detail: `${change >= 0 ? "+" : ""}${change.toFixed(1)}% בחודש האחרון`,
    });
  } else checks.push(unknown("200_rising", "ממוצע 200 עולה לפחות חודש"));

  if (ma50 !== null && ma150 !== null && ma200 !== null) {
    checks.push({
      key: "50_above_rest",
      label: "ממוצע 50 מעל 150 ומעל 200",
      pass: ma50 > ma150 && ma50 > ma200,
      detail: `MA50 ${fmt(ma50)}`,
    });
  } else checks.push(unknown("50_above_rest", "ממוצע 50 מעל 150 ומעל 200"));

  if (close !== null && ma50 !== null) {
    checks.push({
      key: "above_50",
      label: "המחיר מעל ממוצע 50",
      pass: close > ma50,
      detail: `${(((close - ma50) / ma50) * 100).toFixed(1)}% מעל הממוצע`,
    });
  } else checks.push(unknown("above_50", "המחיר מעל ממוצע 50"));

  if (close !== null && low52 !== null && low52 > 0) {
    const above = ((close - low52) / low52) * 100;
    checks.push({
      key: "above_low",
      label: `לפחות ${MIN_ABOVE_LOW_PERCENT}% מעל שפל 52 שבועות`,
      pass: above >= MIN_ABOVE_LOW_PERCENT,
      detail: `${above.toFixed(0)}% מעל השפל`,
    });
  } else checks.push(unknown("above_low", "מעל שפל 52 שבועות"));

  if (close !== null && high52 !== null && high52 > 0) {
    const below = ((high52 - close) / high52) * 100;
    checks.push({
      key: "near_high",
      label: `עד ${MAX_BELOW_HIGH_PERCENT}% מתחת לשיא 52 שבועות`,
      pass: below <= MAX_BELOW_HIGH_PERCENT,
      detail: `${below.toFixed(0)}% מתחת לשיא`,
    });
  } else checks.push(unknown("near_high", "קרוב לשיא 52 שבועות"));

  if (relativeStrength6m !== null) {
    checks.push({
      key: "relative_strength",
      label: "מניב יותר מ-S&P 500 בחצי שנה",
      pass: relativeStrength6m > 0,
      detail: `${relativeStrength6m >= 0 ? "+" : ""}${relativeStrength6m.toFixed(1)} נקודות אחוז מול המדד`,
    });
  } else checks.push(unknown("relative_strength", "מניב יותר מ-S&P 500 בחצי שנה"));

  return {
    checks,
    passed: checks.filter((c) => c.pass === true).length,
    evaluated: checks.filter((c) => c.pass !== null).length,
    total: checks.length,
  };
}

/* ------------------------------------------------------------------ */
/* Relative strength                                                   */
/* ------------------------------------------------------------------ */

export type RelativeStrength = {
  oneMonth: number | null;
  threeMonth: number | null;
  sixMonth: number | null;
  /** True when the stock is outperforming over every window measured —
   *  the pattern that matters more than any single window. */
  consistent: boolean;
};

/**
 * Performance against a benchmark, in percentage points.
 *
 * Aligned by date rather than by index: the two series can differ in length
 * or miss different days, and comparing position 120 of one against position
 * 120 of the other would quietly measure two different periods.
 */
export function relativeStrength(
  candles: Candle[],
  benchmark: Candle[],
): RelativeStrength {
  const byDate = new Map(benchmark.map((c) => [c.date, c.close]));

  const paired: { date: string; stock: number; index: number }[] = [];
  for (const candle of candles) {
    const indexClose = byDate.get(candle.date);
    if (indexClose !== undefined) {
      paired.push({ date: candle.date, stock: candle.close, index: indexClose });
    }
  }

  const over = (days: number): number | null => {
    if (paired.length <= days) return null;
    const then = paired[paired.length - 1 - days];
    const now = paired[paired.length - 1];
    if (then.stock <= 0 || then.index <= 0) return null;

    const stockReturn = ((now.stock - then.stock) / then.stock) * 100;
    const indexReturn = ((now.index - then.index) / then.index) * 100;
    return stockReturn - indexReturn;
  };

  const oneMonth = over(21);
  const threeMonth = over(63);
  const sixMonth = over(126);

  const measured = [oneMonth, threeMonth, sixMonth].filter(
    (v): v is number => v !== null,
  );

  return {
    oneMonth,
    threeMonth,
    sixMonth,
    consistent: measured.length === 3 && measured.every((v) => v > 0),
  };
}

/**
 * Beta against the benchmark, from weekly returns.
 *
 * Weekly rather than daily, which is the convention for a reason: daily
 * returns carry a lot of trading noise that has nothing to do with how the
 * stock responds to the market, and it biases beta downward for anything
 * thinly traded.
 *
 * This feeds the cost of equity, so its limitation should be stated plainly
 * wherever it appears: beta measures how the stock moved with the market
 * over the past two years. It is a description of the past being used as an
 * input to a forward-looking number, which is the standard practice and
 * still an assumption.
 */
export function beta(candles: Candle[], benchmark: Candle[]): number | null {
  const byDate = new Map(benchmark.map((c) => [c.date, c.close]));

  const paired: { stock: number; index: number }[] = [];
  for (const candle of candles) {
    const indexClose = byDate.get(candle.date);
    if (indexClose !== undefined) {
      paired.push({ stock: candle.close, index: indexClose });
    }
  }

  // Every fifth aligned session stands in for a week. Sampling the aligned
  // series rather than calendar weeks keeps the two return streams over
  // identical periods.
  const weekly: { stock: number; index: number }[] = [];
  for (let i = paired.length - 1; i >= 0; i -= 5) weekly.unshift(paired[i]);
  if (weekly.length < 30) return null;

  const stockReturns: number[] = [];
  const indexReturns: number[] = [];
  for (let i = 1; i < weekly.length; i++) {
    const previous = weekly[i - 1];
    if (previous.stock <= 0 || previous.index <= 0) continue;
    stockReturns.push((weekly[i].stock - previous.stock) / previous.stock);
    indexReturns.push((weekly[i].index - previous.index) / previous.index);
  }
  if (stockReturns.length < 20) return null;

  const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
  const stockMean = mean(stockReturns);
  const indexMean = mean(indexReturns);

  let covariance = 0;
  let variance = 0;
  for (let i = 0; i < stockReturns.length; i++) {
    covariance += (stockReturns[i] - stockMean) * (indexReturns[i] - indexMean);
    variance += (indexReturns[i] - indexMean) ** 2;
  }
  if (variance === 0) return null;

  return covariance / variance;
}

/* ------------------------------------------------------------------ */
/* Volatility contraction                                              */
/* ------------------------------------------------------------------ */

export type Contraction = {
  highDate: string;
  high: number;
  lowDate: string;
  low: number;
  /** How far the price fell from the swing high, as a percentage. */
  depthPercent: number;
  days: number;
};

export type VcpRead = {
  contractions: Contraction[];
  /** Each pullback shallower than the one before it. */
  tightening: boolean;
  /** The swing high the pattern is built under — the reference level. */
  pivot: number | null;
  pivotDate: string | null;
  /** Distance from the current price to the pivot, as a percentage. */
  toPivotPercent: number | null;
  baseDays: number | null;
  verdict: "tight" | "forming" | "loose" | "none";
  note: string;
};

/** Bars either side of a candle for it to count as a swing point. Five is
 *  about a trading week, which filters intraday noise without smoothing
 *  away the contractions the pattern is made of. */
const SWING_WINDOW = 5;
/** Trading days searched for a base. Eight months covers the long
 *  consolidations without reaching back into a different market regime. */
const BASE_LOOKBACK = 170;
/** A final contraction under this is "tight" — the textbook figure. */
const TIGHT_FINAL_DEPTH = 10;
/** A base needs to be at least this long. Anything shorter is a pause. */
const MIN_BASE_DAYS = 25;

type Swing = { index: number; kind: "high" | "low" };

function swings(candles: Candle[]): Swing[] {
  const out: Swing[] = [];

  for (let i = SWING_WINDOW; i < candles.length - SWING_WINDOW; i++) {
    let isHigh = true;
    let isLow = true;
    for (let j = i - SWING_WINDOW; j <= i + SWING_WINDOW; j++) {
      if (j === i) continue;
      if (candles[j].high >= candles[i].high) isHigh = false;
      if (candles[j].low <= candles[i].low) isLow = false;
    }
    if (isHigh) out.push({ index: i, kind: "high" });
    else if (isLow) out.push({ index: i, kind: "low" });
  }

  // Collapse runs of the same kind, keeping the most extreme. Two adjacent
  // highs with no low between them are one high with a wobble in it.
  const collapsed: Swing[] = [];
  for (const swing of out) {
    const previous = collapsed[collapsed.length - 1];
    if (!previous || previous.kind !== swing.kind) {
      collapsed.push(swing);
      continue;
    }
    const better =
      swing.kind === "high"
        ? candles[swing.index].high > candles[previous.index].high
        : candles[swing.index].low < candles[previous.index].low;
    if (better) collapsed[collapsed.length - 1] = swing;
  }

  return collapsed;
}

/**
 * The volatility contraction pattern: successively shallower pullbacks on
 * falling volume, under a reference high.
 *
 * What the pattern is supposed to represent is supply being exhausted — each
 * wave of selling smaller than the last. That reading only holds while the
 * contractions are genuinely tightening, so a sequence that widens again is
 * reported as "loose" rather than quietly rounded down to a near-miss.
 */
export function readVcp(candles: Candle[]): VcpRead {
  const none: VcpRead = {
    contractions: [],
    tightening: false,
    pivot: null,
    pivotDate: null,
    toPivotPercent: null,
    baseDays: null,
    verdict: "none",
    note: "לא זוהה בסיס של התכווצויות בחודשים האחרונים.",
  };

  if (candles.length < MIN_BASE_DAYS + SWING_WINDOW * 2) return none;

  const window = candles.slice(-BASE_LOOKBACK);
  const points = swings(window);
  if (points.length < 3) return none;

  // Walk the alternating swings and turn every high-then-low pair into a
  // contraction.
  const contractions: Contraction[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const high = points[i];
    const low = points[i + 1];
    if (high.kind !== "high" || low.kind !== "low") continue;

    const highPrice = window[high.index].high;
    const lowPrice = window[low.index].low;
    if (highPrice <= 0) continue;

    contractions.push({
      highDate: window[high.index].date,
      high: highPrice,
      lowDate: window[low.index].date,
      low: lowPrice,
      depthPercent: ((highPrice - lowPrice) / highPrice) * 100,
      days: low.index - high.index,
    });
  }

  if (contractions.length < 2) return none;

  // Only the tail of the sequence is the base. Start from the deepest recent
  // contraction: everything before it belongs to whatever came earlier.
  const recent = contractions.slice(-4);

  let tightening = true;
  for (let i = 1; i < recent.length; i++) {
    // A small allowance, because two pullbacks a fraction of a percent apart
    // are the same pullback measured twice.
    if (recent[i].depthPercent > recent[i - 1].depthPercent + 0.5) {
      tightening = false;
      break;
    }
  }

  const lastPoint = points[points.length - 1];
  const highs = points.filter((p) => p.kind === "high");
  const pivotPoint = highs[highs.length - 1] ?? null;
  const pivot = pivotPoint ? window[pivotPoint.index].high : null;
  const pivotDate = pivotPoint ? window[pivotPoint.index].date : null;

  const close = candles[candles.length - 1].close;
  const toPivotPercent =
    pivot !== null && pivot > 0 ? ((pivot - close) / close) * 100 : null;

  const firstOfBase = recent[0];
  const baseStartIndex = window.findIndex((c) => c.date === firstOfBase.highDate);
  const baseDays = baseStartIndex >= 0 ? window.length - baseStartIndex : null;

  const finalDepth = recent[recent.length - 1].depthPercent;

  let verdict: VcpRead["verdict"];
  let note: string;

  if (!tightening) {
    verdict = "loose";
    note =
      "יש רצף התכווצויות, אבל האחרונה עמוקה מקודמתה. זו לא התכווצות — זה טווח שנפתח.";
  } else if (baseDays !== null && baseDays < MIN_BASE_DAYS) {
    verdict = "forming";
    note = `הבסיס קצר מדי — ${baseDays} ימי מסחר. התבנית דורשת זמן לבנייה.`;
  } else if (finalDepth <= TIGHT_FINAL_DEPTH) {
    verdict = "tight";
    note = `${recent.length} התכווצויות, כל אחת רדודה מקודמתה, האחרונה ${finalDepth.toFixed(1)}%.`;
  } else {
    verdict = "forming";
    note = `ההתכווצויות מצטמצמות, אבל האחרונה עדיין ${finalDepth.toFixed(1)}% — רחוק מהידוק.`;
  }

  // A pattern whose last move was down to a fresh low is not a base under a
  // pivot, whatever the depths say.
  if (lastPoint.kind === "low" && recent.length > 0 && verdict === "tight") {
    verdict = "forming";
    note += " הצלע האחרונה יורדת — התבנית טרם סגרה.";
  }

  return {
    contractions: recent,
    tightening,
    pivot,
    pivotDate,
    toPivotPercent,
    baseDays,
    verdict,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* Volume                                                              */
/* ------------------------------------------------------------------ */

export type VolumeRead = {
  recentAverage: number | null;
  baseAverage: number | null;
  /** Recent volume as a fraction of the longer average. Under 1 is a dry-up. */
  ratio: number | null;
  dryUp: boolean;
  /** The heaviest up-day in the recent window, relative to average volume. */
  largestUpDayRatio: number | null;
  note: string;
};

/** Below this, recent volume counts as dried up. The number comes from the
 *  pattern's own logic — the point is that sellers have stopped showing up,
 *  and a quarter less volume is not "stopped". */
const DRY_UP_RATIO = 0.75;
const RECENT_VOLUME_DAYS = 10;
const BASE_VOLUME_DAYS = 50;

/**
 * Volume behaviour at the end of a base.
 *
 * A dry-up is the confirming half of the contraction pattern: prices tighten
 * because nobody is selling, and the volume is how you tell that apart from
 * prices tightening because nobody is interested. The two look identical on
 * a price chart alone, which is why this is reported next to the pattern and
 * not inside it.
 */
export function readVolume(candles: Candle[]): VolumeRead {
  const empty: VolumeRead = {
    recentAverage: null,
    baseAverage: null,
    ratio: null,
    dryUp: false,
    largestUpDayRatio: null,
    note: "אין די נתוני מחזור.",
  };
  if (candles.length < BASE_VOLUME_DAYS) return empty;

  const recent = candles.slice(-RECENT_VOLUME_DAYS);
  const base = candles.slice(-BASE_VOLUME_DAYS);

  const mean = (rows: Candle[]) =>
    rows.reduce((sum, c) => sum + c.volume, 0) / rows.length;

  const recentAverage = mean(recent);
  const baseAverage = mean(base);
  if (baseAverage <= 0) return empty;

  const ratio = recentAverage / baseAverage;
  const dryUp = ratio < DRY_UP_RATIO;

  let largestUpDayRatio: number | null = null;
  for (const candle of recent) {
    if (candle.close > candle.open) {
      const dayRatio = candle.volume / baseAverage;
      if (largestUpDayRatio === null || dayRatio > largestUpDayRatio) {
        largestUpDayRatio = dayRatio;
      }
    }
  }

  const note = dryUp
    ? `המחזור בעשרת הימים האחרונים ${Math.round((1 - ratio) * 100)}% מתחת לממוצע 50 הימים — התייבשות.`
    : ratio > 1.25
      ? "המחזור גבוה מהרגיל. זה לא מצב של התייבשות."
      : "המחזור קרוב לממוצע. אין התייבשות ואין זרימה חריגה.";

  return { recentAverage, baseAverage, ratio, dryUp, largestUpDayRatio, note };
}

/* ------------------------------------------------------------------ */
/* Risk arithmetic                                                     */
/* ------------------------------------------------------------------ */

export type RiskLevels = {
  reference: number;
  /** Where the framework places the stop, and why. */
  stop: number;
  stopReason: string;
  riskPercent: number;
  targets: { multiple: number; price: number }[];
  /** True when the price sits in the narrow band above the reference where
   *  the framework says the arithmetic still works. */
  withinRange: boolean;
  note: string;
};

/** The hard ceiling on a single position's loss in this framework. A stop
 *  wider than this is not a stop, it is a hope. */
const MAX_RISK_PERCENT = 8;
/** How far above the reference level the entry arithmetic still holds. */
const EXTENDED_PERCENT = 5;

/**
 * The risk half of the SEPA framework: where the idea is wrong, expressed
 * before anything is said about where it might be right.
 *
 * The order matters and is the entire discipline. The stop comes from the
 * structure — the low of the last contraction, or an ATR-based floor when
 * the structure gives nothing — and the targets are then simply multiples of
 * that risk. Targets are never set first and the risk backed into
 * afterwards, which is how a 3% stop becomes a 15% loss.
 *
 * This is arithmetic on a framework's own rules, not a recommendation. What
 * it produces is the question "is this risk worth that reward", which is the
 * reader's to answer.
 */
export function riskLevels(
  candles: Candle[],
  reference: number | null,
  structureLow: number | null,
): RiskLevels | null {
  if (candles.length === 0 || reference === null || reference <= 0) return null;

  const close = candles[candles.length - 1].close;
  const averageRange = atr(candles);

  const floorFromCap = reference * (1 - MAX_RISK_PERCENT / 100);
  const floorFromAtr =
    averageRange !== null ? reference - averageRange * 2 : null;

  let stop: number;
  let stopReason: string;

  if (structureLow !== null && structureLow > floorFromCap && structureLow < reference) {
    stop = structureLow;
    stopReason = "מתחת לשפל ההתכווצות האחרונה";
  } else if (floorFromAtr !== null && floorFromAtr > floorFromCap) {
    stop = floorFromAtr;
    stopReason = "שני ATR מתחת לרמת הייחוס";
  } else {
    stop = floorFromCap;
    stopReason = `תקרת הסיכון של המסגרת — ${MAX_RISK_PERCENT}%`;
  }

  const risk = reference - stop;
  if (risk <= 0) return null;

  const riskPercent = (risk / reference) * 100;
  const targets = [2, 3].map((multiple) => ({
    multiple,
    price: reference + risk * multiple,
  }));

  const abovePercent = ((close - reference) / reference) * 100;
  const withinRange = abovePercent >= -1 && abovePercent <= EXTENDED_PERCENT;

  const note = withinRange
    ? `המחיר נמצא בטווח שבו החשבון הזה תקף (עד ${EXTENDED_PERCENT}% מעל רמת הייחוס).`
    : abovePercent > EXTENDED_PERCENT
      ? `המחיר ${abovePercent.toFixed(1)}% מעל רמת הייחוס. מי שנכנס כאן לוקח את אותו סיכון על פוטנציאל קטן יותר — זה מה שהמסגרת קוראת לו "מורחב".`
      : `המחיר ${Math.abs(abovePercent).toFixed(1)}% מתחת לרמת הייחוס. התבנית לא הושלמה, והחשבון הזה תיאורטי.`;

  return {
    reference,
    stop,
    stopReason,
    riskPercent,
    targets,
    withinRange,
    note,
  };
}

/* ------------------------------------------------------------------ */
/* The whole technical read                                            */
/* ------------------------------------------------------------------ */

export type TechnicalRead = {
  stage: StageRead;
  template: TrendTemplate;
  vcp: VcpRead;
  volume: VolumeRead;
  risk: RiskLevels | null;
  relative: RelativeStrength | null;
  trend: TrendRead;
  rsi: number | null;
  volatility: number | null;
  cross: Cross | null;
  averages: { period: number; value: number | null }[];
  /** One sentence describing the state, assembled from the parts above. */
  headline: string;
};

/** The averages the frameworks here are defined against. */
export const AVERAGE_PERIODS = [20, 50, 150, 200] as const;

export function readTechnicals(
  candles: Candle[],
  benchmark: Candle[] | null,
): TechnicalRead {
  const last = candles.length - 1;

  const relative = benchmark ? relativeStrength(candles, benchmark) : null;
  const stage = readStage(candles);
  const template = trendTemplate(candles, relative?.sixMonth ?? null);
  const vcp = readVcp(candles);
  const volume = readVolume(candles);

  const structureLow =
    vcp.contractions.length > 0
      ? vcp.contractions[vcp.contractions.length - 1].low
      : null;
  const risk = riskLevels(candles, vcp.pivot, structureLow);

  const ma200 = sma(candles, 200);
  const ma50 = sma(candles, 50);

  return {
    stage,
    template,
    vcp,
    volume,
    risk,
    relative,
    trend: readTrend(candles, ma200),
    rsi: rsi(candles)[last] ?? null,
    volatility: volatility(candles),
    cross: lastCross(candles, ma50, ma200),
    averages: AVERAGE_PERIODS.map((period) => ({
      period,
      value: sma(candles, period)[last] ?? null,
    })),
    headline: headlineFor(stage, template, vcp, volume),
  };
}

function headlineFor(
  stage: StageRead,
  template: TrendTemplate,
  vcp: VcpRead,
  volume: VolumeRead,
): string {
  const parts: string[] = [];

  parts.push(stage.stage === null ? "אין די היסטוריה לקביעת שלב" : stage.label);

  if (template.evaluated > 0) {
    parts.push(`${template.passed} מתוך ${template.evaluated} קריטריונים של תבנית המגמה`);
  }

  if (vcp.verdict === "tight") {
    parts.push(
      volume.dryUp
        ? "בסיס מהודק עם התייבשות מחזורים"
        : "בסיס מהודק, אך ללא התייבשות מחזורים",
    );
  } else if (vcp.verdict === "forming") {
    parts.push("בסיס בבנייה");
  }

  return parts.join(" · ");
}
