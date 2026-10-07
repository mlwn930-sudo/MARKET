/**
 * Where a stock stands against every other stock, rather than against
 * itself.
 *
 * Everything else in `metrics/` measures one instrument in isolation: its
 * own moving averages, its own volume distribution, its own ten years of
 * base rates. That is the right unit for most questions and it cannot
 * answer the one question a reader actually asks when they are choosing
 * between names, which is "compared to what". A stock up 14% in six months
 * is strong in a flat market and weak in one where the median name did 30.
 *
 * THIS CLOSES A DEBT THE SITE HAS BEEN CARRYING IN WRITING. The eighth
 * criterion of the trend template is a relative strength RATING — a
 * percentile against every other stock — and `technical.ts` says plainly
 * in its own comments that it substitutes six-month performance against
 * the S&P 500 because "a universe this project does not have" was needed.
 * The universe has existed for weeks: 123 names, pulled nightly for the
 * base rates. What was missing was a pass that ranks them against each
 * other, and that is all this file is.
 *
 * TWO RANKS, BECAUSE THEY ANSWER DIFFERENT QUESTIONS.
 *
 * The strength rank is the classic one: a return weighted toward the
 * recent quarter, ranked across the universe and reported 1–99. It is a
 * statement about price over months.
 *
 * The volume rank is today's participation ranked across the universe —
 * which name is unusually busy RIGHT NOW relative to how busy everything
 * else is. `tape.ts` can already say a bar is in the 97th percentile of
 * its own year; it cannot say whether the whole market is having a heavy
 * day, and on a day when every name is in its own 97th percentile the
 * reading means nothing at all.
 *
 * WHAT A RANK IS NOT. It is a position within this project's 123 companies
 * on one date, not within the market. A real RS Rating ranks thousands of
 * names; this ranks a curated list that is already biased toward large,
 * liquid, mostly-American businesses somebody chose. A 90 here means "in
 * the top tenth OF THIS LIST", the output says so in `universe`, and every
 * renderer prints the count beside the number. Calling it an RS Rating
 * without that sentence would be borrowing the authority of a measurement
 * made on a different population.
 */

import type { Candle } from "@/lib/sources/prices";
import { completeSessions, readBar, type BarCharacter } from "./tape";

/* ------------------------------------------------------------------ */
/* Shape                                                               */
/* ------------------------------------------------------------------ */

export type RankRead = {
  symbol: string;
  /**
   * Weighted return, in percent, before ranking. Kept because the rank
   * alone cannot be checked and this can.
   */
  strengthScore: number | null;
  /** Position in the universe, 1–99. Higher is stronger. */
  strengthRank: number | null;
  /** Plain returns behind the score, for a reader who wants the working. */
  return3m: number | null;
  return6m: number | null;
  return12m: number | null;
  /** The latest session's volume against its own 50-day average. */
  volumeRatio: number | null;
  /** That ratio's position in the universe, 1–99. */
  volumeRank: number | null;
  /**
   * What the last complete session looked like, from `tape.ts`.
   *
   * Carried here because this build already holds two years of candles for
   * every name and reading the bar costs nothing more. Without it, a page
   * that wants to ask "which companies had an absorption bar yesterday"
   * would have to pull 123 price histories inside a request, which is the
   * reason the question has never been asked.
   */
  character: BarCharacter | null;
  /** The date that character was read on — the same session for every name
   *  in the file, and worth printing so a stale build is visible. */
  characterAt: string | null;
};

export type RankFile = {
  builtAt: string;
  /** The last session every rank was measured on. One date for all of
   *  them — ranking a name measured on Tuesday against one measured on
   *  Friday is the quiet way to produce a nonsense table. */
  asOf: string;
  /** How many names the ranking was taken over. The number that makes the
   *  rank meaningful, and the one a page must print beside it. */
  universe: number;
  reads: Record<string, RankRead>;
};

/* ------------------------------------------------------------------ */
/* The score                                                           */
/* ------------------------------------------------------------------ */

/**
 * The weighting, and why the recent quarter counts twice.
 *
 * This is the long-standing convention for a relative strength score and
 * the reason behind it is not arbitrary: a measure that weights twelve
 * months evenly keeps rewarding a stock for a move it made last autumn and
 * has since given back. Doubling the most recent quarter makes the score
 * follow what the stock is doing now while still refusing to be excited by
 * a single week.
 *
 * Trading days, not calendar months, so a quarter is a quarter of
 * SESSIONS and a holiday cannot shorten one name's window relative to
 * another's.
 */
const WINDOWS = [
  { days: 63, weight: 2 },
  { days: 126, weight: 1 },
  { days: 189, weight: 1 },
  { days: 252, weight: 1 },
] as const;

function returnOver(candles: Candle[], days: number): number | null {
  if (candles.length <= days) return null;
  const then = candles[candles.length - 1 - days].close;
  const now = candles[candles.length - 1].close;
  if (!(then > 0)) return null;
  return ((now - then) / then) * 100;
}

/**
 * The weighted return for one name, or null when its history is short.
 *
 * Null rather than a partial score. A name with eight months of history
 * would otherwise be scored on three of its four windows and ranked
 * against names scored on four — a comparison between two different
 * measurements, presented as a league table. Rule 9.
 */
