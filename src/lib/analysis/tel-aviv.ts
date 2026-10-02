import type { Grade, GradedClaim } from "@/lib/intel/confidence";

/**
 * The local market, read rather than listed.
 *
 * The Tel Aviv page used to be four things on top of each other: an index
 * strip, fourteen prices, a shekel rate and a news block. Every figure on
 * it was a print, and not one of them was measured against anything —
 * which is the exact failure rule 5 of this project exists to prevent. A
 * reader could learn that Bank Leumi is at ₪48.20 and leave without
 * learning a single thing they did not already know from a broker app.
 *
 * So this file is the measuring. Three readers, and the division between
 * them is the three questions an Israeli reader actually arrives with.
 *
 *   What did the market do — breadth, an equal-weight average to set
 *   beside the cap-weighted index, and where the names sit inside their
 *   own year rather than inside today.
 *
 *   Where was the move — the sectors, with a figure each instead of a
 *   heading each.
 *
 *   What did it do to me — the shekel, which for a reader who spends
 *   shekels is not a currency widget but half the return on every dollar
 *   asset they own.
 *
 * Two things this file deliberately does not do.
 *
 * It does not score the market. There is no composite, no rating and no
 * "strength" out of ten: rule 8. Every output here is either a counted
 * print or a difference between two counted prints, and the claim beside
 * it says which.
 *
 * It does not reach for a figure the feed cannot support. There is no
 * market breadth for the whole exchange — this page follows fourteen
 * curated names, the exchange lists hundreds, and the difference is stated
 * on screen rather than quietly ignored. There is no cap weighting,
 * because the free quote carries no share count. Rule 9.
 */

/* ------------------------------------------------------------------ */
/* Shared shapes                                                       */
/* ------------------------------------------------------------------ */

/**
 * What every reader here needs from one Tel Aviv name.
 *
 * Deliberately not `TaseQuote & meta`: the page joins the quote to the
 * curated row before calling in, so this file never has to know that the
 * two arrive from different places or that half the quotes can be null.
 */
export type LocalName = {
  symbol: string;
  name: string;
  sector: string;
  /** The New York ticker, when the company also files with SEC. */
  usTicker?: string;
  price: number | null;
  changePercent: number | null;
  windowChangePercent: number | null;
  windowSessions: number;
  yearHigh: number | null;
  yearLow: number | null;
  volume: number | null;
  averageVolume: number | null;
  closes: number[];
};

/** One name picked out of the list for being at an end of it. */
export type Extreme = {
  symbol: string;
  name: string;
  percent: number;
};

/**
 * Where a price sits between its own low and high, as 0 to 1.
 *
 * One implementation, because rule 4 of this project says a formula lives
 * in one place and this one is now read by three: the row that draws the
 * rail, the session read that counts how many names are near an end, and
 * the shekel panel that says the same thing about the exchange rate.
 *
 * Null rather than 0.5 when the inputs will not support it. A midpoint is
 * a measurement; a midpoint invented because two fields were missing is a
 * guess wearing a measurement's clothes.
 */
export function rangePosition(
  price: number | null,
  low: number | null,
  high: number | null,
): number | null {
  if (price === null || low === null || high === null) return null;
  if (!Number.isFinite(price) || !Number.isFinite(low) || !Number.isFinite(high)) {
    return null;
  }
  if (high <= low) return null;
  return Math.max(0, Math.min((price - low) / (high - low), 1));
}

/**
 * A signed figure that survives an RTL paragraph.
 *
 * The leading minus is the problem. U+2212 is a bidi European Separator,
 * and a separator that is not between two digit runs takes the paragraph's
 * direction — so "−0.40%" dropped into a Hebrew sentence renders as
 * "0.40%−", which is a different number from the one that was computed.
 * `.num` solves this in CSS with `unicode-bidi: isolate`, and that is the
 * right answer wherever a figure gets its own element. A sentence built in
 * TypeScript has no element to hang it on, so the isolate is written into
 * the string itself: U+2066 LEFT-TO-RIGHT ISOLATE opens, U+2069 closes.
 */
export function signed(value: number, digits = 2): string {
  const sign = value > 0 ? "+" : value < 0 ? "−" : "";
  return `⁦${sign}${Math.abs(value).toFixed(digits)}%⁩`;
}

/** The same isolation for a figure that carries no sign. */
export function isolated(text: string): string {
  return `⁦${text}⁩`;
}

const mean = (values: number[]): number | null =>
  values.length === 0
    ? null
    : values.reduce((total, value) => total + value, 0) / values.length;

const known = (values: (number | null)[]): number[] =>
  values.filter((value): value is number => value !== null && Number.isFinite(value));

