/**
 * The template's two readers must agree, always.
 *
 * `trendTemplate` builds labelled checks for a page out of the last bar.
 * `priceCriteriaPassed` answers the same seven questions at any bar, which
 * is what lets `base-rates.ts` measure what the template has been followed
 * by. Two readers of one rule is a drift waiting to happen, and a drift
 * here would be the worst kind: the panel would report "seven of seven"
 * under one set of thresholds and the track record printed beside it would
 * have been counted under another. Nobody would see it. Both numbers would
 * look fine.
 *
 * So this asserts they agree — on constructed series chosen to land on
 * each side of every threshold, and on the awkward cases that break
 * boundary arithmetic: a series exactly 252 bars long, one shorter than
 * the 200-day average, one that is perfectly flat.
 *
 *   npx tsx --test scripts/template-facts.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  priceCriteriaPassed,
  templateFactsAt,
  trendTemplate,
  sma,
  PRICE_CRITERIA,
} from "../src/lib/metrics/technical";
import type { Candle } from "../src/lib/sources/prices";

/** A series whose closing price follows `shape`, with a sane range around
 *  each close so the 52-week high and low are not the closes themselves. */
function series(n: number, shape: (i: number) => number): Candle[] {
  const rows: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const close = Math.max(1, shape(i));
    const day = new Date(Date.UTC(2018, 0, 1) + i * 86_400_000);
    rows.push({
      date: day.toISOString().slice(0, 10),
      open: close,
      high: close * 1.01,
      low: close * 0.99,
      close,
      volume: 1_000_000,
    });
  }
  return rows;
}

/** What the page's reader says, counted the same way. */
function fromTemplate(candles: Candle[]) {
  const t = trendTemplate(candles, null);
  const price = t.checks.filter((c) => c.key !== "relative_strength");
  return {
    passed: price.filter((c) => c.pass === true).length,
    evaluated: price.filter((c) => c.pass !== null).length,
  };
}

/** What the index-wise reader says at the last bar. */
function fromCriteria(candles: Candle[]) {
  const last = candles.length - 1;
  return priceCriteriaPassed(
    templateFactsAt(
      candles,
      last,
      sma(candles, 50),
      sma(candles, 150),
      sma(candles, 200),
    ),
  );
}

const CASES: [string, Candle[]][] = [
  ["a steady advance", series(600, (i) => 100 + i * 0.4)],
  ["a steady decline", series(600, (i) => 500 - i * 0.4)],
  ["flat forever", series(600, () => 100)],
  ["a peak then a slide", series(600, (i) => (i < 300 ? 100 + i : 400 - (i - 300) * 0.9))],
  ["a bottom then a recovery", series(600, (i) => (i < 300 ? 400 - i : 100 + (i - 300) * 1.1))],
  ["a sawtooth", series(600, (i) => 200 + Math.sin(i / 20) * 60)],
  ["exactly 252 bars", series(252, (i) => 100 + i * 0.3)],
  ["shorter than the 200-day average", series(140, (i) => 100 + i * 0.3)],
  ["barely enough for anything", series(30, (i) => 100 + i)],
  ["a near-vertical run", series(600, (i) => 50 * Math.pow(1.004, i))],
];

for (const [name, candles] of CASES) {
  test(`the two readers agree: ${name}`, () => {
    const page = fromTemplate(candles);
    const indexed = fromCriteria(candles);
    assert.deepEqual(
      indexed,
      page,
      `${name}: page said ${page.passed}/${page.evaluated}, index-wise said ${indexed.passed}/${indexed.evaluated}`,
    );
  });
}

test("the price criteria are seven, and the template holds eight", () => {
  assert.equal(PRICE_CRITERIA, 7);
  const t = trendTemplate(series(600, (i) => 100 + i * 0.4), null);
  assert.equal(t.checks.length, PRICE_CRITERIA + 1, "the eighth is the rank");
});

test("a criterion that cannot be evaluated is neither passed nor failed", () => {
  /* Twenty bars: no 50-day, no 150, no 200. Only the tests that need
     nothing but price and the 52-week window can be answered. */
  const short = series(20, (i) => 100 + i);
  const { passed, evaluated } = fromCriteria(short);
  assert.ok(evaluated < PRICE_CRITERIA, "some criteria must be unevaluable");
  assert.ok(passed <= evaluated, "cannot pass more than were evaluated");
});

test("the rank decides the eighth criterion when one is supplied", () => {
  const candles = series(600, (i) => 100 + i * 0.4);
  const strong = trendTemplate(candles, null, 85, 123);
  const weak = trendTemplate(candles, null, 40, 123);
  const find = (t: ReturnType<typeof trendTemplate>) =>
    t.checks.find((c) => c.key === "relative_strength");
  assert.equal(find(strong)?.pass, true);
  assert.equal(find(weak)?.pass, false);
  /* And the price criteria are untouched by it. */
  assert.equal(
    strong.checks.filter((c) => c.key !== "relative_strength" && c.pass === true).length,
    weak.checks.filter((c) => c.key !== "relative_strength" && c.pass === true).length,
  );
});
