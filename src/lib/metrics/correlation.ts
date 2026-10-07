/**
 * How many independent bets a portfolio actually holds.
 *
 * The portfolio page already reports "effective positions": one divided by
 * the Herfindahl index, which is the standard way to say that a list of
 * fifteen tickers with one of them at 40% is really about four bets. It is
 * a real measure and it answers only half the question, because it assumes
 * the positions are independent of each other. They are not. Five
 * semiconductor companies are not five bets however evenly the money is
 * spread across them, and the page says so in a comment and then measures
 * sector overlap as a proxy for it.
 *
 * This measures the thing itself.
 *
 * THE ARITHMETIC IS THE SAME ARITHMETIC, WHICH IS WHY IT BELONGS BESIDE
 * THE OLD NUMBER RATHER THAN REPLACING IT. Effective positions is
 * 1 / (wᵀ I w) — the portfolio's concentration if every holding moved on
 * its own. Effective bets is 1 / (wᵀ R w), the identical expression with
 * the real correlation matrix in place of the identity. Equal weights and
 * no correlation give back the position count; perfect correlation gives
 * one, whatever the weights. The DISTANCE between the two numbers is the
 * finding, and a reader can see where it came from because only one term
 * changed.
 *
 * WEEKLY RETURNS, NOT DAILY. The same choice `technical.beta` makes and
 * for the same reason: daily returns carry a great deal of trading noise
 * that has nothing to do with how two businesses actually move together,
 * and it biases correlation downward for anything thinly traded — which
 * would make a portfolio look more diversified than it is, in exactly the
 * situation where that matters most.
 *
 * WHAT IT IS NOT. A correlation measured over two years is a statement
 * about two years. Correlations rise in a sell-off, which is when a reader
 * most wants this number and when it is most likely to be an
 * underestimate. Nothing here predicts; the figure is printed with its
 * window and that caveat travels with it.
 */

import type { Candle } from "@/lib/sources/prices";

export type CorrelationFile = {
  builtAt: string;
  /** The last session every series shared. */
  asOf: string;
  /** Weekly observations behind each pair. */
  weeks: number;
  symbols: string[];
  /**
   * The matrix, row-major, aligned to `symbols`, rounded to two decimals.
   *
   * Rounded because the third decimal of a correlation estimated from a
   * hundred weekly observations is noise, and storing it would triple the
   * file for the appearance of precision.
   */
  matrix: number[][];
};

/** A correlation needs enough observations to mean anything. Two years of
 *  weekly returns is about a hundred; this is the floor under which the
 *  pair is reported as unmeasured rather than as a number. */
export const MIN_WEEKS = 40;

/* ------------------------------------------------------------------ */
/* Returns                                                             */
/* ------------------------------------------------------------------ */

/**
 * Weekly closes, keyed by the week's last trading date.
 *
 * Keyed by date rather than taken every fifth bar, because two instruments
 * do not always have the same number of sessions — a halt, a holiday on
 * one exchange, a late listing — and stepping by five would quietly
 * compare one company's Tuesday with another's Thursday for the rest of
 * the series.
 */
export function weeklyCloses(candles: Candle[]): Map<string, number> {
  const byWeek = new Map<string, number>();
  for (const candle of candles) {
    const date = new Date(candle.date + "T00:00:00Z");
    if (Number.isNaN(date.getTime())) continue;
    /* The Thursday of that week, used only as a stable key: any fixed day
       works as long as every series uses the same one. */
    const day = date.getUTCDay();
    const thursday = new Date(date);
    thursday.setUTCDate(date.getUTCDate() + (4 - (day === 0 ? 7 : day)));
    byWeek.set(thursday.toISOString().slice(0, 10), candle.close);
  }
  return byWeek;
}

/** Correlation of two aligned return series. Null when they share too few
 *  observations, or when either series never moved — a constant has no
 *  correlation with anything and dividing by its zero deviation would
 *  report one. */
export function correlationOf(a: number[], b: number[]): number | null {
  const n = Math.min(a.length, b.length);
  if (n < MIN_WEEKS) return null;

  let sumA = 0;
  let sumB = 0;
  for (let i = 0; i < n; i++) {
    sumA += a[i];
    sumB += b[i];
  }
  const meanA = sumA / n;
  const meanB = sumB / n;

  let cov = 0;
  let varA = 0;
  let varB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA;
    const db = b[i] - meanB;
    cov += da * db;
    varA += da * da;
    varB += db * db;
  }
  /* Relative, not `> 0`.
     A series that never moves does not have a variance of exactly zero
     once floating point has been through it — sixty copies of 0.01 sum to
     0.6000000000000003, and the deviations from that mean square up to
     about 1e-33. That clears a `> 0` guard, and the correlation then comes
     back as 3e-17: numerically harmless, and reported to the caller as
     "uncorrelated" rather than "unmeasurable".
     Which is the dangerous direction. A halted or barely traded instrument
     would show near-zero correlation with everything and read as the best
     diversifier in the portfolio. So the test is whether the variance is
     meaningful NEXT TO THE DATA ITSELF, and a series whose movement is
     fifteen orders of magnitude below its own level did not move. */
  const scale = (x: number[], mean: number) =>
    Math.max(Math.abs(mean), ...x.map(Math.abs), 1e-12) ** 2 * x.length;
  if (
    varA <= scale(a.slice(0, n), meanA) * 1e-24 ||
    varB <= scale(b.slice(0, n), meanB) * 1e-24
  ) {
    return null;
  }
  return cov / Math.sqrt(varA * varB);
}

