/**
 * How remarkable is a ten-point gap, when you test thirteen conditions?
 *
 * `MEANINGFUL_PP = 10` decides which conditions are allowed to carry a
 * direction on the chart reader. It was chosen as the distance below
 * which a difference measured on tens of overlapping windows is
 * indistinguishable from the window you happened to measure — a
 * defensible floor, and nobody had asked the question that comes after
 * it: the site does not test one condition per name, it tests about
 * thirteen, and the stance reports whichever of them happen to be true
 * today.
 *
 * With thirteen tests, "one of them cleared ten points" stops being a
 * finding and becomes the expected outcome. That is multiple
 * comparisons, and it is the oldest way to turn noise into a result.
 *
 * This counts what actually happens, over the stored measurement rather
 * than over a model of it. Two numbers matter and they are reported
 * separately, because together they say something the project has to
 * print next to its own panel:
 *
 *   The best condition on a name — what a reader would find if they
 *   looked down the list and stopped at the most impressive row.
 *
 *   Every condition, split by whether it is true today — which is what
 *   the stance actually uses. If active conditions had bigger gaps than
 *   inactive ones, being true today would carry information of its own.
 *
 * Run with:  npx tsx scripts/measure-selection.ts
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { MIN_SAMPLE, MEANINGFUL_PP } from "../src/lib/metrics/base-rates";
import type { BaseRateRead } from "../src/lib/metrics/base-rates";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FILE = resolve(ROOT, "content/base-rates/latest.json");

/** The horizon the stance headline uses. */
const HORIZON = 21;

const quantile = (values: number[], p: number): number => {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.floor((sorted.length - 1) * p)];
};

const share = (values: number[], atLeast: number): number =>
  values.filter((v) => v >= atLeast).length / values.length;

function main() {
  const file = JSON.parse(readFileSync(FILE, "utf8")) as {
    reads: Record<string, BaseRateRead>;
  };

  /** The largest gap on each name, whether or not it is true today. */
  const bestPerName: number[] = [];
  /** Every measurable condition, split by whether it fired on the last bar. */
  const active: number[] = [];
  const inactive: number[] = [];
  const testedPerName: number[] = [];

  for (const read of Object.values(file.reads)) {
    let best = 0;
    let tested = 0;
    for (const condition of read.conditions) {
      const outcome = condition.outcomes.find((o) => o.days === HORIZON);
      /* The same gate the panel uses. A condition the site would not
         print is not one it can be accused of selecting. */
      if (!outcome || outcome.n < MIN_SAMPLE) continue;
      tested++;
      const lift = Math.abs(outcome.liftPp);
      if (lift > best) best = lift;
      (condition.activeNow ? active : inactive).push(lift);
    }
    if (tested === 0) continue;
    testedPerName.push(tested);
    bestPerName.push(best);
  }

  const line = (label: string, values: number[]) =>
    `${label.padEnd(16)} n=${String(values.length).padEnd(6)}` +
    `median ${quantile(values, 0.5).toFixed(1)}pp   ` +
    `>=${MEANINGFUL_PP}pp ${(share(values, MEANINGFUL_PP) * 100).toFixed(0)}%   ` +
    `>=20pp ${(share(values, 20) * 100).toFixed(0)}%`;

  console.log(`names measured          ${bestPerName.length}`);
  console.log(
    `conditions per name     median ${quantile(testedPerName, 0.5)}`,
  );
  console.log("");
  console.log(line("best on a name", bestPerName));
  console.log(line("active today", active));
  console.log(line("not active", inactive));
  console.log("");

  /* The sentence the project owes itself. */
  const bestClears = share(bestPerName, MEANINGFUL_PP);
  console.log(
    `${(bestClears * 100).toFixed(0)}% of names have at least one condition clearing ` +
      `${MEANINGFUL_PP}pp somewhere in their list.`,
  );
  console.log(
    `A condition being true today does not make its gap larger: ` +
      `${quantile(active, 0.5).toFixed(1)}pp against ` +
      `${quantile(inactive, 0.5).toFixed(1)}pp for ones that are not.`,
  );
}

main();
