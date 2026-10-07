/**
 * The correlation arithmetic, on series whose answer is known in advance.
 *
 * Every other test in this project earns its place by catching a drift.
 * This one earns it by covering a number a reader will act on: "your
 * fifteen holdings are three bets" is a sentence that changes what
 * somebody buys, and the arithmetic behind it has to be right for the
 * reasons it claims rather than by luck.
 *
 *   npx tsx --test scripts/correlation.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildCorrelations,
  correlationOf,
  effectiveBets,
  weeklyCloses,
} from "../src/lib/metrics/correlation";
import type { Candle } from "../src/lib/sources/prices";

function series(n: number, close: (i: number) => number): Candle[] {
  const rows: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = Math.max(1, close(i));
    rows.push({
      date: new Date(Date.UTC(2023, 0, 2) + i * 86_400_000).toISOString().slice(0, 10),
      open: c,
      high: c * 1.01,
      low: c * 0.99,
      close: c,
      volume: 1_000_000,
    });
  }
  return rows;
}

test("a series correlates perfectly with itself", () => {
  const a = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3));
  assert.ok(Math.abs(correlationOf(a, a)! - 1) < 1e-9);
});

test("a mirrored series correlates at minus one", () => {
  const a = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3));
  const b = a.map((v) => -v);
  assert.ok(Math.abs(correlationOf(a, b)! + 1) < 1e-9);
});

test("a constant series has no correlation rather than a correlation of one", () => {
  const a = Array.from({ length: 60 }, (_, i) => Math.sin(i / 3));
  const flat = new Array(60).fill(0.01);
  assert.equal(
    correlationOf(a, flat),
    null,
    "dividing by a zero deviation must not be reported as perfect agreement",
  );
});

test("too few observations is null, not a number", () => {
  const a = Array.from({ length: 10 }, (_, i) => i);
  assert.equal(correlationOf(a, a), null);
});

test("weekly closes collapse a year of sessions to about fifty-two", () => {
  const weeks = weeklyCloses(series(365, (i) => 100 + i));
  assert.ok(weeks.size >= 50 && weeks.size <= 54, `got ${weeks.size}`);
});

test("identical instruments collapse to one bet", () => {
  const shape = (i: number) => 100 + Math.sin(i / 9) * 20 + i * 0.05;
  const file = {
    builtAt: "",
    ...buildCorrelations(
      new Map([
        ["AAA", series(500, shape)],
        ["BBB", series(500, shape)],
        ["CCC", series(500, shape)],
      ]),
    ),
  };
  const bets = effectiveBets(
    ["AAA", "BBB", "CCC"].map((ticker) => ({ ticker, weight: 1 })),
    file,
  );
  assert.ok(bets);
  assert.ok(
    Math.abs(bets.effectivePositions - 3) < 1e-6,
    "three equal weights are three positions",
  );
  assert.ok(
    bets.effectiveBets < 1.05,
    `three copies of one series are one bet, got ${bets.effectiveBets}`,
  );
});

test("independent instruments keep their position count", () => {
  /* Three series driven by different, non-overlapping cycles. */
  const file = {
    builtAt: "",
    ...buildCorrelations(
      new Map([
        ["AAA", series(500, (i) => 100 + Math.sin(i / 7) * 15)],
        ["BBB", series(500, (i) => 100 + Math.sin(i / 23 + 2) * 15)],
        ["CCC", series(500, (i) => 100 + Math.cos(i / 41 + 1) * 15)],
      ]),
    ),
  };
  const bets = effectiveBets(
    ["AAA", "BBB", "CCC"].map((ticker) => ({ ticker, weight: 1 })),
    file,
  );
  assert.ok(bets);
  assert.ok(
    bets.effectiveBets > 1.8,
    `weakly related series should keep most of their count, got ${bets.effectiveBets}`,
  );
});

test("a holding the matrix does not cover is named rather than dropped silently", () => {
  const file = {
    builtAt: "",
    ...buildCorrelations(
      new Map([
        ["AAA", series(500, (i) => 100 + i * 0.1)],
        ["BBB", series(500, (i) => 100 + Math.sin(i / 11) * 10)],
      ]),
    ),
  };
  const bets = effectiveBets(
    [
      { ticker: "AAA", weight: 50 },
      { ticker: "ZZZ", weight: 50 },
    ],
    file,
  );
  assert.ok(bets);
  assert.deepEqual(bets.unmeasured, ["ZZZ"]);
});

test("no covered holding returns null instead of a made-up figure", () => {
  const file = {
    builtAt: "",
    ...buildCorrelations(new Map([["AAA", series(500, (i) => 100 + i * 0.1)]])),
  };
  assert.equal(effectiveBets([{ ticker: "ZZZ", weight: 100 }], file), null);
});

test("the matrix is symmetric and its diagonal is one", () => {
  const file = buildCorrelations(
    new Map([
      ["AAA", series(500, (i) => 100 + Math.sin(i / 7) * 15)],
      ["BBB", series(500, (i) => 100 + Math.sin(i / 23) * 15)],
      ["CCC", series(500, (i) => 100 + i * 0.1)],
    ]),
  );
  for (let i = 0; i < file.symbols.length; i++) {
    assert.equal(file.matrix[i][i], 1, "an instrument is itself");
    for (let j = 0; j < file.symbols.length; j++) {
      assert.equal(file.matrix[i][j], file.matrix[j][i], "must be symmetric");
      assert.ok(file.matrix[i][j] >= -1 && file.matrix[i][j] <= 1);
    }
  }
});