/* ------------------------------------------------------------------ */
/* 1 — What the market did                                             */
/* ------------------------------------------------------------------ */

/**
 * How the tracked names are distributed inside their own 52-week ranges.
 *
 * The most informative thing a board of prices can be asked, and the
 * cheapest: a market where eleven of fourteen names sit in the top fifth
 * of their year is in a different condition from one where eleven sit in
 * the bottom fifth, and today's percentage move tells you nothing about
 * which.
 *
 * Deliberately not coloured green and red on screen. "Near its high" is
 * not good news and "near its low" is not bad news — the colour would be
 * the site taking a position, which is the line rule 8 draws.
 */
export type Spread = {
  high: number;
  middle: number;
  low: number;
  /** How many names had enough data to be placed at all. */
  scored: number;
};

export type SessionRead = {
  quoted: number;
  missing: number;
  advancing: number;
  declining: number;
  unchanged: number;
  /** Equal weight, today. Every name counts once. */
  averageMove: number | null;
  /** Equal weight, across the whole window the quotes carry. */
  windowAverage: number | null;
  /** How many sessions that window covers, averaged and rounded. */
  windowSessions: number;
  spread: Spread;
  best: Extreme | null;
  worst: Extreme | null;
  windowBest: Extreme | null;
  windowWorst: Extreme | null;
  /**
   * The flagship index against the equal-weight average of this list.
   *
   * The index is weighted by market value, so it is mostly a few very
   * large banks; the equal-weight average gives Bank Leumi and El Al the
   * same vote. When the index is ahead, the day happened in the big names.
   */
  concentration: {
    indexName: string;
    indexMove: number;
    equalMove: number;
    /** Index minus equal weight, in percentage points. */
    difference: number;
  } | null;
  claim: GradedClaim;
};

/** Below this a move is rounding and a direction is noise. */
const FLAT = 0.05;

/** The top and bottom fifth of a 52-week range. */
const NEAR = 0.2;

export function readSession({
  names,
  missing,
  flagship,
}: {
  names: LocalName[];
  /** How many of the curated rows returned no quote at all. */
  missing: number;
  /** The cap-weighted index, for the concentration comparison. */
  flagship: { name: string; changePercent: number | null } | null;
}): SessionRead {
  const moves = known(names.map((row) => row.changePercent));

  const advancing = moves.filter((move) => move > FLAT).length;
  const declining = moves.filter((move) => move < -FLAT).length;
  const unchanged = moves.length - advancing - declining;

  const averageMove = mean(moves);
  const windowAverage = mean(known(names.map((row) => row.windowChangePercent)));

  const sessionCounts = names
    .map((row) => row.windowSessions)
    .filter((count) => count > 0);

  const positions = names
    .map((row) => rangePosition(row.price, row.yearLow, row.yearHigh))
    .filter((value): value is number => value !== null);

  const spread: Spread = {
    high: positions.filter((value) => value >= 1 - NEAR).length,
    low: positions.filter((value) => value <= NEAR).length,
    middle: positions.filter((value) => value > NEAR && value < 1 - NEAR).length,
    scored: positions.length,
  };

  const extreme = (
    pick: (row: LocalName) => number | null,
    direction: "max" | "min",
  ): Extreme | null => {
    const scored = names
      .map((row) => ({ row, value: pick(row) }))
      .filter((entry): entry is { row: LocalName; value: number } =>
        entry.value !== null && Number.isFinite(entry.value),
      );
    if (scored.length === 0) return null;

    const winner = scored.reduce((held, entry) =>
      direction === "max"
        ? entry.value > held.value
          ? entry
          : held
        : entry.value < held.value
          ? entry
          : held,
    );
    return {
      symbol: winner.row.symbol,
      name: winner.row.name,
      percent: winner.value,
    };
  };

  const concentration =
    flagship !== null &&
    flagship.changePercent !== null &&
    Number.isFinite(flagship.changePercent) &&
    averageMove !== null
      ? {
          indexName: flagship.name,
          indexMove: flagship.changePercent,
          equalMove: averageMove,
          difference: flagship.changePercent - averageMove,
        }
      : null;

  /* The counting is a print; the reading of it is not. Breadth off a
     fourteen-name list is a measurement of fourteen names, and saying so
     is the difference between this and a site that writes "market breadth
     positive" off whatever it happened to load. */
  const grade: Grade = moves.length === 0 ? "speculative" : "confirmed";

  const basis =
    moves.length === 0
      ? "לא התקבל אף ציטוט מתל אביב"
      : `${isolated(`${advancing}/${moves.length}`)} ניירות בעלייה · ממוצע שווה-משקל ${
          averageMove === null ? "—" : signed(averageMove)
        }${
          concentration
            ? ` · ${concentration.indexName} ${signed(concentration.indexMove)}`
            : ""
        }`;

  return {
    quoted: moves.length,
    missing,
    advancing,
    declining,
    unchanged,
    averageMove,
    windowAverage,
    windowSessions: Math.round(mean(sessionCounts) ?? 0),
    spread,
    best: extreme((row) => row.changePercent, "max"),
    worst: extreme((row) => row.changePercent, "min"),
    windowBest: extreme((row) => row.windowChangePercent, "max"),
    windowWorst: extreme((row) => row.windowChangePercent, "min"),
    concentration,
    claim: {
      grade,
      basis,
      limits:
        "הרוחב נמדד על ארבע-עשרה החברות שהעמוד עוקב אחריהן, לא על הבורסה — " +
        "בתל אביב נסחרות מאות ניירות, והממוצע כאן הוא שווה-משקל ולא משוקלל " +
        "לפי שווי שוק כמו המדד. הפער בין השניים מצביע על ריכוזיות ואינו " +
        "מודד אותה: סל של ארבע-עשרה מניות אינו סל של שלושים וחמש. כשהבורסה " +
        "סגורה המדידה מתארת את המסחר האחרון שהתקיים, לא את היום הנוכחי.",
    },
  };
}

