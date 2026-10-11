/**
 * The monogram has to be readable on the colour behind it.
 *
 * `inkFor` picks black or white for a company's accent by computing both
 * contrast ratios and taking the winner. The arithmetic was right and
 * the input was not: it read hex only, and an unbranded company gets
 * `hsl(... 55% 58%)` from `hashColour`. `parseInt("hs", 16)` is NaN,
 * every comparison against NaN is false, and the function fell through
 * to white on a mid-lightness background.
 *
 * Measured on the home page before the fix: SK at 2.44:1, where black
 * would have been 7.77:1. And it was worst exactly where it mattered —
 * a branded company has a logo covering the letters, an unbranded one
 * does not, so for unbranded names the monogram IS the mark.
 *
 *   npx tsx --test scripts/ink.test.ts
 */
import { strict as assert } from "node:assert";
import test from "node:test";
import { inkFor } from "../src/components/CompanyMark";

const DARK = "#0B1220";
const LIGHT = "#FFFFFF";

test("a light hex gets dark ink and a dark hex gets light ink", () => {
  assert.equal(inkFor("#FFFFFF"), DARK);
  assert.equal(inkFor("#000000"), LIGHT);
  /* The two from the function's own doc comment. */
  assert.equal(inkFor("#00A4EF"), DARK, "Microsoft blue: black is 7.56, white 2.78");
  assert.equal(inkFor("#4285F4"), DARK, "Alphabet blue: black is 5.89, white 3.56");
});

test("short hex is expanded, not misread", () => {
  assert.equal(inkFor("#fff"), DARK);
  assert.equal(inkFor("#000"), LIGHT);
});

test("an hsl accent is read, which is the whole bug", () => {
  /* The exact shape hashColour emits: `hsl(<deg> 55% 66%)`, space
     separated and no commas. Every unbranded company gets one, and
     before the parser understood hsl every one of them got white. */
  assert.equal(inkFor("hsl(195 55% 66%)"), DARK);
  assert.equal(inkFor("hsl(20 55% 66%)"), DARK);
  assert.equal(inkFor("hsl(240 55% 66%)"), DARK, "the darkest hue at this lightness");
  /* Commas are accepted too, since a hand-written accent may use them. */
  assert.equal(inkFor("hsl(195, 55%, 66%)"), DARK);
  /* A genuinely dark colour still gets white — the function is not
     biased toward dark, it measures. */
  assert.equal(inkFor("hsl(240 55% 12%)"), LIGHT);
  assert.equal(inkFor("hsl(277 55% 40%)"), LIGHT);
});

test("every hue hashColour can produce ends up readable", () => {
  /* The guarantee that matters is not "dark wins" — it is that whatever
     is chosen clears AA against the accent. Walked over all 360 hues at
     the saturation and lightness the generator uses.

     This is what moved the generator from 58% to 66%: at 58% the worst
     hue reached only 4.33:1 with either ink, and at 62% it was no
     better. 66% clears every hue at 4.92:1. The test is the reason the
     constant has the value it has. */
  const channels = (h: number) => {
    const sat = 0.55;
    const light = 0.66;
    const q = light + sat - light * sat;
    const p = 2 * light - q;
    const to = (t: number) => {
      let x = t;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    const hh = h / 360;
    return [to(hh + 1 / 3), to(hh), to(hh - 1 / 3)];
  };
  const lum = (c: number[]) => {
    const f = (v: number) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2]);
  };
  const ratio = (a: number, b: number) =>
    (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);

  let worst = Infinity;
  let worstHue = -1;
  for (let h = 0; h < 360; h++) {
    const bg = lum(channels(h));
    const ink = inkFor(`hsl(${h} 55% 66%)`);
    const r = ratio(bg, ink === DARK ? lum([0.043, 0.071, 0.125]) : 1);
    if (r < worst) {
      worst = r;
      worstHue = h;
    }
  }
  assert.ok(
    worst >= 4.5,
    `hue ${worstHue} only reaches ${worst.toFixed(2)}:1 — AA needs 4.5`,
  );
});

test("an rgb() accent is read too", () => {
  assert.equal(inkFor("rgb(89, 177, 207)"), DARK, "the SK colour, as rgb");
  assert.equal(inkFor("rgb(11, 18, 32)"), LIGHT);
});

test("an unreadable colour falls to dark ink, not to white", () => {
  /* White was the old accidental fallback and it is the wrong one:
     unbranded accents are mid-lightness by construction, so dark is the
     better guess when there is nothing to measure. */
  for (const junk of ["", "transparent", "var(--accent)", "currentColor", "#12345"]) {
    assert.equal(inkFor(junk), DARK, `"${junk}" must not produce white`);
  }
});
