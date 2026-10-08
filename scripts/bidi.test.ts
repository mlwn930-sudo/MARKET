/**
 * Mixed Hebrew and Latin, in a mail client nobody controls.
 *
 * The site renders in a browser this project can test. An email does not:
 * Gmail, Apple Mail and Outlook disagree about right-to-left paragraphs
 * with Latin inside them, and every line this site writes is one, because
 * the prose is Hebrew and the tickers, prices and dates are not.
 *
 * The characters at risk are the neutrals — `.` `,` `(` `%` `+` `-` `·` —
 * which have no direction and take one from whatever is next to them. An
 * isolate pins a Latin run so neutrals can neither leak in nor out.
 *
 * What these tests pin is the BOUNDARY, because that is what the first
 * attempt got wrong: it swallowed the leading space and split bracket
 * pairs across islands.
 *
 *   npx tsx --test scripts/bidi.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { isolateBlock, isolateLatin } from "../src/lib/alerts/bidi";

const LRI = "⁦";
const PDI = "⁩";
/** The string as a reader of this test can see it. */
const show = (s: string) => s.split(LRI).join("⟦").split(PDI).join("⟧");

test("an English line is left alone", () => {
  const line = "Plain English, no Hebrew at all (100%)";
  assert.equal(isolateLatin(line), line);
});

test("a Hebrew line with no Latin is left alone", () => {
  const line = "מגמת ירידה והתנגדות חזקה";
  assert.equal(isolateLatin(line), line);
});

test("a ticker is isolated and its colon is not", () => {
  /* The colon belongs to the Hebrew sentence it punctuates. Inside the
     island it renders on the wrong side of the ticker. */
  assert.equal(show(isolateLatin("TTWO: חלשות טכנית")), "⟦TTWO⟧: חלשות טכנית");
});

test("a bracket pair around Hebrew is never split", () => {
  /* The failure the first attempt had: the opening bracket ended a Latin
     run and the closing one ended a Hebrew run, so the two landed in
     different islands and rendered on opposite sides of the phrase. */
  const out = show(isolateLatin("מחזור ×0.6 (אחוזון 1 בשנה האחרונה)"));
  assert.ok(!out.includes("(⟧"), `bracket pulled into an island: ${out}`);
  assert.ok(!out.includes("⟦("), `bracket pulled into an island: ${out}`);
});

test("a percentage stays welded to its number", () => {
  assert.equal(show(isolateLatin("טווח 1.1% היום")), "טווח ⟦1.1%⟧ היום");
});

test("the space before a number stays outside the island", () => {
  /* Inside it, the space is swallowed into the Latin run and the next
     Hebrew word arrives glued to the number. */
  const out = isolateLatin("מול 206.45 נקודות");
  assert.ok(!out.includes(`${LRI} `), "leading space was pulled in");
  assert.ok(!out.includes(` ${PDI}`), "trailing space was pulled in");
});

test("a Hebrew prefix keeps its hyphen", () => {
  /* "ב-2026-09-09" is a Hebrew preposition, a hyphen and a date. The
     hyphen belongs to the Hebrew. */
  assert.equal(
    show(isolateLatin("האחרונה ב-2026-09-09")),
    "האחרונה ב-⟦2026-09-09⟧",
  );
});

test("an English sentence is one island, not one per word", () => {
  const out = show(isolateLatin("הכותרת במקור: How GTA VI Fuels Growth · fool.com"));
  assert.equal(
    (out.match(/⟦/g) ?? []).length,
    1,
    `an English phrase must not be shredded: ${out}`,
  );
});

test("every island is opened and closed", () => {
  const lines = [
    "TTWO: חלשות טכנית לצד התנגדות חזקה",
    "204.01 מול 206.45 (+1.2%), 3 תפניות נפרדות, האחרונה ב-2026-09-09",
    "2026-10-07 · מחזור ×0.6 (אחוזון 1), טווח 1.1%",
    "9 מופעים בעשר שנים · חודש אחרי 88% מול בסיס 59%",
    "כוח יחסי 11 מתוך 99 — מהחלשים ביקום המחקר",
  ];
  for (const line of lines) {
    const out = isolateLatin(line);
    assert.equal(
      out.split(LRI).length,
      out.split(PDI).length,
      `unbalanced isolates in: ${show(out)}`,
    );
  }
});

test("no character is lost or added", () => {
  /* The isolates are the only difference. Anything else would mean the
     function is editing the message rather than directing it. */
  const line = "204.01 מול 206.45 (+1.2%), 3 תפניות, ב-2026-09-09";
  const out = isolateLatin(line);
  assert.equal(out.split(LRI).join("").split(PDI).join(""), line);
});

test("calling it twice changes nothing", () => {
  /* The digest renders the same text into an HTML body and a plain-text
     body; double-wrapping would nest islands for no reason. */
  const once = isolateLatin("TTWO: מחיר 204.01 מול 206.45");
  assert.equal(isolateLatin(once), once);
});

test("an island never spans a line break", () => {
  /* Paragraph direction is re-established on each line, so an island
     crossing one is the case where these characters make it worse. */
  const out = isolateBlock("השפעה: 12%\nתגובת מחיר: NVDA עלתה");
  for (const line of out.split("\n")) {
    assert.equal(line.split(LRI).length, line.split(PDI).length);
  }
});

test("an empty string survives", () => {
  assert.equal(isolateLatin(""), "");
  assert.equal(isolateBlock(""), "");
});
