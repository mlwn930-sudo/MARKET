/**
 * The private build states a direction. These pin what it is allowed to
 * state it from.
 *
 * Every test here corresponds to a way the first design of `stance.ts`
 * was wrong, and most of those were found by running the proposed rule
 * over the real stored measurement before writing the file. On all 123
 * names in `content/base-rates/latest.json`, ten produce a direction and
 * the distribution of agreeing conditions is {0: 113, 1: 10, 2: 0, 3: 0}.
 * So the dominant case is "nothing fired", two levels of the conviction
 * score that was planned never occurred, and the blend that was planned
 * had nothing to blend.
 *
 * The test that matters most is "no field is an average". It is the
 * strongest expression of rule 9 available in a unit test: every number
 * the engine returns must be identical to a number it was handed. If
 * anybody later adds a weighted probability across conditions, that test
 * fails rather than the site quietly publishing a figure nobody measured.
 *
 *   npx tsx --test scripts/stance.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  buildChartStance,
  quantileRows,
  POSITION_DAYS,
  SWING_DAYS,
} from "../src/lib/analysis/stance";
import { MEANINGFUL_PP, MIN_SAMPLE } from "../src/lib/metrics/base-rates";
import type {
  BaseRateRead,
  ConditionRead,
  Outcome,
} from "../src/lib/metrics/base-rates";
import { isPrivateBuild } from "../src/lib/private-mode";
import type { Observation, SetupRead } from "../src/lib/analysis/setup";

/* ── Fixtures ─────────────────────────────────────────────────────────── */

const HORIZONS = [5, 10, 21, 63] as const;

function outcome(days: number, over: Partial<Outcome> = {}): Outcome {
  return {
    days: days as Outcome["days"],
    n: 40,
    up: 0.7,
    medianPct: 4,
    p25Pct: -2,
    p75Pct: 9,
    worstPct: -18,
    baselineUp: 0.55,
    baselineMedianPct: 1.5,
    liftPp: 15,
    medianAdversePct: -5,
    medianFavourablePct: 7,
    baselineAdversePct: -4,
    baselineFavourablePct: 6,
    ...over,
  };
}

function condition(
  key: string,
  label: string,
  activeNow: boolean,
  per: Partial<Record<number, Partial<Outcome>>> = {},
): ConditionRead {
  return {
    key,
    label,
    activeNow,
    occurrences: 44,
    lastAt: "2026-10-01",
    outcomes: HORIZONS.map((d) => outcome(d, per[d] ?? {})),
  };
}

function rates(conditions: ConditionRead[]): BaseRateRead {
  return {
    symbol: "TEST",
    from: "2016-10-10",
    to: "2026-10-08",
    sessions: 2513,
    conditions,
    caveats: ["העבר אינו טוען דבר על העתיד."],
  } as BaseRateRead;
}

function observation(key: string, side: Observation["side"]): Observation {
  return { key, label: `תצפית ${key}`, detail: "פרטים", side, record: null };
}

function setup(observations: Observation[], tension: Observation[] = []): SetupRead {
  return {
    symbol: "TEST",
    asOf: "2026-10-08",
    observations,
    tension,
    convergence: observations.length,
    families: observations.map((o) => o.key.split("-")[0]),
    worthWatching: true,
    caveats: [],
  } as SetupRead;
}

const build = (
  conditions: ConditionRead[],
  s: SetupRead | null = null,
  lastClose = 200,
) => buildChartStance({ setup: s, baseRates: rates(conditions), lastClose });

/* ── What the engine may conclude ─────────────────────────────────────── */

test("nothing firing is a direction of none, never a direction", () => {
  /* The dominant case: 113 of 123 names today. If this ever returns a
     direction the panel is reporting the structure as if it had been
     counted, which is the convergence finding reintroduced. */
  const out = build([condition("reclaim-50", "סגירה מעל ממוצע 50", false)]);
  assert.equal(out!.swing.direction, "none");
  assert.equal(out!.position.direction, "none");
  assert.equal(out!.swing.agreeing.length, 0);
});

test("a firing condition under MIN_SAMPLE cannot create a direction", () => {
  /* Three out of four is "75%" and is nothing. */
  const thin = { n: MIN_SAMPLE - 1 };
  const out = build([
    condition("golden-cross", "חיתוך זהב", true, { 21: thin, 63: thin }),
  ]);
  assert.equal(out!.swing.direction, "none");
  assert.equal(out!.swing.quiet.length, 0, "too thin to appear at all");
});