/* ------------------------------------------------------------------ */
/* 2 — Where the move was                                              */
/* ------------------------------------------------------------------ */

export type SectorRead = {
  sector: string;
  names: LocalName[];
  /** How many of them returned a price. */
  quoted: number;
  advancing: number;
  averageMove: number | null;
  windowAverage: number | null;
  /** How many of the sector's names also trade in New York. */
  dualListed: number;
  /**
   * The sector's share of the list handed in, as 0 to 1.
   *
   * Of the list handed in, not of the curated fourteen. A name whose quote
   * failed is not in any sector here, and measuring its share against a
   * denominator that still counts it would print a percentage that does not
   * match the rows on screen.
   */
  share: number;
};

/**
 * The sectors, each with a figure.
 *
 * The page used to open a whole `Section` per sector — seven headings over
 * lists of one to five rows, and not one number describing the group. A
 * reader scanning for "where did today happen" had to average five rows in
 * their head, per sector, which is a thing no reader does.
 *
 * Ordered by today's move rather than by size, because the question this
 * table answers is where the day went. Size is a column, so the reader can
 * see that the sector at the top is two companies.
 */
export function readSectors(names: LocalName[], quoted: number): SectorRead[] {
  const order = [...new Set(names.map((row) => row.sector))];

  const reads = order.map((sector) => {
    const rows = names.filter((row) => row.sector === sector);
    const moves = known(rows.map((row) => row.changePercent));

    return {
      sector,
      names: rows,
      quoted: moves.length,
      advancing: moves.filter((move) => move > FLAT).length,
      averageMove: mean(moves),
      windowAverage: mean(known(rows.map((row) => row.windowChangePercent))),
      dualListed: rows.filter((row) => row.usTicker !== undefined).length,
      share: quoted > 0 ? rows.length / quoted : 0,
    };
  });

  /* Nulls last rather than sorted as zero. A sector whose only name failed
     to quote is not a flat sector, and letting it sort into the middle of
     the table says it is. */
  return reads.sort((a, b) => {
    if (a.averageMove === null && b.averageMove === null) return 0;
    if (a.averageMove === null) return 1;
    if (b.averageMove === null) return -1;
    return b.averageMove - a.averageMove;
  });
}

/* ------------------------------------------------------------------ */
/* 3 — What it did to a reader who spends shekels                       */
/* ------------------------------------------------------------------ */

/**
 * A dollar return, restated in the currency the reader lives in.
 *
 * ILS=X is shekels per dollar, so a rise in it is a stronger dollar, and a
 * stronger dollar adds to the shekel value of a dollar asset. The two
 * moves compound rather than add — an 8% gain alongside a 5% weaker dollar
 * is 2.6%, not 3% — and the difference is the whole reason this is
 * computed in one place rather than approximated in a page.
 */
export function inShekels(
  assetPercent: number | null,
  ratePercent: number | null,
): number | null {
  if (assetPercent === null || ratePercent === null) return null;
  if (!Number.isFinite(assetPercent) || !Number.isFinite(ratePercent)) return null;
  return ((1 + assetPercent / 100) * (1 + ratePercent / 100) - 1) * 100;
}

