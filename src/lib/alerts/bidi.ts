/**
 * Hebrew and Latin in one line, without the punctuation jumping.
 *
 * An alert is the one place on this site where the text is not rendered
 * by a browser the project controls. Mail clients disagree about almost
 * everything, and the thing they disagree about most is a right-to-left
 * paragraph with Latin inside it — which is every line this site writes,
 * because the prose is Hebrew and the tickers, the prices and the dates
 * are not.
 *
 * WHAT GOES WRONG IS THE NEUTRALS. Characters like `.`, `,`, `(`, `%`,
 * `+`, `-` and `·` have no direction of their own; the bidi algorithm
 * gives them the direction of whatever surrounds them. So in
 *
 *     204.01 מול 206.45 (+1.2%), 3 תפניות
 *
 * the opening bracket, the plus and the comma each take their direction
 * from a neighbour, and in a right-to-left paragraph they end up on the
 * wrong side of the number they belong to. The text is not corrupted —
 * every character is present and in the right logical order — it simply
 * renders as a jumble, and it renders differently in Gmail, in Apple Mail
 * and in Outlook.
 *
 * ISOLATES FIX IT AT THE CHARACTER LEVEL, which is the only level
 * available in an email. U+2066 LEFT-TO-RIGHT ISOLATE opens a run that
 * the algorithm must treat as a self-contained island, and U+2069 POP
 * DIRECTIONAL ISOLATE closes it. Neutrals inside the island take the
 * island's direction and cannot leak out of it; neutrals outside cannot
 * leak in.
 *
 * They are invisible characters rather than markup, which is why this is
 * the right tool here: the same function fixes the HTML body and the
 * plain-text body, no client has to support a tag, and nothing has to be
 * stripped before the text is used somewhere else.
 *
 * WHAT IS NOT WRAPPED. Hebrew runs, obviously, and whitespace between
 * runs — putting the spaces inside the island is how words end up welded
 * together. A run with no letter or digit in it is left alone too: an
 * isolate around a lone dash protects nothing and makes the string harder
 * to read in a log.
 */

/** Hebrew, which is what makes the surrounding paragraph right-to-left. */
const HEBREW = /[֐-׿]/;

/** An isolate is only worth opening around something with content in it. */
const HAS_CONTENT = /[A-Za-z0-9]/;

const LRI = "⁦";
const PDI = "⁩";

/**
 * Wrap every Latin run in a Hebrew line with directional isolates.
 *
 * Returns the string untouched when there is no Hebrew in it: an English
 * line is already a left-to-right paragraph and isolating parts of it
 * would be noise. Also untouched when isolates are already present, so
 * calling this twice is safe — a digest that renders the same text into
 * HTML and into plain text should not double-wrap it.
 */
export function isolateLatin(line: string): string {
  if (!line) return line;
  if (!HEBREW.test(line)) return line;
  if (line.includes(LRI)) return line;

  let out = "";
  let run = "";

  /**
   * The island starts and ends on something with direction of its own.
   *
   * Trimming the boundary neutrals out matters more than it looks. The
   * first attempt isolated the whole run, which pulled the leading space
   * in — gluing it to the Latin and leaving the next Hebrew word without
   * one — and worse, it split bracket pairs: in "×0.6 (אחוזון 1 בשנה)"
   * the opening bracket sat at the end of a Latin run and its closing
   * partner at the end of a Hebrew one, so the two were isolated into
   * different islands and rendered on opposite sides of the phrase.
   *
   * A boundary neutral belongs to the Hebrew sentence it is punctuating,
   * not to the number it happens to touch. So the island covers the
   * alphanumeric core, plus a `%` or a closing bracket where that is
   * genuinely part of the token — "1.2%" is one thing and splitting it
   * would be the same bug in miniature.
   */
  const flush = () => {
    if (!run) return;
    if (!HAS_CONTENT.test(run)) {
      out += run;
      run = "";
      return;
    }
    const match = run.match(/^(\W*)(.*?[A-Za-z0-9](?:[%)\]])?)(\W*)$/s);
    if (!match) {
      out += `${LRI}${run}${PDI}`;
      run = "";
      return;
    }
    const [, before, core, after] = match;
    out += `${before}${LRI}${core}${PDI}${after}`;
    run = "";
  };

  for (const char of line) {
    if (HEBREW.test(char)) {
      flush();
      out += char;
      continue;
    }
    /* A newline ends a run whatever else it is: an island must not span
       two lines, because the paragraph direction is re-established on
       each of them. */
    if (char === "\n") {
      flush();
      out += char;
      continue;
    }
    run += char;
  }
  flush();
  return out;
}

/**
 * The same, for a block that may hold several lines.
 *
 * Applied per line rather than to the whole block, because an isolate
 * spanning a line break is the one case where these characters make the
 * rendering worse rather than better.
 */
export function isolateBlock(text: string): string {
  return text.split("\n").map(isolateLatin).join("\n");
}