export function strengthScore(candles: Candle[]): number | null {
  let total = 0;
  let weight = 0;
  for (const window of WINDOWS) {
    const value = returnOver(candles, window.days);
    if (value === null) return null;
    total += value * window.weight;
    weight += window.weight;
  }
  return weight > 0 ? total / weight : null;
}

/**
 * The last COMPLETE session's volume against the 50 before it.
 *
 * Complete is doing the work. Run while New York is open — which is when
 * anyone would naturally run it — the last candle holds a few hours of
 * trading, and every name in the universe reports about a third of its
 * usual volume. Measured on the first build of this file: the median ratio
 * across all 123 names came out at 0.36.
 *
 * The RANK survives that, because everything is equally partial and a
 * ranking only cares about order. The RATIO does not, and the ratio is the
 * number a page would print. `tape.ts` solved this once for the bar read;
 * this uses the same function rather than a second copy of the rule, so
 * the two can never disagree about which session is the last one.
 */
export function volumeRatio(input: Candle[]): number | null {
  const { rows: candles } = completeSessions(input);
  if (candles.length < 51) return null;
  let sum = 0;
  for (let i = candles.length - 51; i < candles.length - 1; i++) {
    sum += candles[i].volume;
  }
  const average = sum / 50;
  if (!(average > 0)) return null;
  return candles[candles.length - 1].volume / average;
}

/* ------------------------------------------------------------------ */
/* The ranking                                                         */
/* ------------------------------------------------------------------ */

/**
 * Turn scores into positions, 1–99.
 *
 * Ties share the lower rank, which matters more than it sounds on a list
 * this size: two names with identical scores must not be separated by
 * whichever happened to sort first, because that separation would be
 * reported as a difference in strength and there isn't one.
 *
 * The scale stops at 99 and starts at 1 rather than running 0–100, for the
 * same reason the convention does: a rank of 100 reads as a perfect score
 * on something that has no perfect, and 0 reads as an absence of data
 * rather than as last place.
 */
export function rankOf(values: Map<string, number>): Map<string, number> {
  const sorted = [...values.entries()].sort((a, b) => a[1] - b[1]);
  const ranks = new Map<string, number>();
  const n = sorted.length;
  if (n === 0) return ranks;

  let i = 0;
  while (i < n) {
    /* Everything sharing this score takes the position of the first of
       them. */
    let j = i;
    while (j + 1 < n && sorted[j + 1][1] === sorted[i][1]) j++;
    const share = n > 1 ? i / (n - 1) : 1;
    const rank = Math.max(1, Math.min(99, Math.round(share * 98) + 1));
    for (let k = i; k <= j; k++) ranks.set(sorted[k][0], rank);
    i = j + 1;
  }
  return ranks;
}

/**
 * Rank a whole universe in one pass.
 *
 * Takes every name's candles and returns a complete file. A name whose
 * history is too short is still present in the output, with nulls — it is
 * in the universe and the page should be able to say "not ranked" rather
 * than silently omitting it, which reads as a bug to anyone who went
 * looking for it.
 */
export function rankUniverse(
  series: Map<string, Candle[]>,
): Omit<RankFile, "builtAt"> {
  const strengthScores = new Map<string, number>();
  const volumeRatios = new Map<string, number>();
  const rows = new Map<string, Omit<RankRead, "strengthRank" | "volumeRank">>();

  let asOf = "";

  for (const [symbol, candles] of series) {
    const last = candles[candles.length - 1]?.date ?? "";
    if (last > asOf) asOf = last;

    const score = strengthScore(candles);
    const ratio = volumeRatio(candles);
    if (score !== null) strengthScores.set(symbol, score);
    if (ratio !== null) volumeRatios.set(symbol, ratio);

    /* The last complete bar, read once while the candles are in hand. */
    const complete = completeSessions(candles).rows;
    const bar = readBar(complete, complete.length - 1);

    rows.set(symbol, {
      symbol,
      strengthScore: score,
      return3m: returnOver(candles, 63),
      return6m: returnOver(candles, 126),
      return12m: returnOver(candles, 252),
      volumeRatio: ratio,
      character: bar?.character ?? null,
      characterAt: bar?.date ?? null,
    });
  }

  const strengthRanks = rankOf(strengthScores);
  const volumeRanks = rankOf(volumeRatios);

  const reads: Record<string, RankRead> = {};
  for (const [symbol, row] of rows) {
    reads[symbol] = {
      ...row,
      strengthRank: strengthRanks.get(symbol) ?? null,
      volumeRank: volumeRanks.get(symbol) ?? null,
    };
  }

  return { asOf, universe: strengthScores.size, reads };
}

/* ------------------------------------------------------------------ */
/* Reading one                                                         */
/* ------------------------------------------------------------------ */

/**
 * The threshold the trend template asks for.
 *
 * Minervini's eighth criterion is an RS rating of 70 or better, and the
 * number is his rather than this project's — it is stated here as a
 * constant so the one place that applies it cannot drift from the one
 * place that explains it.
 */
export const STRONG_RANK = 70;

/** A rank in the reader's language, with the population it was taken
 *  over. The population is not optional: 90 out of 123 chosen companies
 *  and 90 out of the whole market are different claims. */
export function describeRank(rank: number | null, universe: number): string {
  if (rank === null) return "לא דורג — אין די היסטוריה";
  return `${rank} מתוך 99, מול ${universe} החברות ביקום המחקר של האתר`;
}
