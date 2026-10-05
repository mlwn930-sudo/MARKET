import type { BaseRateRead } from "./base-rates";
import { getBaseRates } from "./base-rate-store";

/**
 * What a chart signal is worth, measured across the whole universe.
 *
 * The per-company panel answers "what did this condition do on this
 * name". It cannot answer the question underneath it, which is whether
 * the condition is worth anything AT ALL — because one name is one name,
 * and a +7pp lift on NVDA is as likely to be NVDA as it is to be the
 * fifty-day.
 *
 * A hundred and twenty-three names over ten years can answer it. Each
 * name contributes one number, the distance between its own conditional
 * rate and its own baseline, so a company that tripled cannot drag the
 * result: its baseline rose with it. What is left is the signal.
 *
 * WHAT THIS IS NOT. It is not a backtest of a strategy — there is no
 * position, no cost, no slippage and no exit, so nothing here says what
 * trading any of it would have returned. It is the narrower and more
 * answerable question of whether the event carried information about the
 * month that followed it, which is the claim every chart signal is
 * actually making.
 *
 * AND THE WINDOW IS THE BIGGEST CAVEAT IN THE PROJECT. These are large US
 * companies that are in the index TODAY, measured over a decade that was
 * mostly rising. That selects for survivors twice over, and it is almost
 * certainly why the death cross scores well: the crosses happened inside
 * drawdowns, and every drawdown in this window was recovered. Read as
 * "what these signals were worth on these names in this decade" and the
 * figures are solid; read as "what they are worth" and they are not.
 */

export type SignalValue = {
  label: string;
  /** Names where the condition fired often enough to report. */
  names: number;
  /** Median lift in percentage points — the headline. */
  medianLiftPp: number;
  /** The middle half, so the spread is visible rather than implied. */
  p25LiftPp: number;
  p75LiftPp: number;
  /** Share of names where it helped or hurt by ten points or more. */
  shareStrongUp: number;
  shareStrongDown: number;
  /** Total occurrences counted across every name. */
  occurrences: number;
};

export type SignalValueReport = {
  /** Names that had enough history to measure at all. */
  universe: number;
  /** Conditions with a reportable sample, and the total measured. */
  measurable: number;
  total: number;
  /** How many of those moved the rate ten points against their baseline. */
  strong: number;
  signals: SignalValue[];
  from: string;
  to: string;
};

/** The horizon the report speaks to. A month: long enough for a daily
 *  structure to resolve, short enough to still be about the signal. */
const HORIZON = 21;

/** The same floor the per-company panel uses, for the same reason. */
const MIN_SAMPLE = 8;

function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return 0;
  const pos = (sorted.length - 1) * q;
  const lo = Math.floor(pos);
  const hi = Math.ceil(pos);
  return lo === hi ? sorted[lo] : sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
}

export async function getSignalValue(): Promise<SignalValueReport | null> {
  const file = await getBaseRates();
  const reads: BaseRateRead[] = Object.values(file.reads);
  if (reads.length === 0) return null;

  const lifts = new Map<string, number[]>();
  const counts = new Map<string, number>();
  let measurable = 0;
  let total = 0;
  let strong = 0;

  for (const read of reads) {
    for (const condition of read.conditions) {
      const outcome = condition.outcomes.find((o) => o.days === HORIZON);
      if (!outcome) continue;
      total++;
      if (outcome.n < MIN_SAMPLE) continue;

      measurable++;
      if (Math.abs(outcome.liftPp) >= 10) strong++;

      const list = lifts.get(condition.label) ?? [];
      list.push(outcome.liftPp);
      lifts.set(condition.label, list);
      counts.set(
        condition.label,
        (counts.get(condition.label) ?? 0) + outcome.n,
      );
    }
  }

  const signals: SignalValue[] = [...lifts.entries()]
    .map(([label, values]) => {
      const sorted = [...values].sort((a, b) => a - b);
      return {
        label,
        names: sorted.length,
        medianLiftPp: quantile(sorted, 0.5),
        p25LiftPp: quantile(sorted, 0.25),
        p75LiftPp: quantile(sorted, 0.75),
        shareStrongUp: sorted.filter((v) => v >= 10).length / sorted.length,
        shareStrongDown: sorted.filter((v) => v <= -10).length / sorted.length,
        occurrences: counts.get(label) ?? 0,
      };
    })
    /* Ordered by how many names could measure it, not by how well it
       scored. Ranking by the result would turn a measurement into a
       leaderboard of signals, which is the thing this page exists to
       argue against. */
    .sort((a, b) => b.names - a.names);

  const froms = reads.map((r) => r.from).sort();
  const tos = reads.map((r) => r.to).sort();

  return {
    universe: reads.length,
    measurable,
    total,
    strong,
    signals,
    from: froms[0],
    to: tos[tos.length - 1],
  };
}
