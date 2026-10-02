/**
 * How old any figure on this site is allowed to be.
 *
 * The windows were set one at a time, in the file that happened to need
 * one, and drifted apart: a company page revalidated every ten minutes
 * while the candles it drew were cached for an hour, so the chart could be
 * six times staler than the page around it and nothing said so. Naming the
 * windows here is what makes that kind of disagreement visible.
 *
 * The rule the owner asked for is ten minutes. It applies to everything
 * that moves with the market. It deliberately does not apply to two kinds
 * of data, and the reason is not laziness in either case:
 *
 *  - Filings move quarterly. Re-reading a 10-Q every ten minutes cannot
 *    produce a newer number; it only spends SEC's rate limit, which this
 *    project is bound to respect.
 *  - Model-written passages cost quota. The first iron rule of this
 *    project is zero monthly cost, and a six-fold increase in Gemini calls
 *    to re-derive the same paragraph is exactly the kind of spend that
 *    rule exists to prevent.
 *
 * Both are also the slowest things on the site, so a short window there
 * would make the pages feel worse, not fresher.
 */

/** Prices, quotes, indices, breadth — anything the market itself moves. */
export const MARKET = 600;

/** The live tape, where a minute is already a long time. */
export const TAPE = 120;

/** Extended hours, which only matter while they are happening. */
export const SESSION = 60;

/** Filings and anything derived from them. Quarterly data. */
export const FILINGS = 3600;

/** Passages a model wrote. See the note above on cost. */
export const MODEL = 3600;

/** Macro series a central bank publishes daily at best. */
export const MACRO = 21_600;
