import test from "node:test";
import assert from "node:assert/strict";
import { buildTradePlan } from "../src/lib/analysis/trade-plan";
import type { PriceLevel } from "../src/lib/metrics/levels";
import type { ConditionCite } from "../src/lib/analysis/stance";

/**
 * The risk arithmetic, which replaced a refusal that was too broad.
 *
 * "The site does not measure entries or stops" covered three things and
 * only one of them — position size — was actually uncomputable. These
 * pin the two that were being withheld, and the ceiling that keeps a
 * stop from quietly becoming a different position.
 */

function level(price: number, over: Partial<PriceLevel> = {}): PriceLevel {
  return {
    price,
    kind: "support",
    touches: 4,
    lastTouch: "2026-09-01",
    held: 12,
    broke: 2,
    volumeRatio: 1,
    distancePercent: 0,
    ...over,
  };
}

function cite(over: Partial<ConditionCite> = {}): ConditionCite {
  return {
    key: "reclaim-50",
    label: "סגירה מעל ממוצע 50",
    n: 54,
    occurrences: 60,
    lastAt: "2026-10-09",
    upShareHist: 0.7,
    baselineUpShare: 0.55,
    liftPp: 15,
    medianPct: 6.2,
    baselineMedianPct: 2,
    p25Pct: -2,
    p75Pct: 12,
    worstPct: -22.1,
    medianAdversePct: -5.8,
    baselineAdversePct: -8.5,
    ...over,
  };
}

const base = { lastClose: 200, asOf: "2026-10-09", atr: 4 };

test("the stop sits under a measured band, not at a round number", () => {
  const plan = buildTradePlan({ ...base, levels: [level(194)], lead: null });
  /* 194 minus half an ATR. The band is what the market turned at; the
     buffer is so an ordinary wick does not take the position out. */
  assert.equal(plan!.stop, 192);
  assert.match(plan!.stopReason, /194\.00/);
  assert.ok(plan!.riskPercent > 3.9 && plan!.riskPercent < 4.1);
});

test("a band too far away hands the stop to volatility instead", () => {
  /* 150 is 25% away: a stop there is not protection, it is a different
     position. Two average ranges below the close is. */
  const plan = buildTradePlan({ ...base, levels: [level(150)], lead: null });
  assert.equal(plan!.stop, 192);
  assert.match(plan!.stopReason, /טווחים יומיים/);
});

test("the risk ceiling is never crossed, whatever the structure says", () => {
  const plan = buildTradePlan({
    ...base,
    atr: 40,
    levels: [level(150)],
    lead: null,
  });
  assert.ok(plan!.riskPercent <= 8.001, "8% is the ceiling");
  assert.match(plan!.stopReason, /תקרת הסיכון/);
});

test("targets are multiples of the risk and never a measured price", () => {
  const plan = buildTradePlan({ ...base, levels: [level(194)], lead: null });
  const risk = 200 - 192;
  assert.deepEqual(
    plan!.targets.map((t) => t.price),
    [200 + risk, 200 + risk * 2, 200 + risk * 3],
  );
  /* With no counted condition there is no measured move to offer, and
     inventing one is exactly what the multiples exist to avoid. */
  assert.equal(plan!.measuredMove, null);
});

test("a stop inside the condition's own typical drawdown is called out", () => {
  /* The sentence no chart tool can produce: the excursion DURING the
     historical windows the rate was counted over. A 4% stop against a
     5.8% median drawdown would have been hit in more than half of the
     cases that produced the 70%. */
  const plan = buildTradePlan({ ...base, levels: [level(194)], lead: cite() });
  assert.equal(plan!.survival!.clearsMedian, false);
  assert.match(plan!.survival!.note, /צר מהירידה החציונית/);
  /* The rate it would have been hit across is quoted from the cite, not
     hardcoded — an early draft wrote "70 אחוז" into the string. */
  assert.match(plan!.survival!.note, /70%/);
});

test("a stop outside the typical drawdown is called out too, with the worst case", () => {
  const plan = buildTradePlan({
    ...base,
    levels: [level(188)],
    lead: cite({ medianAdversePct: -2.1, worstPct: -9 }),
  });
  assert.equal(plan!.survival!.clearsMedian, true);
  assert.match(plan!.survival!.note, /רחב מהירידה החציונית/);
  assert.match(plan!.survival!.note, /9\.0%/);
});

test("the measured move is offered beside the multiples, labelled as measured", () => {
  const plan = buildTradePlan({ ...base, levels: [level(194)], lead: cite() });
  assert.ok(plan!.measuredMove);
  assert.equal(plan!.measuredMove!.percent, 6.2);
  assert.ok(Math.abs(plan!.measuredMove!.price - 212.4) < 0.01);
});

test("position size stays missing, and says why", () => {
  /* The one input no amount of candle history supplies. It is named
     rather than approximated, which is rule 9 in the direction that
     actually costs something. */
  const plan = buildTradePlan({ ...base, levels: [level(194)], lead: cite() });
  assert.match(plan!.sizing, /אינו נגזר מהגרף/);
  assert.match(plan!.sizing, /8\.00/);
});

test("no levels at all still produces a plan", () => {
  /* A screenshot of a name the site barely covers must not fall back to
     a refusal: volatility alone is enough to place a stop. */
  const plan = buildTradePlan({ ...base, levels: [], lead: null });
  assert.ok(plan);
  assert.equal(plan!.supportBelow, null);
  assert.equal(plan!.stop, 192);
});
