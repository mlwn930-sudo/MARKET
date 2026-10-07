/**
 * Hebrew that survives being drawn by Satori.
 *
 * `next/og` renders through Satori, which lays glyphs out strictly in
 * logical order, left to right, with no bidirectional algorithm. A browser
 * reorders an RTL run for you; Satori does not. The first card this
 * project generated came out with "מוליכים למחצה" rendered as
 * "הצחמל םיכילומ" — every word correct, every word backwards — and the
 * footer line reversed end to end on top of that.
 *
 * There is no flag to turn on. The fix is to hand Satori the string
 * already in visual order, which is what this does: reverse the order of
 * the words, and reverse the characters inside the words that are Hebrew,
 * leaving Latin and digits alone. A ticker, a number and a unit all stay
 * readable; the Hebrew lands the right way round.
 *
 * WHY WORDS AND NOT CHARACTERS. Reversing the whole string turns "13F"
 * into "F31", which is the mirror of the bug being fixed. Reversing per
 * word keeps each LTR token intact while still putting the words in RTL
 * order, and that covers every line these cards carry: pure Hebrew, Hebrew
 * with a Latin ticker in it, and a list of sources separated by middots.
 *
 * It is NOT a bidi implementation and does not pretend to be. Nested
 * directional runs, bracket mirroring and digit shaping are all out of
 * scope — this has one job, on strings this project writes by hand, and
 * the moment a card needs more than that the honest move is to render the
 * card's text as Latin rather than to grow this into a half-correct
 * Unicode annex 9.
 *
 * ONE TRAP, AND IT IS NOT OBVIOUS: DO NOT LET THE RESULT WRAP. The words
 * come back in visual order, so a renderer that breaks the line for itself
 * takes them in that order too — the first visual line receives what
 * should have been the last words and the paragraph reads bottom-up. The
 * site card hit this immediately. Any string long enough to wrap has to be
 * split into lines by the caller, each line passed through here on its
 * own, and each rendered as its own row.
 */

const HEBREW = /[֐-׿]/;

/** Reverse the characters of a string by code point, so a combining mark
 *  or a surrogate pair is not split down the middle. */
function reverseChars(value: string): string {
  return [...value].reverse().join("");
}

/**
 * A line of Hebrew, in the visual order Satori needs.
 *
 * Returns the string untouched when it holds no Hebrew at all, so it is
 * safe to wrap every label on a card without thinking about which ones
 * need it.
 */
export function rtl(line: string): string {
  if (!HEBREW.test(line)) return line;
  return line
    .split(" ")
    .map((word) => (HEBREW.test(word) ? reverseChars(word) : word))
    .reverse()
    .join(" ");
}