test("a lift inside MEANINGFUL_PP lands in quiet, never in agreeing", () => {
  /* Pinned against the exported constant rather than the literal 10, so
     moving the threshold moves the test with it. */
  const narrow = { liftPp: MEANINGFUL_PP - 1, up: 0.56 };
  const out = build([
    condition("high-52w", "סגירה בשיא 52 שבועות", true, { 21: narrow, 63: narrow }),
  ]);
  assert.equal(out!.swing.direction, "none");
  assert.equal(out!.swing.quiet.length, 1);
  assert.equal(out!.swing.agreeing.length, 0);
});

test("two conditions pointing opposite ways are split, not a direction", () => {
  const out = build([
    condition("golden-cross", "חיתוך זהב", true, {
      21: { liftPp: 20, up: 0.75 },
      63: { liftPp: 20, up: 0.75 },
    }),
    condition("lose-50", "סגירה מתחת לממוצע 50", true, {
      21: { liftPp: -20, up: 0.35 },
      63: { liftPp: -20, up: 0.35 },
    }),
  ]);
  assert.equal(out!.swing.direction, "split");
  assert.equal(out!.swing.agreeing.length, 2);
});

test("structure can change neither the direction nor the count", () => {
  /* The convergence measurement, as a test. 17,566 observations put a
     three-family convergence at minus 0.3 points; a structure that can
     nudge a direction is that finding thrown away. */
  const conditions = [
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { liftPp: 18, up: 0.73 },
    }),
  ];
  const bare = build(conditions, null);
  const loaded = build(
    conditions,
    setup(
      [
        observation("trend-above-200", "constructive"),
        observation("level-support", "constructive"),
        observation("volume-thrusting", "constructive"),
        observation("rank-strong", "constructive"),
        observation("contraction-tight", "constructive"),
      ],
      [observation("obv-bearish", "cautionary")],
    ),
  );

  assert.equal(bare!.swing.direction, loaded!.swing.direction);
  assert.equal(bare!.swing.agreeing.length, loaded!.swing.agreeing.length);
  assert.equal(loaded!.swing.structure.length, 6, "shown, but as context");
});

test("structure that duplicates a firing condition is not shown twice", () => {
  /* readSetup pushes every active condition into its own observations
     under the same key, and tape conditions as `tape-<character>`
     against a `<character>-bar` condition. Printing both makes the panel
     look like it has twice the evidence it has. */
  const out = build(
    [
      condition("reclaim-50", "סגירה מעל ממוצע 50", true),
      condition("absorption-bar", "ספיגה", true),
    ],
    setup([
      observation("reclaim-50", "constructive"),
      observation("tape-absorption", "constructive"),
      observation("rank-strong", "constructive"),
    ]),
  );
  assert.deepEqual(
    out!.swing.structure.map((s) => s.key),
    ["rank-strong"],
  );
});

/* ── Rule 9, in a test ────────────────────────────────────────────────── */

test("no field is an average: every number out was a number in", () => {
  const conditions = [
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { n: 34, up: 0.82, liftPp: 24, medianPct: 2.8 },
    }),
    condition("high-52w", "שיא 52 שבועות", true, {
      21: { n: 52, up: 0.68, liftPp: 13, medianPct: 6.2 },
    }),
  ];
  const lastClose = 207.88;
  const out = build(conditions, null, lastClose);

  const allowed = new Set<number>([lastClose, SWING_DAYS, POSITION_DAYS, 2513]);
  for (const c of conditions) {
    allowed.add(c.occurrences);
    for (const o of c.outcomes) {
      for (const v of Object.values(o)) {
        if (typeof v === "number") allowed.add(v);
      }
    }
  }

  const walk = (value: unknown, path: string) => {
    if (typeof value === "number") {
      assert.ok(
        allowed.has(value),
        `${path} = ${value} was not handed to the engine — something is derived`,
      );
      return;
    }
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (value && typeof value === "object") {
      for (const [k, v] of Object.entries(value)) walk(v, `${path}.${k}`);
    }
  };

  walk(out, "stance");
});

test("every rate is carried with its own baseline", () => {
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true),
    condition("high-52w", "שיא 52 שבועות", true),
  ]);
  for (const c of [...out!.swing.agreeing, ...out!.swing.quiet]) {
    assert.equal(typeof c.upShareHist, "number");
    assert.equal(typeof c.baselineUpShare, "number");
    assert.equal(typeof c.baselineMedianPct, "number");
  }
});

