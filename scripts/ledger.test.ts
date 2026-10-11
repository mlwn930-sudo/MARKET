/**
 * The site measures everything except itself. This is the fix, pinned.
 *
 * Every number on this site carries a baseline, a sample and a caveat,
 * and not one of them was ever applied to a stance the site actually
 * took. The ledger records each one when it is given and scores it when
 * the horizon expires — and the ways that can go quietly wrong are all
 * here, because a scorecard nobody can trust is worse than none: it
 * would be the one number on the site with no measurement behind it.
 *
 *   npx tsx --test scripts/ledger.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  recordStances,
  resolveEntries,
  scoreLedger,
} from "../src/lib/signals/ledger";
import type { LedgerEntry, StanceToRecord } from "../src/lib/signals/ledger";
import { MIN_SAMPLE } from "../src/lib/metrics/base-rates";

const stance = (over: Partial<StanceToRecord> = {}): StanceToRecord => ({
  symbol: "AAA",
  asOf: "2026-10-01",
  horizon: "swing",
  horizonDays: 21,
  direction: "up",
  closeAt: 100,
  leadKey: "reclaim-50",
  leadLabel: "סגירה מעל ממוצע 50",
  leadN: 34,
  upShareHist: 0.8,
  baselineUpShare: 0.58,
  ...over,
});

/** A straight line of sessions, so the trading-day arithmetic is
 *  checkable by eye. */
const closes = (n: number, from = 100, step = 1) =>
  Array.from({ length: n }, (_, i) => ({
    date: `2026-10-${String(i + 1).padStart(2, "0")}`,
    close: from + i * step,
  }));

/* ── Recording ───────────────────────────────────────────────────────── */

test("a stance is recorded once, however often the build runs", () => {
  /* Conditions are events, so a stance does not normally repeat. The
     guard is for a second run in a session, which would otherwise
     double every total that follows and never say so. */
  const one = recordStances([], [stance()]);
  const twice = recordStances(one, [stance()]);
  assert.equal(one.length, 1);
  assert.equal(twice.length, 1);
});

test("the same name on two horizons is two stances", () => {
  const out = recordStances([], [
    stance({ horizon: "swing", horizonDays: 21 }),
    stance({ horizon: "position", horizonDays: 63 }),
  ]);
  assert.equal(out.length, 2);
});

test("the same name on a later session is a new stance", () => {
  const out = recordStances([stance() as LedgerEntry], [
    stance({ asOf: "2026-11-02" }),
  ]);
  assert.equal(out.length, 2);
});

/* ── Resolving ───────────────────────────────────────────────────────── */

test("the horizon is counted in trading days, not calendar days", () => {
  /* The base rates counted sessions. Resolving on a calendar offset
     would score a 21-session claim after however many sessions
     happened to fall in 21 days, and the error would never surface —
     the number would just be slightly wrong forever. */
  const series = closes(30); // 100, 101, ... one per session
  const { entries, resolved } = resolveEntries(
    [stance({ asOf: "2026-10-01", closeAt: 100, horizonDays: 21 }) as LedgerEntry],
    () => series,
  );
  assert.equal(resolved, 1);
  /* Index 0 is 2026-10-01; index 21 is the 22nd session. */
  assert.equal(entries[0].resolvedAt, "2026-10-22");
  assert.equal(entries[0].closeThen, 121);
  assert.ok(Math.abs(entries[0].movePct! - 21) < 1e-9);
  assert.equal(entries[0].agreed, true);
});

test("a horizon that has not elapsed stays open", () => {
  const { entries, resolved } = resolveEntries(
    [stance({ horizonDays: 63 }) as LedgerEntry],
    () => closes(30),
  );
  assert.equal(resolved, 0);
  assert.equal(entries[0].resolvedAt, undefined);
});

test("a down stance is right when the price falls", () => {
  const { entries } = resolveEntries(
    [
      stance({
        direction: "down",
        asOf: "2026-10-01",
        closeAt: 100,
        horizonDays: 5,
      }) as LedgerEntry,
    ],
    () => closes(10, 100, -2),
  );
  assert.equal(entries[0].movePct, -10);
  assert.equal(entries[0].agreed, true);
});

test("a split stance is never scored, because it claims nothing", () => {
  /* It says the measurements contradict each other. Counting it as a
     miss would punish the engine for being honest. */
  const { entries } = resolveEntries(
    [stance({ direction: "split", horizonDays: 5 }) as LedgerEntry],
    () => closes(10),
  );
  assert.ok(entries[0].resolvedAt);
  assert.equal(entries[0].agreed, null);
});

