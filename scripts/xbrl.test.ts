/**
 * The arithmetic every figure on the site stands on.
 *
 * `ttm` is the bottom of the stack. Revenue, margins, free cash flow,
 * EV/EBITDA, ROIC, the sector medians, the screen, the thesis — every one
 * of them is a trailing-twelve-month figure that came out of this
 * function, and almost all of them are wrong together if it is wrong.
 *
 * It also does the single most error-prone thing in the file. Companies
 * file Q1-Q3 on a 10-Q and the full year on a 10-K, so the fourth quarter
 * is never reported: it has to be derived as FY minus the three that were.
 * That derivation involves period boundaries, fiscal years that do not
 * start in January, quarters filed twice under different forms, and
 * restatements — and every one of those failure modes produces a NUMBER
 * rather than an error. A quietly doubled quarter looks exactly like a
 * good year.
 *
 * None of it was tested. These fixtures are built so the right answer is
 * arithmetic rather than opinion.
 *
 *   npx tsx --test scripts/xbrl.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { ttm, latest, CONCEPTS } from "../src/lib/metrics/xbrl";
import type { CompanyFacts, XbrlFact } from "../src/lib/sources/sec";

const TAG = CONCEPTS.REVENUE[0];
const BALANCE_TAG = CONCEPTS.ASSETS[0];

/** A duration fact — an income-statement or cash-flow line. */
function period(
  start: string,
  end: string,
  val: number,
  extra: Partial<XbrlFact> = {},
): XbrlFact {
  return {
    start,
    end,
    val,
    fy: Number(end.slice(0, 4)),
    fp: "Q1",
    form: "10-Q",
    filed: end,
    ...extra,
  };
}

/** An instant fact — a balance-sheet line. */
function instant(end: string, val: number, extra: Partial<XbrlFact> = {}): XbrlFact {
  return { end, val, fy: Number(end.slice(0, 4)), fp: "FY", form: "10-K", filed: end, ...extra };
}

function factsOf(tag: string, rows: XbrlFact[]): CompanyFacts {
  return {
    cik: 1,
    entityName: "Test",
    facts: {
      "us-gaap": {
        [tag]: { label: null, description: null, units: { USD: rows } },
      },
    },
  };
}

/* ------------------------------------------------------------------ */

test("four reported quarters sum to the trailing twelve months", () => {
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", 110),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-10-01", "2025-12-31", 130),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 460);
  assert.equal(read.end, "2025-12-31", "dated by the newest quarter it used");
});

test("the fourth quarter is derived as the year minus the three that were filed", () => {
  /* The real shape of an SEC filing: three quarters and an annual, and no
     Q4 anywhere. 500 − (100 + 110 + 120) = 170. */
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", 110),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-01-01", "2025-12-31", 500, { fp: "FY", form: "10-K" }),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 500, "the four quarters must reconstruct the year");
});

test("a fiscal year that does not start in January still derives its missing quarter", () => {
  /* An October year-end, which is Apple's shape and several others'. */
  const f = factsOf(TAG, [
    period("2024-10-01", "2024-12-31", 200),
    period("2025-01-01", "2025-03-31", 150),
    period("2025-04-01", "2025-06-30", 160),
    period("2024-10-01", "2025-09-30", 700, { fp: "FY", form: "10-K" }),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 700);
});

test("overlapping periods are never both counted", () => {
  /* A half-year filed alongside the quarters inside it. Summing all of
     them would report 140% of the real revenue, and it would look like
     growth. */
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", 110),
    period("2025-01-01", "2025-06-30", 210, { fp: "Q2" }),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-10-01", "2025-12-31", 130),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 460, "the half-year must not be added to its own halves");
});

test("the same quarter filed twice is counted once", () => {
  /* A 10-Q and a later 10-K/A both carrying Q1. The amended value is the
     one that should survive, and it must not be added to the original. */
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100, { form: "10-Q" }),
    period("2025-01-01", "2025-03-31", 105, { form: "10-K", filed: "2026-02-01" }),
    period("2025-04-01", "2025-06-30", 110),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-10-01", "2025-12-31", 130),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.ok(
    read.value === 465 || read.value === 460,
    `one Q1 only — got ${read.value}, which means it was counted twice`,
  );
});

test("with fewer than four quarters it falls back to the annual, not to a partial sum", () => {
  /* Two quarters and a year. Reporting 210 would be a half-year presented
     as a trailing twelve months — the exact failure the fallback exists
     to prevent. */
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", 110),
    period("2024-01-01", "2024-12-31", 400, { fp: "FY", form: "10-K" }),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 400, "the stale annual beats a partial sum");
});

test("no usable facts is null, never zero", () => {
  assert.equal(ttm(factsOf(TAG, []), CONCEPTS.REVENUE), null);
  /* Zero would flow through every ratio as a real figure — a margin of
     0%, an EV/EBITDA of infinity — and nothing downstream would know it
     was an absence rather than a measurement. */
});

