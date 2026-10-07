/**
 * The read that decides whether a chart is worth interrupting somebody for.
 *
 * `readSetup` counts independent families and separates the observations
 * that argue against the others. Both of those are easy to get wrong in a
 * way nothing notices: a family counted twice inflates the number toward
 * the threshold, and a cautionary observation filed as supportive turns a
 * reading into an argument. Neither looks like a bug. Both change what
 * reaches an inbox.
 *
 * The fixtures are constructed series whose shape is not in question — a
 * straight advance, a straight decline, a flat line — so the expected
 * answer is a property of the definition rather than of the data.
 *
 *   npx tsx --test scripts/setup.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { AT_LEVEL_PERCENT, CONVERGENCE_CAVEAT, readSetup } from "../src/lib/analysis/setup";
import type { Candle } from "../src/lib/sources/prices";

function series(n: number, close: (i: number) => number, volume = 1_000_000): Candle[] {
  const rows: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const c = Math.max(1, close(i));
    rows.push({
      date: new Date(Date.UTC(2017, 0, 2) + i * 86_400_000).toISOString().slice(0, 10),
      open: c,
      high: c * 1.012,
      low: c * 0.988,
      close: c,
      volume: volume + (i % 7) * 1_000,
    });
  }
  return rows;
}

test("a family is never counted twice", () => {
  /* The failure that inflates a convergence toward its own threshold.
     Whatever the series does, each family may contribute at most once. */
  for (const shape of [
    (i: number) => 100 + i * 0.4,
    (i: number) => 600 - i * 0.4,
    () => 100,
    (i: number) => 200 + Math.sin(i / 30) * 50,
  ]) {
    const read = readSetup("TEST", series(700, shape), null, null);
    assert.equal(
      read.families.length,
      new Set(read.families).size,
      `a family repeated in ${read.families.join(",")}`,
    );
    assert.equal(read.convergence, read.families.length);
  }
});

test("the convergence never exceeds the families that exist", () => {
  const read = readSetup("TEST", series(700, (i) => 100 + i * 0.3), null, null);
  assert.ok(read.convergence <= 5, `got ${read.convergence}`);
});

test("a downtrend files its trend observation as cautionary", () => {
  const read = readSetup("TEST", series(700, (i) => 600 - i * 0.6), null, null);
  const all = [...read.observations, ...read.tension];
  const trend = all.find((o) => o.key.startsWith("stage") || o.key === "trend-mixed");
  assert.ok(trend, "a decisive decline must produce a trend observation");
  assert.equal(trend.side, "cautionary");
  assert.ok(
    read.tension.some((o) => o.key === trend.key),
    "a cautionary observation belongs in tension, not in the supporting list",
  );
});

test("an advance files its trend observation as constructive", () => {
  const read = readSetup("TEST", series(700, (i) => 100 * Math.pow(1.002, i)), null, null);
  const trend = read.observations.find((o) => o.key === "stage-2");
  if (trend) assert.equal(trend.side, "constructive");
  assert.ok(
    !read.tension.some((o) => o.key === "stage-2"),
    "a constructive reading must not be filed as tension",
  );
});

test("tension and observations never hold the same line twice", () => {
  const read = readSetup("TEST", series(700, (i) => 300 + Math.sin(i / 40) * 80), null, null);
  const keys = [...read.observations, ...read.tension].map((o) => o.key);
  assert.equal(keys.length, new Set(keys).size, "an observation appeared twice");
});

test("nothing is worth watching without a measured record", () => {
  /* The rule that keeps a convergence of unmeasured descriptions from
     reaching somebody's inbox. With no base rates supplied, no
     observation can carry a record, so the read must stay silent however
     many families are true. */
  const read = readSetup("TEST", series(700, (i) => 100 + i * 0.4), null, null);
  assert.equal(
    read.worthWatching,
    false,
    "families converged, but nothing about them has been counted",
  );
});

test("a flat line produces no situation", () => {
  const read = readSetup("TEST", series(700, () => 100), null, null);
  assert.equal(read.worthWatching, false);
});

test("the caveat that the count predicts nothing always ships", () => {
  /* Measured over 17,566 observations and found to be worth -0.3pp. A
     panel that printed the count without this would be the site doing to
     itself what it refuses to do anywhere else. */
  const read = readSetup("TEST", series(700, (i) => 100 + i * 0.4), null, null);
  assert.ok(
    read.caveats.includes(CONVERGENCE_CAVEAT),
    "the measurement that argues against the feature must travel with it",
  );
  assert.match(CONVERGENCE_CAVEAT, /17,566|17566/);
});

test("too little history is reported, not guessed at", () => {
  const read = readSetup("TEST", series(40, (i) => 100 + i), null, null);
  assert.equal(read.worthWatching, false);
  assert.ok(read.caveats.length > 0);
});

test("the level threshold is a single shared number", () => {
  /* Two thresholds for one idea is how a panel and an email start
     describing different charts. */
  assert.equal(AT_LEVEL_PERCENT, 2);
});

test("every observation carries the figures behind it", () => {
  const read = readSetup("TEST", series(700, (i) => 300 + Math.sin(i / 25) * 60), null, null);
  for (const o of [...read.observations, ...read.tension]) {
    assert.ok(o.label.length > 0, `${o.key} has no label`);
    assert.ok(o.detail.length > 0, `${o.key} has no detail — nothing to check`);
  }
});