export type Translation = {
  symbol: string;
  name: string;
  /** The move in the asset's own currency. */
  localPercent: number | null;
  /** The same move after the day's change in the exchange rate. */
  shekelPercent: number | null;
};

export type ShekelRead = {
  rate: number | null;
  changePercent: number | null;
  yearLow: number | null;
  yearHigh: number | null;
  /** Where the rate sits in its own year, as 0 to 1. */
  position: number | null;
  /** The dollar assets, restated. */
  translated: Translation[];
  /**
   * The reference the headline and the comparison are built on.
   *
   * Named here rather than re-derived by the view. Picking "the first one
   * that could be converted" twice, in two files, is how a panel ends up
   * quoting a figure for one index under the name of another.
   */
  leadName: string | null;
  /** The local index, which needs no restating — it is already shekels. */
  local: { name: string; percent: number | null } | null;
  /**
   * The gap between the best-known dollar asset in shekel terms and the
   * local index, in percentage points. Null unless both are known.
   */
  difference: number | null;
  headline: string;
  claim: GradedClaim;
};

export function readShekel({
  rate,
  changePercent,
  yearLow,
  yearHigh,
  references,
  local,
}: {
  rate: number | null;
  changePercent: number | null;
  yearLow: number | null;
  yearHigh: number | null;
  /** Dollar-denominated instruments to restate. */
  references: { symbol: string; name: string; changePercent: number | null }[];
  local: { name: string; percent: number | null } | null;
}): ShekelRead {
  const translated: Translation[] = references.map((reference) => ({
    symbol: reference.symbol,
    name: reference.name,
    localPercent: reference.changePercent,
    shekelPercent: inShekels(reference.changePercent, changePercent),
  }));

  /* The first reference that could actually be restated carries the
     headline. Which one that is matters less than that the sentence names
     it — "a US index" would be the kind of unattributed figure this
     project treats as a lie by omission. */
  const lead =
    translated.find(
      (row): row is Translation & { localPercent: number; shekelPercent: number } =>
        row.localPercent !== null && row.shekelPercent !== null,
    ) ?? null;

  const localPercent =
    local !== null && local.percent !== null && Number.isFinite(local.percent)
      ? local.percent
      : null;

  const difference =
    lead !== null && localPercent !== null ? lead.shekelPercent - localPercent : null;

  const headline =
    rate === null
      ? "שער הדולר לא התקבל, ולכן אי אפשר להציג תשואה דולרית בשקלים."
      : changePercent === null
        ? `השער עומד על ${isolated(`₪${rate.toFixed(3)}`)}, אך השינוי היומי לא התקבל — תשואה דולרית מוצגת כאן בדולר בלבד.`
        : lead === null
          ? `הדולר ${changePercent >= 0 ? "התחזק" : "נחלש"} ב-${isolated(
              `${Math.abs(changePercent).toFixed(2)}%`,
            )} היום. אין כרגע ציטוט של מדד אמריקאי להמיר.`
          : `${lead.name} ${signed(lead.localPercent)} בדולר. אחרי שינוי של ${signed(changePercent)} בשער הדולר, זה ${signed(lead.shekelPercent)} עבור מי שמודד בשקלים.`;

  /* Both legs are prints and the compounding is arithmetic, so the
     translation is confirmed. What is not confirmed, and is said in the
     limits, is that the two prints cover the same hours. */
  const grade: Grade =
    rate === null || changePercent === null || lead === null
      ? "speculative"
      : "confirmed";

  return {
    rate,
    changePercent,
    yearLow,
    yearHigh,
    position: rangePosition(rate, yearLow, yearHigh),
    translated,
    leadName: lead?.name ?? null,
    local,
    difference,
    headline,
    claim: {
      grade,
      basis:
        rate === null
          ? "אין שער חליפין"
          : `שער ${isolated(`₪${rate.toFixed(3)}`)} לדולר${
              changePercent === null ? "" : ` · ${signed(changePercent)} היום`
            } · ${translated.filter((row) => row.shekelPercent !== null).length} נכסים דולריים הומרו`,
      limits:
        "ההמרה היא אריתמטיקה על שני מחירים ואינה תחזית. שתי המדידות אינן " +
        "מכסות אותן שעות: שער הדולר נסחר כמעט כל היממה, מדד אמריקאי נמדד " +
        "על פני מסחר של שש וחצי שעות, ומדד תל אביב ננעל כחמש שעות קודם. " +
        "בנוסף, זו המרה של יום אחד — מי שמחזיק נכס דולרי לטווח ארוך נושא " +
        "את שינוי השער המצטבר, לא את זה של היום. אין כאן המלצה לגדר מטבע " +
        "או להימנע מגידור.",
    },
  };
}