test("a loss-making quarter is summed, not discarded", () => {
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", -40),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-10-01", "2025-12-31", 130),
  ]);
  assert.equal(ttm(f, CONCEPTS.REVENUE)?.value, 310);
});

test("the trailing window moves with the newest quarter", () => {
  /* Five quarters on file. The oldest must drop out, not be included. */
  const f = factsOf(TAG, [
    period("2024-10-01", "2024-12-31", 999),
    period("2025-01-01", "2025-03-31", 100),
    period("2025-04-01", "2025-06-30", 110),
    period("2025-07-01", "2025-09-30", 120),
    period("2025-10-01", "2025-12-31", 130),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.value, 460, "the fifth quarter back must fall out of the window");
});

/* ---- latest -------------------------------------------------------- */

test("a balance-sheet figure takes the most recent instant", () => {
  const f = factsOf(BALANCE_TAG, [
    instant("2024-12-31", 1000),
    instant("2025-06-30", 1200),
    instant("2025-03-31", 1100),
  ]);
  const read = latest(f, CONCEPTS.ASSETS);
  assert.ok(read);
  assert.equal(read.value, 1200, "newest by date, not by file order");
  assert.equal(read.end, "2025-06-30");
});

test("a missing balance-sheet concept is null", () => {
  assert.equal(latest(factsOf(BALANCE_TAG, []), CONCEPTS.ASSETS), null);
});

test("every figure carries the date it was filed", () => {
  const f = factsOf(TAG, [
    period("2025-01-01", "2025-03-31", 100, { filed: "2025-04-20" }),
    period("2025-04-01", "2025-06-30", 110, { filed: "2025-07-20" }),
    period("2025-07-01", "2025-09-30", 120, { filed: "2025-10-20" }),
    period("2025-10-01", "2025-12-31", 130, { filed: "2026-01-20" }),
  ]);
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(
    read.filed,
    "2026-01-20",
    "SEC data lags and a figure without its filing date is misleading",
  );
});

/* ── Banks file a different top line ──────────────────────────────────── */

/**
 * A bank does not report "revenue".
 *
 * It reports interest income, interest expense, and the net of the two
 * plus fees — `RevenuesNetOfInterestExpense`. That tag was missing from
 * the candidate list for the life of the project, and the cost was not a
 * missing metric but a wrong date: with nothing current to merge, the
 * reader fell back to whatever legacy tag the company last touched and
 * reported it as the latest filing. Measured against SEC's own data:
 * MS came back as 2018-03-31 from a single stray contract-revenue fact,
 * WFC as 2020-09-30, JPM as 2014-12-31 — while all three were filing
 * through 2026-06-30 under the tag nobody had asked for.
 *
 * The site said "this reading rests on an old report", which was honest
 * and still wrong: there was a new one.
 */
function twoTags(
  a: { tag: string; rows: XbrlFact[] },
  b: { tag: string; rows: XbrlFact[] },
): CompanyFacts {
  return {
    cik: 1,
    entityName: "Bank",
    facts: {
      "us-gaap": {
        [a.tag]: { label: null, description: null, units: { USD: a.rows } },
        [b.tag]: { label: null, description: null, units: { USD: b.rows } },
      },
    },
  };
}

test("a bank's net-of-interest line is read, not its abandoned legacy tag", () => {
  const f = twoTags(
    /* One stray fact from years ago, exactly as Morgan Stanley carries. */
    { tag: "RevenueFromContractWithCustomerExcludingAssessedTax", rows: [
      period("2018-01-01", "2018-03-31", 9),
    ] },
    { tag: "RevenuesNetOfInterestExpense", rows: [
      period("2025-10-01", "2025-12-31", 100),
      period("2026-01-01", "2026-03-31", 110),
      period("2026-04-01", "2026-06-30", 120),
      period("2025-07-01", "2025-09-30", 90),
    ] },
  );
  const read = ttm(f, CONCEPTS.REVENUE);
  assert.ok(read);
  assert.equal(read.end, "2026-06-30", "the stale tag must not date the read");
  assert.equal(read.value, 420);
});

test("the component tags are deliberately not candidates", () => {
  /* `InterestIncomeExpenseNet` and `InterestAndDividendIncomeOperating`
     are parts of the same line. Merged with the total they would give two
     different values for one period, and `preferred` would resolve that
     by filing date — returning whichever happened to be restated last. */
  for (const component of [
    "InterestIncomeExpenseNet",
    "InterestAndDividendIncomeOperating",
  ]) {
    assert.ok(
      !CONCEPTS.REVENUE.includes(component),
      `${component} is a component of the top line, not the top line`,
    );
  }
  assert.ok(CONCEPTS.REVENUE.includes("RevenuesNetOfInterestExpense"));
});