/**
 * Build the whole matrix from a map of symbol to candles.
 *
 * Every pair is measured on the weeks the two actually share, which is why
 * the matrix is not simply a product of one aligned table: a company that
 * listed eighteen months ago has fewer weeks with everything else, and
 * padding it to the common length would either discard most of the history
 * or invent returns it does not have.
 */
export function buildCorrelations(
  series: Map<string, Candle[]>,
): Omit<CorrelationFile, "builtAt"> {
  const symbols = [...series.keys()].sort();
  const weekly = new Map<string, Map<string, number>>();
  let asOf = "";
  for (const symbol of symbols) {
    const candles = series.get(symbol)!;
    weekly.set(symbol, weeklyCloses(candles));
    const last = candles[candles.length - 1]?.date ?? "";
    if (last > asOf) asOf = last;
  }

  /* Returns per symbol, keyed by week, so a pair can be aligned by
     intersecting keys rather than by position. */
  const returns = new Map<string, Map<string, number>>();
  for (const symbol of symbols) {
    const closes = weekly.get(symbol)!;
    const keys = [...closes.keys()].sort();
    const row = new Map<string, number>();
    for (let i = 1; i < keys.length; i++) {
      const prev = closes.get(keys[i - 1])!;
      const now = closes.get(keys[i])!;
      if (prev > 0) row.set(keys[i], (now - prev) / prev);
    }
    returns.set(symbol, row);
  }

  const matrix: number[][] = [];
  let minShared = Infinity;

  for (let i = 0; i < symbols.length; i++) {
    const row: number[] = [];
    const ri = returns.get(symbols[i])!;
    for (let j = 0; j < symbols.length; j++) {
      if (i === j) {
        row.push(1);
        continue;
      }
      if (j < i) {
        row.push(matrix[j][i]);
        continue;
      }
      const rj = returns.get(symbols[j])!;
      const a: number[] = [];
      const b: number[] = [];
      for (const [week, value] of ri) {
        const other = rj.get(week);
        if (other !== undefined) {
          a.push(value);
          b.push(other);
        }
      }
      if (a.length < minShared) minShared = a.length;
      const c = correlationOf(a, b);
      /* An unmeasurable pair is recorded as zero and the shared-week count
         below says how thin the thinnest pair was. Zero is the neutral
         assumption here — it neither invents diversification nor invents
         concentration — and it is the only value that leaves the matrix
         usable for the arithmetic that follows. */
      row.push(c === null ? 0 : Math.round(c * 100) / 100);
    }
    matrix.push(row);
  }

  return {
    asOf,
    weeks: Number.isFinite(minShared) ? minShared : 0,
    symbols,
    matrix,
  };
}

/* ------------------------------------------------------------------ */
/* The number                                                          */
/* ------------------------------------------------------------------ */

export type BetsRead = {
  /** 1 / (wᵀ R w) — the count of uncorrelated equal positions carrying the
   *  same risk as this portfolio. */
  effectiveBets: number;
  /** 1 / (wᵀ I w), the same expression assuming independence. This is the
   *  figure the page already shows as "effective positions". */
  effectivePositions: number;
  /** Average pairwise correlation across the held names, weighted the way
   *  the portfolio is. The reason the two numbers differ. */
  averageCorrelation: number | null;
  /** The most correlated pair actually held, which is usually the sentence
   *  a reader remembers. */
  closestPair: { a: string; b: string; correlation: number } | null;
  /** Holdings the matrix does not cover, so the figure can say what it
   *  left out rather than quietly renormalising around it. */
  unmeasured: string[];
  weeks: number;
  asOf: string;
};

/**
 * How many independent bets these weights really represent.
 *
 * Weights are renormalised over the holdings the matrix covers, and the
 * ones it does not are named. Renormalising silently would report a
 * diversification figure for a portfolio the reader does not hold.
 */
export function effectiveBets(
  holdings: { ticker: string; weight: number }[],
  file: Pick<CorrelationFile, "symbols" | "matrix" | "weeks" | "asOf">,
): BetsRead | null {
  const index = new Map(file.symbols.map((s, i) => [s, i]));
  const covered = holdings.filter((h) => index.has(h.ticker.toUpperCase()));
  const unmeasured = holdings
    .filter((h) => !index.has(h.ticker.toUpperCase()))
    .map((h) => h.ticker.toUpperCase());

  if (covered.length === 0) return null;

  const total = covered.reduce((sum, h) => sum + h.weight, 0);
  if (!(total > 0)) return null;
  const w = covered.map((h) => h.weight / total);

  let quad = 0;
  let sumSq = 0;
  let pairWeight = 0;
  let pairCorr = 0;
  let closest: BetsRead["closestPair"] = null;

  for (let i = 0; i < covered.length; i++) {
    const ii = index.get(covered[i].ticker.toUpperCase())!;
    sumSq += w[i] * w[i];
    for (let j = 0; j < covered.length; j++) {
      const jj = index.get(covered[j].ticker.toUpperCase())!;
      const r = file.matrix[ii]?.[jj] ?? 0;
      quad += w[i] * w[j] * r;
      if (j > i) {
        pairWeight += w[i] * w[j];
        pairCorr += w[i] * w[j] * r;
        if (!closest || r > closest.correlation) {
          closest = {
            a: covered[i].ticker.toUpperCase(),
            b: covered[j].ticker.toUpperCase(),
            correlation: r,
          };
        }
      }
    }
  }

  return {
    effectiveBets: quad > 0 ? 1 / quad : covered.length,
    effectivePositions: sumSq > 0 ? 1 / sumSq : covered.length,
    averageCorrelation: pairWeight > 0 ? pairCorr / pairWeight : null,
    closestPair: closest,
    unmeasured,
    weeks: file.weeks,
    asOf: file.asOf,
  };
}
