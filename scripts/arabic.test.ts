/**
 * Arabic must not reach a Hebrew page.
 *
 * It did. The daily brief carried "ירידות בשוקי الأسهم" as its headline,
 * and a news reading said "תשעה מתוך أحد עשר סקטורים" — and worse than
 * either, single Arabic letters sat inside Hebrew words where nothing
 * looks wrong until it is read: "היقף" for "היקף", "סולلריות" for
 * "סולאריות". Fourteen per cent of the stored article readings were
 * affected.
 *
 * Hebrew and Arabic are both right-to-left Semitic scripts and a
 * multilingual model's token space runs them together, so this is drift
 * that will recur rather than a one-off. The guard belongs in the client
 * every answer passes through, and this pins it.
 *
 *   npx tsx --test scripts/arabic.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { containsArabic } from "../src/lib/sources/gemini";

test("ordinary Hebrew passes", () => {
  assert.equal(containsArabic("ירידות בשוקי המניות וביקושי ענק לשבבי AI"), false);
  assert.equal(containsArabic("תשעה מתוך אחד עשר סקטורים בשוק ירדו ביום רביעי"), false);
});

test("Hebrew mixed with Latin, digits and punctuation passes", () => {
  assert.equal(
    containsArabic("S&P 500 יורד ל-777.38 ו-Nasdaq 100 נחלש ל-756.67 — סקטור השבבים"),
    false,
  );
  assert.equal(containsArabic("P/E 42.1 מול חציון 31.4 בסקטור · EV/EBITDA"), false);
});

test("the words that actually shipped are caught", () => {
  assert.equal(containsArabic("ירידות בשוקי الأسهم וביקושי ענק"), true);
  assert.equal(containsArabic("תשעה מתוך أحد עשר סקטורים"), true);
});

test("a single Arabic letter inside a Hebrew word is caught", () => {
  /* The dangerous case: it renders as a Hebrew word and reads as one at a
     glance, so nothing but a character check finds it. */
  assert.equal(containsArabic("היقף הביקוש העתידי"), true);
  assert.equal(containsArabic("חברות סולلריות עשויות להרוויח"), true);
});

test("the presentation-form block is covered too", () => {
  /* A ligature from FB50-FEFF renders the same as the letter and would
     slip past a check that only covered 0600-06FF. */
  assert.equal(containsArabic("מילה ﻵ בעברית"), true);
  assert.equal(containsArabic("מילה ﭒ בעברית"), true);
});

test("an empty string is not Arabic", () => {
  assert.equal(containsArabic(""), false);
});
