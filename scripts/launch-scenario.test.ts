import assert from "node:assert/strict";
import { test } from "node:test";
import { launchScenario } from "../src/lib/launch-scenario";

test("distribution fees are removed from sales, not from a made-up profit", () => {
  const result = launchScenario(25, 70, 30);
  assert.equal(result.gross, 1_750_000_000);
  assert.equal(result.platform, 525_000_000);
  assert.equal(result.publisher, 1_225_000_000);
  assert.equal(result.platform + result.publisher, result.gross);
});

test("sales, price, and distribution fees have the expected sensitivity", () => {
  const base = launchScenario(25, 70, 30);
  assert.equal(launchScenario(50, 70, 30).publisher, base.publisher * 2);
  assert.equal(launchScenario(25, 140, 30).publisher, base.publisher * 2);
  assert.ok(launchScenario(25, 70, 35).publisher < base.publisher);
  assert.equal(launchScenario(0, 70, 30).publisher, 0);
  assert.equal(launchScenario(25, 70, 100).publisher, 0);
});
