import type { Grade, GradedClaim } from "@/lib/intel/confidence";

/**
 * The same company, priced twice.
 *
 * Eight of the fourteen names on the Tel Aviv board also trade in New
 * York. That fact does two things for an Israeli reader, and the second
 * is the one nobody shows them.
 *
 * The first is access: a dual-listed company files with SEC, so every
 * apparatus on this site — the Core Test, the thesis, the sector
 * comparison — runs on it under the American symbol. A company listed
 * only in Tel Aviv is a price and nothing more here, because nothing can
 * be computed from filings that were never made in a form this site
 * reads.
 *
 * The second is the gap. Convert the shekel price at the day's rate and
 * you get two numbers for one business that rarely match — and the reason
 * they do not match is almost never mispricing.
 *
 * **This is not arbitrage, and the module says so on every row.** Tel
 * Aviv closes around 17:25 Israel time and New York closes at 23:00, so
 * for six hours of every evening the Tel Aviv figure is simply older. A
 * gap measured at 21:00 is mostly a measurement of that delay: New York
 * has repriced the company and Tel Aviv has not yet had the chance. What
 * the gap is genuinely useful for is the opposite direction — it says
 * which side has already moved, and therefore where tomorrow's Tel Aviv
 * open is starting from.
 */

export type Parity = {
  taseSymbol: string;
  usTicker: string;
  name: string;
  sector: string;
  /** Shekels, as the board reports them. */
  tasePrice: number | null;
  taseChangePercent: number | null;
  /** Dollars. */
  usPrice: number | null;
  usChangePercent: number | null;
  /** The shekel price expressed in dollars at the day's rate. */
  impliedUsd: number | null;
  /** How far the two are apart, as a percentage of the US price. */
  gapPercent: number | null;
  /** Which side has moved further today, when both are known. */
  leader: "us" | "tase" | "even" | "unknown";
};

export type CrossListing = {
  rate: number | null;
  rateAsOf: string | null;
  rows: Parity[];
  /** The bottom line about the set, not about any one row. */
  headline: string;
  claim: GradedClaim;
};

const pct = (value: number, digits = 1) =>
  `${value > 0 ? "+" : value < 0 ? "−" : ""}${Math.abs(value).toFixed(digits)}%`;

/** Below this, a gap is the two markets rounding differently and the
 *  shekel moving a tenth of a percent. Naming it as a finding would teach
 *  the reader to look at noise. */
const NOISE = 1.5;

export function buildCrossListing({
  rate,
  rateAsOf,
  rows,
  taseOpen,
}: {
  /** Shekels per dollar. */
  rate: number | null;
  rateAsOf: string | null;
  rows: Omit<Parity, "impliedUsd" | "gapPercent" | "leader">[];
  /**
   * Whether Tel Aviv is actually trading.
   *
   * Load-bearing. A closed board reports a change of 0.00%, which is not
   * a measurement of a flat day — it is the absence of one. Comparing
   * that against a live New York move produced rows reading "even" for a
   * company New York had repriced six percent, which is the interface
   * stating something false with total confidence.
   */
  taseOpen: boolean;
}): CrossListing {
  const priced: Parity[] = rows.map((row) => {
    const impliedUsd =
      rate !== null && rate > 0 && row.tasePrice !== null
        ? row.tasePrice / rate
        : null;

    const gapPercent =
      impliedUsd !== null && row.usPrice !== null && row.usPrice > 0
        ? ((impliedUsd - row.usPrice) / row.usPrice) * 100
        : null;

    const leader: Parity["leader"] =
      !taseOpen ||
      row.usChangePercent === null ||
      row.taseChangePercent === null
        ? "unknown"
        : Math.abs(row.usChangePercent - row.taseChangePercent) < 0.5
          ? "even"
          : Math.abs(row.usChangePercent) > Math.abs(row.taseChangePercent)
            ? "us"
            : "tase";

    return { ...row, impliedUsd, gapPercent, leader };
  });

  const measurable = priced.filter((row) => row.gapPercent !== null);
  const wide = measurable.filter(
    (row) => Math.abs(row.gapPercent ?? 0) >= NOISE,
  );

  const averageGap =
    measurable.length > 0
      ? measurable.reduce((total, row) => total + Math.abs(row.gapPercent ?? 0), 0) /
        measurable.length
      : null;

  const headline =
    rate === null
      ? "שער הדולר לא התקבל, ולכן אי אפשר להמיר את המחירים בתל אביב ולהשוות אותם לניו יורק."
      : measurable.length === 0
        ? "לא התקבלו מספיק ציטוטים משני הצדדים כדי להשוות."
        : wide.length === 0
          ? `שני הצדדים מתומחרים באותו מקום. הפער הממוצע הוא ${pct(averageGap ?? 0)}, כלומר בתוך טווח של הפרשי עיגול ותנועה בשער.`
          : `${wide.length} מתוך ${measurable.length} הצמדים מציגים פער של יותר מ-${NOISE}% — והפער הזה מודד בעיקר את הפרש שעות הסגירה, לא תמחור שגוי.`;

  /* The two prices and the rate are all prints, so the *measurement* is
     confirmed. What is not confirmed — and is explicitly disclaimed on
     every row — is that the gap means anything tradeable. */
  const grade: Grade =
    rate === null || measurable.length === 0 ? "speculative" : "confirmed";

  return {
    rate,
    rateAsOf,
    rows: priced,
    headline,
    claim: {
      grade,
      basis:
        rate !== null
          ? `שער ${rate.toFixed(3)} ₪ לדולר · ${measurable.length} צמדים עם ציטוט משני הצדדים`
          : "אין שער חליפין",
      limits: taseOpen
        ? "הפער אינו הזדמנות ארביטראז׳. הבורסה בתל אביב נועלת כחמש שעות לפני ניו יורק, ולכן בערב המחיר המקומי פשוט ישן יותר — הפער מודד את ההפרש הזה ואת תנועת השקל. מה שהוא כן אומר: איזה צד כבר זז, ומאיפה הפתיחה מחר בתל אביב מתחילה."
        : "הבורסה בתל אביב סגורה כרגע, ולכן היא מדווחת שינוי של 0.00% — זה היעדר מדידה ולא יום שטוח. עמודת ״מי זז יותר״ אינה מחושבת במצב הזה. הפער עצמו עדיין נמדד, והוא אומר בעיקר מה ניו יורק תמחרה מאז שתל אביב ננעלה.",
    },
  };
}
