import type { PriceLevel } from "@/lib/metrics/levels";
import type { TradePlan } from "@/lib/analysis/trade-plan";

/**
 * The reader's own cost basis, which changes every answer on the page.
 *
 * Everything the chart reader computes assumed the reader was deciding
 * whether to open a position: the plan's reference is the last close,
 * the risk is measured from it, the targets are multiples of that risk.
 * Somebody already holding the stock is asking a different question with
 * the same words. "Where is the stop" means one thing at a cost of 204
 * and another at 226 — at one the stop protects capital, at the other it
 * protects a gain, and the site could not tell those apart because it
 * did not know the number.
 *
 * WHICH IS THE ONE INPUT THAT CANNOT BE MEASURED FROM CANDLES, and the
 * reason it is asked for rather than derived. Once it is given,
 * everything below is arithmetic — no new estimate, no model, nothing
 * invented. That is the whole test for what belongs here: if it needs an
 * assumption, it does not go in.
 *
 * STORED IN THE BROWSER AND NOWHERE ELSE, like the watchlist. A cost
 * basis is the most personal number on the site, the project has no
 * accounts, and the server has no reason to keep it: the page sends it
 * with the question and the answer is computed and forgotten.
 */

export type Position = {
  /** What the reader paid, per share. */
  entry: number;
  /** Optional. Only used to turn percentages into money. */
  shares: number | null;
};

export type PositionRead = {
  entry: number;
  shares: number | null;
  last: number;
  /** Unrealised, as a percentage and — when shares are known — in money. */
  returnPercent: number;
  returnValue: number | null;
  /**
   * Where the plan's stop sits relative to the cost basis, which is the
   * distinction the site could not make before.
   *
   * `capital` — the stop is below the entry, so it ends the position at
   * a loss and the risk is the reader's own money.
   * `gain` — the stop is above the entry, so the position cannot close
   * red at that level and what is at risk is profit already made.
   */
  stopProtects: "capital" | "gain";
  /** Signed against the entry: negative means the stop is a loss. */
  stopFromEntryPercent: number;
  /** Measured bands between the cost basis and the last close. These are
   *  the prices a position has to come back through, and they exist
   *  whether or not anyone is holding. */
  levelsBetween: PriceLevel[];
  /**
   * What the position has already done against what the condition
   * historically did. Null when nothing counted fired.
   *
   * The honest comparison and an easy one to get wrong: the rate was
   * measured forward from the bar the condition fired on, not from the
   * reader's entry. So this never says "you have captured X% of the
   * move" — it says what the typical move was, beside what this
   * position has done, and leaves them as two numbers.
   */
  versusMedian: { medianPct: number; note: string } | null;
};

export function readPosition(
  position: Position,
  last: number,
  plan: TradePlan | null,
  levels: PriceLevel[],
  medianPct: number | null,
): PositionRead | null {
  const { entry, shares } = position;
  if (!(entry > 0) || !(last > 0)) return null;

  const returnPercent = ((last - entry) / entry) * 100;
  const stop = plan?.stop ?? null;

  const stopFromEntryPercent =
    stop !== null ? ((stop - entry) / entry) * 100 : 0;

  /* Between the cost basis and here, whichever way round they are. A
     position under water has levels overhead; one in profit has them
     underneath, and they are the same bands. */
  const low = Math.min(entry, last);
  const high = Math.max(entry, last);
  const levelsBetween = levels
    .filter((l) => l.price > low && l.price < high)
    .sort((a, b) => b.price - a.price);

  return {
    entry,
    shares,
    last,
    returnPercent,
    returnValue: shares !== null ? (last - entry) * shares : null,
    stopProtects: stop !== null && stop >= entry ? "gain" : "capital",
    stopFromEntryPercent,
    levelsBetween,
    versusMedian:
      medianPct === null
        ? null
        : {
            medianPct,
            /* Never phrased as a share of the move captured. The rate was
               counted forward from the condition's own bar and not from
               this entry, and dividing one by the other would produce a
               number that was never measured. */
            note:
              `התנועה החציונית שנמדדה אחרי התנאי היא ${medianPct.toFixed(1)}%, ` +
              `והפוזיציה הזאת עשתה ${returnPercent.toFixed(1)}% מאז הכניסה שלך. ` +
              "אלה שני מספרים ולא יחס: החציון נספר קדימה מהנר שבו התנאי פעל, " +
              "לא מהתאריך שבו קנית.",
          },
  };
}

/**
 * A posted cost basis, turned into a reading or dropped.
 *
 * The body is client-supplied and this is the one field in it that is
 * not a measurement the server can recompute — so it is checked for
 * being a plausible price rather than trusted. An entry ten times the
 * instrument's own close is a typo or a different instrument, and
 * either way the arithmetic built on it would be confident nonsense.
 * The band is wide on purpose: a position opened years ago at a tenth
 * of today's price is real, and only an order of magnitude is absurd.
 */
export function readPositionFrom(
  raw: unknown,
  checked: {
    lastClose: number;
    realLevels: PriceLevel[];
    setup: unknown;
    baseRates: unknown;
    atr: number | null;
  },
  plan: TradePlan | null,
  medianPct: number | null,
): PositionRead | null {
  if (!raw || typeof raw !== "object") return null;
  const body = raw as { entry?: unknown; shares?: unknown };

  const entry = Number(body.entry);
  if (!Number.isFinite(entry) || entry <= 0) return null;
  /* Two orders of magnitude either side of the close. Outside that it is
     a different instrument or a mistyped number, and neither deserves
     arithmetic performed on it. */
  const ratio = entry / checked.lastClose;
  if (ratio > 100 || ratio < 0.01) return null;

  const sharesRaw = Number(body.shares);
  const shares =
    Number.isFinite(sharesRaw) && sharesRaw > 0 ? Math.floor(sharesRaw) : null;

  return readPosition(
    { entry, shares },
    checked.lastClose,
    plan,
    checked.realLevels,
    medianPct,
  );
}
