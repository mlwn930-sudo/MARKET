/**
 * The tape, tested on series whose answer is known in advance.
 *
 * Measurement code fails quietly. A contrast bug is visible the moment
 * anyone looks at the page; a percentile computed over the wrong window
 * renders as a plausible number forever, and the only thing that catches
 * it is a series constructed so that the right answer is not in doubt.
 *
 * So the fixtures here are synthetic rather than real candles. A real
 * series tests whether the code runs. A series where every bar is
 * identical except one tests whether the code is right.
 *
 *   npx tsx --test scripts/tape.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  NORMAL_WINDOW,
  readBar,
  readObv,
  readTape,
  volumeProfile,
} from "../src/lib/metrics/tape";
import type { Candle } from "../src/lib/sources/prices";

/** A flat series: same price, same range, same volume, every day. Nothing
 *  in it is abnormal by construction, which makes it the right background
 *  to put a single abnormal bar on. */
function flat(n: number, volume = 1_000_000): Candle[] {
  const rows: Candle[] = [];
  for (let i = 0; i < n; i++) {
    const day = new Date(Date.UTC(2020, 0, 1) + i * 86_400_000);
    rows.push({
      date: day.toISOString().slice(0, 10),
      open: 100,
      high: 101,
      low: 99,
      close: 100,
      /* A touch of variation, or every percentile is a tie and the ranking
         tells us nothing about whether ranking works. */
      volume: volume + (i % 7) * 1_000,
    });
  }
  return rows;
}

test("a bar with no history behind it is not ranked", () => {
  const rows = flat(40);
  assert.equal(readBar(rows, rows.length - 1), null);
});

test("an ordinary bar on an ordinary series is quiet", () => {
  const rows = flat(300);
  const bar = readBar(rows, rows.length - 1);
  assert.ok(bar);
  assert.equal(bar.character, "quiet");
  assert.ok(Math.abs(bar.volumeRatio - 1) < 0.05, "ratio should sit at about 1");
});

test("extreme volume in a narrow range reads as absorption", () => {
  const rows = flat(300);
  const last = rows.length - 1;
  /* Twenty times the volume, and a range tighter than every other bar. */
  rows[last] = {
    ...rows[last],
    volume: 20_000_000,
    high: 100.1,
    low: 99.9,
    close: 100,
  };
  const bar = readBar(rows, last);
  assert.ok(bar);
  assert.equal(bar.character, "absorption");
  assert.ok(bar.effortZ > 2, "effort should be far above normal");
});

test("a climax needs a move to be the climax of", () => {
  const build = (priorMove: boolean) => {
    const rows = flat(300);
    const last = rows.length - 1;
    if (priorMove) {
      /* A twenty per cent slide over the month before the bar. */
      for (let i = last - 20; i < last; i++) {
        const drop = 100 - ((i - (last - 21)) / 20) * 20;
        rows[i] = { ...rows[i], open: drop, close: drop, high: drop + 1, low: drop - 1 };
      }
    }
    /* Huge volume, a wide range, closing in the middle: the shape of a
       climax in both cases. Only the context differs. */
    rows[last] = {
      ...rows[last],
      volume: 30_000_000,
      open: 82,
      high: 86,
      low: 74,
      close: 80,
    };
    return readBar(rows, last);
  };

  assert.equal(build(true)?.character, "climax");
  assert.notEqual(
    build(false)?.character,
    "climax",
    "the same bar in the middle of a flat range is not climaxing anything",
  );
});

test("no demand requires volume below the two bars before it", () => {
  const rows = flat(300);
  const last = rows.length - 1;
  /* An up close, a narrow range, and volume in the bottom of the year. */
  const quiet = { volume: 200_000, high: 100.2, low: 99.9 };
  rows[last - 1] = { ...rows[last - 1], ...quiet, volume: 150_000, close: 100 };
  rows[last] = { ...rows[last], ...quiet, close: 100.15 };
  assert.notEqual(
    readBar(rows, last)?.character,
    "no-demand",
    "a bar that traded MORE than the one before it is not drying up",
  );

  rows[last - 1] = { ...rows[last - 1], volume: 900_000 };
  rows[last - 2] = { ...rows[last - 2], volume: 900_000 };
  assert.equal(readBar(rows, last)?.character, "no-demand");
});