test("the adverse median keeps its negative sign all the way out", () => {
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { medianAdversePct: -5.9 },
    }),
  ]);
  assert.equal(out!.swing.agreeing[0].medianAdversePct, -5.9);
});

test("a stored file without the excursion fields reports null, not zero", () => {
  /* Zero would read as "it never went against you", which is the
     opposite of unknown. */
  const bare = outcome(21);
  delete (bare as Partial<Outcome>).medianAdversePct;
  delete (bare as Partial<Outcome>).baselineAdversePct;
  const out = buildChartStance({
    setup: null,
    lastClose: 100,
    baseRates: rates([
      {
        key: "reclaim-50",
        label: "סגירה מעל ממוצע 50",
        activeNow: true,
        occurrences: 44,
        lastAt: null,
        outcomes: [bare, outcome(63)],
      },
    ]),
  });
  assert.equal(out!.swing.agreeing[0].medianAdversePct, null);
  assert.equal(out!.swing.agreeing[0].baselineAdversePct, null);
});

/* ── The two sides ───────────────────────────────────────────────────── */

test("against is never empty while something is firing", () => {
  const out = build([condition("reclaim-50", "סגירה מעל ממוצע 50", true)]);
  assert.ok(out!.swing.agreeing.length > 0);
  assert.ok(out!.swing.against.length > 0, "a panel with no counter-column endorses");
});

test("the adverse path is argued against the direction, with its baseline", () => {
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { medianAdversePct: -3.9, baselineAdversePct: -4.7, worstPct: -22.2 },
    }),
  ]);
  const text = out!.swing.against.join(" ");
  assert.match(text, /-3\.9%/);
  assert.match(text, /-4\.7%/, "the dip is meaningless without its baseline");
  assert.match(text, /-22\.2%/);
});

/* ── Invalidation: events, not states ────────────────────────────────── */

test("a paired condition is invalidated by its opposite event", () => {
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true),
    condition("lose-50", "סגירה מתחת לממוצע 50", false),
  ]);
  assert.match(out!.swing.invalidation.join(" "), /סגירה מתחת לממוצע 50/);
});

test("an unpaired condition says so and falls back to the horizon", () => {
  const out = build([condition("high-52w", "סגירה בשיא 52 שבועות", true)]);
  const text = out!.swing.invalidation.join(" ");
  assert.match(text, /אין אירוע הפוך נמדד/);
  assert.match(text, /תום האופק/);
});

test("a stance is never invalidated by its own condition going inactive", () => {
  /* The category error that was in the first draft. base-rates.ts is
     explicit that a condition is an EVENT and not a STATE: a golden
     cross cannot un-happen, and by the next bar every condition in the
     file is false again. A stance built that way announces its own
     refutation one day after appearing. */
  const out = build([
    condition("golden-cross", "חיתוך זהב", true),
    condition("death-cross", "חיתוך מות", false),
  ]);
  for (const line of out!.swing.invalidation) {
    assert.doesNotMatch(
      line,
      /מפסיק|יפסיק|חדל/,
      `invalidation reads as a state ending: ${line}`,
    );
  }
});

test("the horizon expiry is always present, with the date it was measured on", () => {
  const out = build([condition("reclaim-50", "סגירה מעל ממוצע 50", true)]);
  const text = out!.swing.invalidation.join(" ");
  assert.match(text, /תום האופק/);
  assert.match(text, /2026-10-08/, "a stance that cannot expire is a permanent opinion");
  assert.equal(out!.swing.horizonDays, SWING_DAYS);
  assert.equal(out!.position.horizonDays, POSITION_DAYS);
});

/* ── Horizons are separate measurements ──────────────────────────────── */

test("the quarter stance never reads a month figure", () => {
  /* setup.observations[].record is hard-coded to 21 days. A position
     stance that borrowed it would be a swing stance wearing a quarter's
     label, and nothing would report it. */
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { liftPp: 30, up: 0.85 },
      63: { liftPp: -30, up: 0.25 },
    }),
  ]);
  assert.equal(out!.swing.direction, "up");
  assert.equal(out!.position.direction, "down");
});

/* ── Boundaries ──────────────────────────────────────────────────────── */

test("no base rates means no stance, not a stance over nothing", () => {
  assert.equal(
    buildChartStance({ setup: setup([]), baseRates: null, lastClose: 100 }),
    null,
  );
});