test("an already resolved entry is never rescored", () => {
  const done = {
    ...(stance({ horizonDays: 5 }) as LedgerEntry),
    resolvedAt: "2026-10-06",
    closeThen: 999,
    movePct: 1,
    agreed: true,
  };
  const { entries, resolved } = resolveEntries([done], () => closes(10, 50, -5));
  assert.equal(resolved, 0);
  assert.equal(entries[0].closeThen, 999, "history does not get rewritten");
});

test("a symbol with no candles is left open rather than dropped", () => {
  const { entries } = resolveEntries(
    [stance({ horizonDays: 5 }) as LedgerEntry],
    () => null,
  );
  assert.equal(entries.length, 1);
  assert.equal(entries[0].resolvedAt, undefined);
});

/* ── Scoring ─────────────────────────────────────────────────────────── */

const resolvedRow = (agreed: boolean, over: Partial<LedgerEntry> = {}): LedgerEntry => ({
  ...(stance() as LedgerEntry),
  resolvedAt: "2026-11-01",
  closeThen: agreed ? 110 : 90,
  movePct: agreed ? 10 : -10,
  agreed,
  ...over,
});

test("below MIN_SAMPLE there is no share at all, only the count", () => {
  /* The first useful reading is months away. Printing 100% from two
     rows would be the one number on this site with nothing behind it. */
  const score = scoreLedger([resolvedRow(true), resolvedRow(true)]);
  assert.equal(score.agreedShare, null);
  assert.equal(score.resolved, 2);
  assert.match(score.verdict, new RegExp(String(MIN_SAMPLE)));
});

test("at MIN_SAMPLE the three shares appear together", () => {
  const rows = [
    ...Array.from({ length: 6 }, () => resolvedRow(true)),
    ...Array.from({ length: 2 }, () => resolvedRow(false)),
  ];
  const score = scoreLedger(rows);
  assert.equal(rows.length, MIN_SAMPLE);
  /* Floating point: a mean of eight copies of 0.8 is not 0.8. The
     tolerance is on the test, not on the engine — rounding inside
     `scoreLedger` would make a derived number out of a measured one. */
  const near = (got: number | null, want: number, what: string) =>
    assert.ok(got !== null && Math.abs(got - want) < 1e-9, `${what}: got ${got}`);
  near(score.agreedShare, 0.75, "the share that moved the right way");
  near(score.claimedShare, 0.8, "what the record promised");
  near(score.baselineShare, 0.58, "what an arbitrary day gave");
  assert.match(score.verdict, /75%/);
  assert.match(score.verdict, /80%/);
  assert.match(score.verdict, /58%/);
});

test("a bearish stance's claim is the complement of its up-rate", () => {
  /* Without the flip the engine's own prediction is scored upside down
     for every bearish row: a condition followed by a fall 80% of the
     time would be recorded as having promised a 20% chance of being
     right. */
  const rows = Array.from({ length: MIN_SAMPLE }, () =>
    resolvedRow(true, { direction: "down", upShareHist: 0.2, baselineUpShare: 0.42 }),
  );
  const score = scoreLedger(rows);
  assert.ok(Math.abs(score.claimedShare! - 0.8) < 1e-9);
  assert.ok(Math.abs(score.baselineShare! - 0.58) < 1e-9);
});

test("open and unscoreable are counted apart from the sample", () => {
  /* A scorecard that silently drops the stances still running is one
     that can be made to look good by waiting. */
  const rows = [
    ...Array.from({ length: MIN_SAMPLE }, () => resolvedRow(true)),
    stance({ asOf: "2026-12-01" }) as LedgerEntry,
    { ...resolvedRow(true), direction: "split" as const, agreed: null },
  ];
  const score = scoreLedger(rows);
  assert.equal(score.open, 1);
  assert.equal(score.unscoreable, 1);
  assert.equal(score.agreedShare, 1, "the split row is not in the sample");
  assert.match(score.verdict, /1 עדיין פתוחות/);
});

test("an empty ledger says so instead of dividing by zero", () => {
  const score = scoreLedger([]);
  assert.equal(score.resolved, 0);
  assert.equal(score.open, 0);
  assert.equal(score.agreedShare, null);
});
