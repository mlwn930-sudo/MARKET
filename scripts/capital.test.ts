/**
 * The capital arithmetic, where a sign error does the most damage.
 *
 * `costOfCapital` decides whether the site tells a reader that a business
 * creates value or destroys it. It is built out of four assumptions and
 * three measurements, and the one thing that cannot be allowed to be
 * wrong is the direction: a flipped sign on the spread would have the page
 * calling the best compounders value-destroyers and saying so in full
 * sentences, confidently, on every company.
 *
 * `cashConversionCycle` has the same property in miniature. Payables are
 * SUBTRACTED — a company that takes longer to pay its suppliers finances
 * itself with their money and its cycle gets shorter, which is the whole
 * point of the measure and is exactly the term somebody would eventually
 * "fix" by adding it.
 *
 * These are tested against hand-computed answers rather than against the
 * code's own output, so the test fails when the code changes meaning
 * rather than merely when it changes.
 *
 *   npx tsx --test scripts/capital.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import {
  ASSUMED_RISK_FREE,
  EQUITY_RISK_PREMIUM,
  cashConversionCycle,
  costOfCapital,
} from "../src/lib/metrics/capital";
import { CONCEPTS } from "../src/lib/metrics/xbrl";
import type { FinancialBase } from "../src/lib/metrics/fundamentals";
import type { CompanyFacts, XbrlFact } from "../src/lib/sources/sec";

const BASE: FinancialBase = {
  revenue: 1000,
  cost: 600,
  operating: 250,
  netIncome: 200,
  operatingCashFlow: 300,
  capex: -50,
  fcf: 250,
  ebitda: 300,
  interest: 20,
  effectiveTaxRate: 0.21,
  taxRateIsAssumed: false,
  nopat: 198,
  investedCapital: 1000,
  totalDebt: 400,
  cash: 100,
  netDebt: 300,
  equity: 600,
  enterpriseValue: 1900,
  marketCap: 1600,
  roic: 19.8,
};

const base = (over: Partial<FinancialBase> = {}): FinancialBase => ({ ...BASE, ...over });

/* ---- Cost of capital ---------------------------------------------- */

test("cost of equity is the risk-free rate plus beta times the premium", () => {
  const read = costOfCapital(base(), 1.2, 0.04);
  assert.ok(read.costOfEquity !== null);
  assert.ok(
    Math.abs(read.costOfEquity - (0.04 + 1.2 * EQUITY_RISK_PREMIUM)) < 1e-12,
    `got ${read.costOfEquity}`,
  );
});

test("a missing risk-free rate is the stated assumption, and it is declared", () => {
  const read = costOfCapital(base(), 1, null);
  assert.equal(read.riskFree, ASSUMED_RISK_FREE);
  assert.equal(read.riskFreeIsAssumed, true);
  assert.ok(
    read.assumptions.some((a) => a.includes("הנחה")),
    "an assumed input must be printed beside the result",
  );
});

test("beta is clamped to a sane range, and the clamping is disclosed", () => {
  const wild = costOfCapital(base(), 9, 0.04);
  assert.ok(wild.beta !== null && wild.beta <= 2.5);
  assert.equal(wild.betaWasClamped, true);
  assert.ok(wild.assumptions.some((a) => a.includes("הוגבל")));

  const ordinary = costOfCapital(base(), 1.1, 0.04);
  assert.equal(ordinary.betaWasClamped, false);
});

test("the debt cost is after tax, and it is lower than the gross cost", () => {
  /* Interest 20 on debt 400 is 5% gross; at a 21% rate that is 3.95%. */
  const read = costOfCapital(base(), 1, 0.04);
  assert.ok(read.costOfDebtAfterTax !== null);
  assert.ok(
    Math.abs(read.costOfDebtAfterTax - 0.05 * (1 - 0.21)) < 1e-12,
    `got ${read.costOfDebtAfterTax}`,
  );
});

test("interest reported as a negative number is still a cost", () => {
  /* Filings carry interest expense both ways. Taking the sign literally
     would produce a NEGATIVE cost of debt, which lowers the WACC and
     turns a leveraged company into a value creator. */
  const positive = costOfCapital(base({ interest: 20 }), 1, 0.04);
  const negative = costOfCapital(base({ interest: -20 }), 1, 0.04);
  assert.equal(positive.costOfDebtAfterTax, negative.costOfDebtAfterTax);
  assert.ok((negative.costOfDebtAfterTax ?? -1) > 0);
});

test("the weights are the capital structure and they sum to one", () => {
  const read = costOfCapital(base(), 1, 0.04);
  assert.ok(read.equityWeight !== null && read.debtWeight !== null);
  assert.ok(Math.abs(read.equityWeight + read.debtWeight - 1) < 1e-12);
  /* 1600 of equity against 400 of debt. */
  assert.ok(Math.abs(read.equityWeight - 0.8) < 1e-12);
});

test("the WACC is the weighted average it claims to be", () => {
  const read = costOfCapital(base(), 1.2, 0.04);
  const ke = 0.04 + 1.2 * EQUITY_RISK_PREMIUM;
  const kd = 0.05 * (1 - 0.21);
  assert.ok(read.wacc !== null);
  assert.ok(Math.abs(read.wacc - (ke * 0.8 + kd * 0.2)) < 1e-12, `got ${read.wacc}`);
});

