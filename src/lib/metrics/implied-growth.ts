/**
 * What the price already assumes.
 *
 * A five-year forecast of where a stock will trade is a guess with a
 * decimal point on it, and this site does not make them. The question it
 * can answer is the inverse one, and it is arithmetic rather than
 * prophecy: given what the market pays for a dollar of earnings today, how
 * fast do earnings have to compound for that price to still make sense in
 * five years against a normal multiple?
 *
 * That number is not a prediction. It is the assumption already embedded
 * in the quote, and the useful thing about it is that a reader can judge
 * it: "this price needs 31% a year for five years" is a claim about the
 * future that anyone can weigh against what the company has actually done.
 *
 * THE ALGEBRA, so it can be checked rather than trusted.
 *
 *   price today        = PE × E₀
 *   price in 5 years   = M  × E₅        (M = the terminal multiple)
 *   E₅                 = E₀ × (1+g)⁵
 *
 * For the price merely to hold — no gain, no loss — those two are equal:
 *
 *   PE × E₀ = M × E₀ × (1+g)⁵
 *   (1+g)⁵  = PE / M
 *   g       = (PE / M)^(1/5) − 1
 *
 * E₀ cancels, which is why this works without knowing earnings in dollars
 * and why it is honest about what it does not need.
 *
 * The terminal multiple is the one assumption that cannot be derived, so
 * it is never hidden: every caller passes it and every surface prints it.
 * CLAUDE.md rule 9 — when there is an assumption, it goes next to the
 * result.
 */

export type ImpliedGrowth = {
  /** Compound annual earnings growth the price assumes, in percent. */
  annualPercent: number;
  /** Over how many years. */
  years: number;
  /** The exit multiple assumed. Printed beside the figure, always. */
  terminalMultiple: number;
  /** The multiple the price is at now. */
  currentMultiple: number;
};

/**
 * Null rather than a number whenever the question does not apply.
 *
 * A negative or absent P/E means the company has no earnings to compound,
 * and an answer there would be arithmetic performed on nothing. A multiple
 * already at or below the terminal one needs no growth at all, which is a
 * real answer — it comes back as zero or negative rather than as null,
 * because "the price assumes nothing" is information.
 */
export function impliedGrowth(
  currentMultiple: number | null | undefined,
  terminalMultiple: number,
  years = 5,
): ImpliedGrowth | null {
  if (
    currentMultiple === null ||
    currentMultiple === undefined ||
    !Number.isFinite(currentMultiple) ||
    currentMultiple <= 0
  ) {
    return null;
  }
  if (!Number.isFinite(terminalMultiple) || terminalMultiple <= 0) return null;
  if (!Number.isFinite(years) || years <= 0) return null;

  const growth = (currentMultiple / terminalMultiple) ** (1 / years) - 1;
  if (!Number.isFinite(growth)) return null;

  return {
    annualPercent: growth * 100,
    years,
    terminalMultiple,
    currentMultiple,
  };
}

/**
 * How that assumption compares with what the company actually delivered.
 *
 * The implied figure on its own is a datum (rule 5). Beside the company's
 * own three-year revenue CAGR it becomes the question worth asking: the
 * price needs this much, the business has been doing that much, and the
 * gap between them is the whole argument.
 *
 * Returned as a plain difference in percentage points, with no verdict
 * attached. A price demanding less than the business has delivered is not
 * automatically cheap, and more is not automatically expensive — that
 * depends on whether the delivery continues, which is exactly the thing
 * nobody here can measure.
 */
export function demandGap(
  implied: ImpliedGrowth | null,
  deliveredPercent: number | null | undefined,
): number | null {
  if (!implied) return null;
  if (
    deliveredPercent === null ||
    deliveredPercent === undefined ||
    !Number.isFinite(deliveredPercent)
  ) {
    return null;
  }
  return implied.annualPercent - deliveredPercent;
}