test("buildChartStance is flag-free", () => {
  /* The flag controls display. An engine that read it could not be
     tested without environment manipulation and could behave
     differently in the two builds. */
  const conditions = [condition("reclaim-50", "סגירה מעל ממוצע 50", true)];
  const before = process.env.NEXT_PUBLIC_PRIVATE_MODE;
  try {
    process.env.NEXT_PUBLIC_PRIVATE_MODE = "1";
    const on = JSON.stringify(build(conditions));
    delete process.env.NEXT_PUBLIC_PRIVATE_MODE;
    const off = JSON.stringify(build(conditions));
    assert.equal(on, off);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_PRIVATE_MODE;
    else process.env.NEXT_PUBLIC_PRIVATE_MODE = before;
  }
});

test("isPrivateBuild is off for everything except exactly 1", () => {
  /* The one safety guarantee of the whole design: a missing or mistyped
     variable means public behaviour. */
  const before = process.env.NEXT_PUBLIC_PRIVATE_MODE;
  try {
    for (const value of ["", "true", "yes", "0", "1 ", " 1", "01", "TRUE"]) {
      process.env.NEXT_PUBLIC_PRIVATE_MODE = value;
      assert.equal(isPrivateBuild(), false, `"${value}" must not enable it`);
    }
    delete process.env.NEXT_PUBLIC_PRIVATE_MODE;
    assert.equal(isPrivateBuild(), false, "unset must not enable it");
    process.env.NEXT_PUBLIC_PRIVATE_MODE = "1";
    assert.equal(isPrivateBuild(), true);
  } finally {
    if (before === undefined) delete process.env.NEXT_PUBLIC_PRIVATE_MODE;
    else process.env.NEXT_PUBLIC_PRIVATE_MODE = before;
  }
});

/* ── The prices ──────────────────────────────────────────────────────── */

test("the quantile rows are five, and the dip is one of them", () => {
  /* Five labelled numbers cannot be read as a target; one median can.
     This pins the count so nobody simplifies it back to a single price. */
  const out = build([
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, {
      21: { p25Pct: -2.1, medianPct: 2.8, p75Pct: 7.9, medianAdversePct: -3.9, worstPct: -22.2 },
    }),
  ]);
  const rows = quantileRows(out!.swing.agreeing[0], 200);
  assert.equal(rows.length, 5);
  assert.deepEqual(
    rows.map((r) => r.percent),
    [-2.1, 2.8, 7.9, -3.9, -22.2],
  );
  const emphasised = rows.filter((r) => r.emphasis).map((r) => r.label);
  assert.deepEqual(emphasised, ["הירידה בדרך, חציון", "המקרה הגרוע"]);
});

test("a price is the close times the measured percentage, nothing else", () => {
  const out = build(
    [condition("reclaim-50", "סגירה מעל ממוצע 50", true, { 21: { medianPct: 10 } })],
    null,
    200,
  );
  const median = quantileRows(out!.swing.agreeing[0], 200).find(
    (r) => r.label === "חציון",
  )!;
  /* Within a cent, because the row carries the raw product and the
     renderer is what fixes the decimals. Rounding inside the engine
     would be a derived number, which the rule-9 test above forbids. */
  assert.ok(Math.abs(median.price - 220) < 0.01, `got ${median.price}`);
});

test("the empty state still has a number: the unconditional baseline", () => {
  /* 113 of 123 names today. If the dominant case rendered with nothing
     in it, the panel would read as broken and would get loosened until
     something fired. The baseline is what makes "nothing is firing" an
     answer rather than a blank. */
  const out = build([condition("reclaim-50", "סגירה מעל ממוצע 50", false)]);
  assert.equal(out!.swing.direction, "none");
  assert.equal(out!.swing.baseline!.upShare, 0.55);
  assert.equal(out!.swing.baseline!.medianPct, 1.5);
  assert.equal(out!.swing.baseline!.adversePct, -4);
  assert.equal(out!.position.baseline!.upShare, 0.55);
});

test("the condition turned into prices is the best-sampled one", () => {
  /* Not the widest gap: a nine-occurrence row with a spectacular lift is
     the one most likely to be an artefact of its own window. */
  const out = build([
    condition("golden-cross", "חיתוך זהב", true, { 21: { n: 9, liftPp: 40, up: 0.95 } }),
    condition("reclaim-50", "סגירה מעל ממוצע 50", true, { 21: { n: 70, liftPp: 12, up: 0.67 } }),
  ]);
  assert.equal(out!.swing.bestKey, "reclaim-50");
});