test("the profile's bins account for all of the window's volume", () => {
  const profile = volumeProfile(flat(300));
  assert.ok(profile);
  const total = profile.histogram.reduce((sum, share) => sum + share, 0);
  assert.ok(Math.abs(total - 1) < 1e-9, `histogram summed to ${total}`);
  assert.equal(profile.histogram.length, profile.bins);
});

test("the value area holds at least the share it claims", () => {
  /* A series that spends most of its time at 100 and occasionally visits
     120, so the profile has a real shape rather than a flat block. */
  const rows = flat(300);
  for (let i = 0; i < rows.length; i += 11) {
    rows[i] = { ...rows[i], open: 120, high: 121, low: 119, close: 120 };
  }
  const profile = volumeProfile(rows);
  assert.ok(profile);

  let held = 0;
  const width = (profile.high - profile.low) / profile.bins;
  profile.histogram.forEach((share, b) => {
    const centre = profile.low + (b + 0.5) * width;
    if (centre >= profile.valueAreaLow && centre <= profile.valueAreaHigh) held += share;
  });
  assert.ok(
    held >= profile.valueAreaShare - 0.02,
    `value area held ${held.toFixed(3)}, claims ${profile.valueAreaShare}`,
  );
  assert.ok(profile.poc >= profile.low && profile.poc <= profile.high);
  assert.ok(profile.valueAreaLow <= profile.poc && profile.poc <= profile.valueAreaHigh);
});

test("the heaviest price is where the series actually spent its time", () => {
  const rows = flat(300);
  /* Ten per cent of the sessions at 150, the rest at 100. The point of
     control belongs at 100 and nowhere near the visits. */
  for (let i = 0; i < rows.length; i += 10) {
    rows[i] = { ...rows[i], open: 150, high: 151, low: 149, close: 150 };
  }
  const profile = volumeProfile(rows);
  assert.ok(profile);
  assert.ok(
    Math.abs(profile.poc - 100) < 3,
    `POC landed at ${profile.poc.toFixed(2)}, expected about 100`,
  );
});

test("on-balance volume reports agreement as agreement", () => {
  /* A steady advance: price and the running total go the same way, and a
     divergence here would be the indicator inventing one. */
  const rows = flat(200).map((c, i) => ({
    ...c,
    open: 100 + i * 0.5,
    close: 100 + i * 0.5,
    high: 101 + i * 0.5,
    low: 99 + i * 0.5,
  }));
  const obv = readObv(rows);
  assert.ok(obv);
  assert.equal(obv.divergence, null);
  assert.ok(obv.slope > 0, "a series that only rises should accumulate");
});

test("a higher high on a lower running total is reported as a divergence", () => {
  const rows = flat(200);
  const half = rows.length - 30;
  /* First leg up on heavy volume, second leg higher on light volume. */
  for (let i = rows.length - 60; i < half; i++) {
    rows[i] = { ...rows[i], close: 110, high: 112, low: 108, volume: 5_000_000 };
  }
  for (let i = half; i < rows.length; i++) {
    rows[i] = { ...rows[i], close: 100, high: 101, low: 99, volume: 100_000 };
  }
  rows[rows.length - 1] = {
    ...rows[rows.length - 1],
    close: 115,
    high: 116,
    low: 114,
    volume: 100_000,
  };
  const obv = readObv(rows, 60);
  assert.ok(obv);
  assert.equal(obv.divergence, "bearish");
});

test("a short series is reported as unmeasured rather than measured badly", () => {
  const read = readTape(flat(60));
  assert.equal(read.latest, null);
  assert.equal(read.profile, null);
  assert.ok(read.caveats.length > 0, "it has to say why");
});

test("the normal window is a trading year", () => {
  /* Guards the constant against a well-meaning edit: every threshold in
     the file is a percentile of this window, so changing it silently
     changes what "heavy" means on every page. */
  assert.equal(NORMAL_WINDOW, 252);
});
