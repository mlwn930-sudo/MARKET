/**
 * The tier that decides what interrupts somebody.
 *
 * `readRelevance` is the most opinionated code in the project: it takes
 * measurements and returns a word that will appear at the top of an email.
 * Everything else here reports; this one ranks. That makes it exactly the
 * module where an untested change does the most damage, because a wrong
 * tier does not look wrong — it looks like a quiet week, or like a site
 * that cries wolf.
 *
 * The rules it has to keep, each one a line in these tests:
 *
 *   a finding with no measurement behind it cannot reach the top level;
 *   a measured condition whose distance from its own baseline is small is
 *     reported as having added nothing, however large the raw numbers;
 *   a rate built on fewer than the sample floor is not a rate and lifts
 *     nothing;
 *   and the reason is never empty, because a ranking a reader cannot
 *     check is the thing this project does not do.
 *
 *   npx tsx --test scripts/relevance.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  RELEVANCE_LABELS,
  RELEVANCE_ORDER,
  readRelevance,
} from "../src/lib/alerts/relevance";

test("a measured condition far from its baseline is the top level", () => {
  const read = readRelevance({ liftPp: 28, sampleSize: 40, occurrences: 40 });
  assert.equal(read.level, "high");
  assert.match(read.why, /28/, "the number that decided it must be named");
});

test("a large negative distance is also the top level", () => {
  /* Direction is not relevance. A condition followed by a materially
     WORSE outcome than a random day is exactly as worth knowing. */
  const read = readRelevance({ liftPp: -24, sampleSize: 30, occurrences: 30 });
  assert.equal(read.level, "high");
});

test("a measured condition close to its baseline says it added nothing", () => {
  const read = readRelevance({ liftPp: 3, sampleSize: 60, occurrences: 60 });
  assert.equal(read.level, "low");
  assert.match(read.why, /לא הוסיף מידע/);
});

test("a rate under the sample floor is not a rate and lifts nothing", () => {
  /* Three out of four is "75%" and is nothing. A tier built on it would
     be the sample-size error with a label on top. */
  const read = readRelevance({ liftPp: 40, sampleSize: 4, occurrences: 4 });
  assert.notEqual(read.level, "high");
});

test("rarity alone lifts to the middle, never to the top", () => {
  /* Nine firings in ten years is worth noticing. It is not, on its own,
     worth the word that means the site measured something. */
  const read = readRelevance({ occurrences: 9, sessions: 2520 });
  assert.equal(read.level, "medium");
  assert.match(read.why, /נדיר/);
});

test("a condition that fires constantly says so", () => {
  const read = readRelevance({ occurrences: 300, sessions: 2520 });
  assert.match(read.why, /פעמים בשנה/);
  assert.notEqual(read.level, "high");
});

test("a three-sigma day is the top level on its own", () => {
  const read = readRelevance({ sigma: 3.4 });
  assert.equal(read.level, "high");
  assert.match(read.why, /3\.4/);
});

test("a two-sigma day is the middle, not the top", () => {
  assert.equal(readRelevance({ sigma: 2.1 }).level, "medium");
});

test("extreme volume lifts, and a dead-quiet session does not", () => {
  assert.equal(readRelevance({ volumePercentile: 0.99 }).level, "high");
  const quiet = readRelevance({ volumePercentile: 0.01 });
  assert.notEqual(quiet.level, "high");
  assert.match(quiet.why, /מהשקטים/, "the other tail is a measurement too");
});

test("a story the reading calls noise is the bottom level", () => {
  const read = readRelevance({
    catalystKind: "noise",
    significance: "high",
    catalystNote: "סקירה כללית בלי אירוע עסקי",
  });
  assert.equal(read.level, "low", "noise outranks significance");
  assert.match(read.why, /רעש/);
});

test("a high-impact catalyst is the top level, and carries the reasoning", () => {
  const read = readRelevance({
    catalystKind: "catalyst",
    significance: "high",
    catalystNote: "הזמנה שמשנה את תחזית ההכנסות",
  });
  assert.equal(read.level, "high");
  assert.match(read.why, /הזמנה שמשנה/, "the model's own sentence must survive");
});

test("a catalyst of ordinary reach is the middle", () => {
  assert.equal(
    readRelevance({ catalystKind: "catalyst", significance: "low" }).level,
    "medium",
  );
});

test("nothing measurable is reported, not ranked", () => {
  const read = readRelevance({});
  assert.equal(read.level, "medium");
  assert.match(read.why, /לא מדורג/);
});

test("the reason is never empty", () => {
  /* A label with no argument under it is the thing this project refuses
     to produce. Every path through the function has to say something. */
  const inputs = [
    {},
    { liftPp: 20, sampleSize: 20 },
    { liftPp: 1, sampleSize: 20 },
    { sigma: 4 },
    { occurrences: 5, sessions: 2520 },
    { volumePercentile: 0.99 },
    { catalystKind: "noise" as const },
    { catalystKind: "catalyst" as const, significance: "high" as const },
  ];
  for (const input of inputs) {
    const read = readRelevance(input);
    assert.ok(read.why.length > 0, `empty reason for ${JSON.stringify(input)}`);
    assert.ok(RELEVANCE_LABELS[read.level], "level must have a label");
  }
});

test("the levels sort the way an inbox should be read", () => {
  assert.ok(RELEVANCE_ORDER.high < RELEVANCE_ORDER.medium);
  assert.ok(RELEVANCE_ORDER.medium < RELEVANCE_ORDER.low);
});
