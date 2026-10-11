/**
 * What changed between two daily scans.
 *
 * The scan itself is largely the same twenty-one names every morning,
 * so the difference is the only part worth opening the page for. These
 * pin the one case that is easy to get wrong and impossible to notice:
 * running the build twice in a session. A naive diff compares today
 * against today, reports nothing changed, and erases a morning in which
 * four names turned — and it erases it silently, on a page whose whole
 * job is to say what moved.
 *
 *   npx tsx --test scripts/scan-diff.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { compareScans, directionsOf } from "../src/lib/signals/scan-diff";
import type { PriorScan, ScanRowLike } from "../src/lib/signals/scan-diff";

const row = (symbol: string, ...dirs: string[]): ScanRowLike => ({
  symbol,
  horizons: dirs.map((d) => {
    const [horizon, direction] = d.split(":");
    return { horizon, direction };
  }),
});

const prior = (asOf: string, names: ScanRowLike[], extra: PriorScan = {}): PriorScan => ({
  asOf,
  names,
  ...extra,
});

/* ── The ordinary case ───────────────────────────────────────────────── */

test("a name present today and not yesterday has entered", () => {
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("AAPL", "swing:up"), row("DE", "swing:down")] },
    prior("2026-10-08", [row("AAPL", "swing:up")]),
  );
  assert.equal(out.previousAsOf, "2026-10-08");
  assert.deepEqual(out.entered, ["DE"]);
  assert.deepEqual(out.left, []);
  assert.deepEqual(out.flipped, []);
});

test("a name present yesterday and not today has left", () => {
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("AAPL", "swing:up")] },
    prior("2026-10-08", [row("AAPL", "swing:up"), row("DE", "swing:down")]),
  );
  assert.deepEqual(out.left, ["DE"]);
  assert.deepEqual(out.entered, []);
});

test("a changed direction is a flip, with both sides", () => {
  /* The one a holder cares about most: not a new ticker, but one
     already being watched that turned. */
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("LRCX", "swing:down")] },
    prior("2026-10-08", [row("LRCX", "swing:up")]),
  );
  assert.deepEqual(out.flipped, [
    { symbol: "LRCX", from: "swing:up", to: "swing:down" },
  ]);
  assert.deepEqual(out.entered, []);
  assert.deepEqual(out.left, []);
});

test("gaining a second horizon counts as a flip, not as entering", () => {
  /* The name was already on the list. What changed is that the quarter
     now agrees with the month, which is a bigger fact than either. */
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("DE", "swing:down", "position:down")] },
    prior("2026-10-08", [row("DE", "swing:down")]),
  );
  assert.equal(out.entered.length, 0);
  assert.equal(out.flipped.length, 1);
  assert.equal(out.flipped[0].to, "position:down,swing:down");
});

/* ── The case that erases a morning ──────────────────────────────────── */

test("a second run in the same session keeps the earlier comparison", () => {
  /* Re-running the build on the same day must not compare today against
     today. Without this the page shows "nothing changed" on a day when
     four names turned, and nothing reports the loss. */
  const today = { asOf: "2026-10-09", names: [row("AAPL", "swing:up")] };
  const alreadyWritten = prior("2026-10-09", [row("AAPL", "swing:up")], {
    previousAsOf: "2026-10-08",
    entered: ["AAPL"],
    left: ["NVDA"],
    flipped: [{ symbol: "DE", from: "swing:up", to: "swing:down" }],
  });

  const out = compareScans(today, alreadyWritten);
  assert.equal(out.previousAsOf, "2026-10-08", "the basis must not become today");
  assert.deepEqual(out.entered, ["AAPL"]);
  assert.deepEqual(out.left, ["NVDA"]);
  assert.equal(out.flipped[0].symbol, "DE");
});

test("a same-session re-run before any comparison existed stays empty", () => {
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("AAPL", "swing:up")] },
    prior("2026-10-09", [row("AAPL", "swing:up")]),
  );
  assert.equal(out.previousAsOf, null);
  assert.deepEqual(out.entered, []);
});

/* ── Boundaries ──────────────────────────────────────────────────────── */

test("no previous scan is null, never an empty comparison", () => {
  /* Three empty lists read as "nothing moved", which is a claim. A null
     basis lets the page say the comparison does not exist yet. */
  for (const bad of [null, {}, { asOf: "2026-10-08" }, { names: [] }]) {
    const out = compareScans({ asOf: "2026-10-09", names: [] }, bad as PriorScan);
    assert.equal(out.previousAsOf, null);
  }
});

test("the horizon order in the file cannot register as a change", () => {
  /* The scan writes horizons in whatever order the stance produced
     them. Sorting inside directionsOf is what stops a reordering from
     being reported as a flip every single day. */
  assert.equal(
    directionsOf(row("X", "swing:up", "position:down")),
    directionsOf(row("X", "position:down", "swing:up")),
  );
  const out = compareScans(
    { asOf: "2026-10-09", names: [row("X", "position:down", "swing:up")] },
    prior("2026-10-08", [row("X", "swing:up", "position:down")]),
  );
  assert.deepEqual(out.flipped, []);
});

test("entered and left are sorted, so the page is stable between runs", () => {
  const out = compareScans(
    {
      asOf: "2026-10-09",
      names: [row("ZS", "swing:up"), row("AMD", "swing:up"), row("MU", "swing:up")],
    },
    prior("2026-10-08", []),
  );
  assert.deepEqual(out.entered, ["AMD", "MU", "ZS"]);
});
