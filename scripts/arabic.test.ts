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
import fs from "node:fs";
import { containsArabic, containsGluedLatin } from "../src/lib/sources/gemini";

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

test("the guard is applied on all three paths the site generates text on", () => {
  /* It took three separate discoveries to cover them, each one found in
     production rather than in review:
       generateText      the shared client, found on the daily brief
       summarize-news    plain Node with its own fetch, found on the
                         watchlist page an hour after the first fix
       streamText        the chat and the chart question, found in the
                         first answer the chart agent ever streamed
     This pins the list so a fourth path is a failing test rather than a
     sentence somebody reads in an inbox. */
  const sources = [
    fs.readFileSync("src/lib/sources/gemini.ts", "utf8"),
    fs.readFileSync("scripts/summarize-news.mjs", "utf8"),
  ];
  const generate = sources[0].slice(sources[0].indexOf("export async function generateText"));
  const stream = sources[0].slice(sources[0].indexOf("export async function* streamText"));
  assert.ok(/containsArabic/.test(generate), "generateText must check");
  assert.ok(/containsArabic/.test(stream), "streamText must check");
  assert.ok(
    /0x0600/.test(sources[1]),
    "summarize-news.mjs must check, it has no access to the shared client",
  );
});

/* ── A Latin letter welded into a Hebrew word ─────────────────────────── */

/**
 * The same drift, one script over, found the same way.
 *
 * The chart agent answered "ומקיj" where it meant "ומקיים". A Latin j
 * inside a Hebrew word is the Arabic problem in a different alphabet: it
 * reads as a smudge rather than as an error, and it sits in a sentence
 * carrying measured figures.
 *
 * The pattern was measured over every Hebrew string in `content/` and
 * `src/` before it was trusted — zero matches — which is what makes
 * rejecting on it safe rather than a source of silently discarded
 * answers. These tests pin both halves: the glitches are caught and the
 * ordinary mixed-script writing this site does constantly is not.
 */
test("ordinary Hebrew-with-Latin writing passes", () => {
  assert.equal(containsGluedLatin("המחיר מתחת ל-POC ומעל אזור הערך"), false);
  assert.equal(containsGluedLatin("P/E 42.1 מול חציון 31.4 בסקטור"), false);
  assert.equal(containsGluedLatin("כוח יחסי 11 מתוך 99 · S&P 500 · EV/EBITDA"), false);
  assert.equal(containsGluedLatin("ביקושי ענק לשבבי AI, ו-Nasdaq נחלש"), false);
  assert.equal(containsGluedLatin("חיתוך מות של הממוצעים (death cross)"), false);
});

test("the word that actually shipped is caught", () => {
  assert.equal(containsGluedLatin("ומקיj את תנאי חיתוך המות"), true);
});

test("a Latin letter on either side of a Hebrew letter is caught", () => {
  assert.equal(containsGluedLatin("היpף"), true);
  assert.equal(containsGluedLatin("sמחיר"), true);
  assert.equal(containsGluedLatin("מחירx"), true);
});

test("an empty string is not glued", () => {
  assert.equal(containsGluedLatin(""), false);
});

test("generateText rejects it and streamText deliberately does not", () => {
  /* The asymmetry is the point, and it is the opposite of the Arabic
     decision on purpose.

     `generateText` can retry, so rejecting costs a second. A stream
     cannot: throwing mid-answer discards every sentence already on the
     reader's screen. Arabic earns that cost because it is unreadable;
     one Latin letter in one word does not, and killing a whole chat
     answer over a typo is the worse trade. This pins the choice so it
     reads as a decision rather than an oversight. */
  const source = fs.readFileSync("src/lib/sources/gemini.ts", "utf8");
  const generate = source.slice(source.indexOf("export async function generateText"));
  const stream = source.slice(source.indexOf("export async function* streamText"));
  assert.ok(generate.includes("containsGluedLatin("), "generateText must call it");
  assert.equal(
    stream.includes("containsGluedLatin("),
    false,
    "streamText must NOT kill a whole answer over one letter",
  );
});