test("the spread points the right way, which is the whole verdict", () => {
  /* ROIC far above any plausible WACC. If the sign ever flips, this is
     the test that says so before a reader is told that a 40% compounder
     destroys value. */
  const good = costOfCapital(base({ roic: 40 }), 1, 0.04);
  assert.ok((good.spread ?? 0) > 0);
  assert.equal(good.verdict, "creates");

  const bad = costOfCapital(base({ roic: 1 }), 1, 0.04);
  assert.ok((bad.spread ?? 0) < 0);
  assert.equal(bad.verdict, "destroys");
});

test("a spread inside the error of the assumptions is called marginal", () => {
  /* The WACC here is 4% + 1.0 x 5% = 9% on equity, 3.95% on debt,
     weighted 0.8/0.2 = 7.99%. A ROIC of 8% is not a finding. */
  const read = costOfCapital(base({ roic: 8 }), 1, 0.04);
  assert.equal(read.verdict, "marginal");
  assert.ok(Math.abs(read.spread ?? 99) <= 2);
});

test("no beta means no verdict rather than a guessed one", () => {
  const read = costOfCapital(base(), null, 0.04);
  assert.equal(read.costOfEquity, null);
  assert.equal(read.wacc, null);
  assert.equal(read.spread, null);
  assert.equal(read.verdict, null);
});

test("every assumption behind the number is printed with it", () => {
  const read = costOfCapital(base(), 1.1, null);
  assert.equal(read.assumptions.length, 4, "risk-free, premium, beta, tax");
  assert.ok(read.assumptions.every((a) => a.length > 0));
});

/* ---- Cash conversion cycle ----------------------------------------- */

function balanceFacts(values: Record<string, number>): CompanyFacts {
  const units: Record<string, { label: null; description: null; units: Record<string, XbrlFact[]> }> = {};
  for (const [tag, val] of Object.entries(values)) {
    units[tag] = {
      label: null,
      description: null,
      units: {
        USD: [{ end: "2025-12-31", val, fy: 2025, fp: "FY", form: "10-K", filed: "2026-02-01" }],
      },
    };
  }
  return { cik: 1, entityName: "Test", facts: { "us-gaap": units } };
}

test("the cycle is receivables plus inventory minus payables", () => {
  /* Revenue 1000, cost 600, all over 365 days.
       DSO = 100/1000 x 365 = 36.5
       DIO = 120/600  x 365 = 73
       DPO = 150/600  x 365 = 91.25
       cycle = 36.5 + 73 - 91.25 = 18.25 */
  const facts = balanceFacts({
    [CONCEPTS.RECEIVABLES[0]]: 100,
    [CONCEPTS.INVENTORY[0]]: 120,
    [CONCEPTS.PAYABLES[0]]: 150,
  });
  const read = cashConversionCycle(facts, base());
  assert.ok(read.cycle !== null);
  assert.ok(Math.abs(read.cycle - 18.25) < 0.01, `got ${read.cycle}`);
});

test("paying suppliers later SHORTENS the cycle", () => {
  /* The sign that would eventually be "corrected" by somebody who thought
     it was a bug. A company financing itself with its suppliers' money
     has a shorter cycle, and that is the entire point of the measure. */
  const quick = balanceFacts({
    [CONCEPTS.RECEIVABLES[0]]: 100,
    [CONCEPTS.INVENTORY[0]]: 120,
    [CONCEPTS.PAYABLES[0]]: 50,
  });
  const slow = balanceFacts({
    [CONCEPTS.RECEIVABLES[0]]: 100,
    [CONCEPTS.INVENTORY[0]]: 120,
    [CONCEPTS.PAYABLES[0]]: 300,
  });
  const a = cashConversionCycle(quick, base()).cycle!;
  const b = cashConversionCycle(slow, base()).cycle!;
  assert.ok(b < a, `paying later must shorten the cycle: ${b} should be under ${a}`);
});

test("a negative cycle is a real answer, not an error", () => {
  /* The retailer shape: sells for cash, pays suppliers much later. */
  const facts = balanceFacts({
    [CONCEPTS.RECEIVABLES[0]]: 10,
    [CONCEPTS.INVENTORY[0]]: 50,
    [CONCEPTS.PAYABLES[0]]: 400,
  });
  const read = cashConversionCycle(facts, base());
  assert.ok(read.cycle !== null && read.cycle < 0);
});

test("a company with no inventory still has a cycle", () => {
  /* Software: receivables and payables, no stock on a shelf. Treating the
     missing inventory as unmeasurable would delete the cycle for an entire
     sector. */
  const facts = balanceFacts({
    [CONCEPTS.RECEIVABLES[0]]: 200,
    [CONCEPTS.PAYABLES[0]]: 100,
  });
  const read = cashConversionCycle(facts, base());
  assert.ok(read.cycle !== null, "no inventory is zero days of it, not an absence");
});

test("without receivables there is no cycle to report", () => {
  const read = cashConversionCycle(balanceFacts({}), base());
  assert.equal(read.cycle, null);
});
