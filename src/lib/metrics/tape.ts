/**
 * The tape: what the volume did, and where it actually traded.
 *
 * The site could already describe the price — the stage, the trend
 * template, the contraction, the distance to the fifty-day — and could say
 * almost nothing about the volume underneath it. `technical.readVolume`
 * answers one narrow question (did volume dry up at the end of a base) and
 * `levels.readFlow` answers another (what share of the window's shares
 * traded on up days). Neither reads a bar.
 *
 * Reading a bar is the oldest idea in this subject and still the sharpest.
 * Volume is the effort, the bar's range and its close are the result, and
 * the interesting days are the ones where the two disagree: enormous
 * activity that moved nothing, or a wide advance that nobody turned up
 * for. The vocabulary for this is Wyckoff's and the thresholds in the
 * literature are adjectives — "abnormal", "narrow", "well off the low". A
 * site cannot render an adjective, so every one of them is a number here,
 * the number is stated, and it is measured against the instrument's own
 * distribution rather than against a constant that would mean something
 * different on a utility than on a biotech.
 *
 * THREE THINGS THIS FILE REFUSES TO DO.
 *
 * It does not name a participant. A heavy bar with a narrow range is
 * recorded as a heavy bar with a narrow range. Calling it "institutional
 * accumulation" would convert an observation into a claim about who was on
 * the other side, which the tape does not carry and 13F reports a quarter
 * late. The same discipline `levels.ts` already keeps.
 *
 * It does not score, rank or recommend. Each reading is an event with a
 * date attached. What the events have been worth on this instrument is a
 * separate question, answered by counting — `base-rates.ts` measures the
 * volume conditions defined here the same way it measures the fifty-day,
 * and that measurement is what gets rendered beside them. Rule 8: the
 * reader is handed the argument.
 *
 * And it prints its assumptions. The volume profile below is built from
 * daily bars, which means the within-day distribution has to be assumed,
 * and the assumption is wrong in a knowable direction. That sentence ships
 * inside the data (`profileCaveat`) so no page can draw the chart without
 * it. Rule 9.
 */

import type { Candle } from "@/lib/sources/prices";
import { marketStatus, newYorkDate } from "@/lib/market-hours";

/* ------------------------------------------------------------------ */
/* Distributions                                                       */
/* ------------------------------------------------------------------ */

/**
 * How long "normal for this instrument" is measured over.
 *
 * A trading year. Shorter and a quiet autumn redefines normal; longer and
 * a company that doubled its float three years ago is still being compared
 * against the volume it traded before. Both failures are real and this is
 * the span where neither dominates.
 */
export const NORMAL_WINDOW = 252;

/** The baseline a single bar's volume is divided by. Fifty sessions is the
 *  convention and it is also roughly a quarter, so one earnings reaction
 *  does not sit in the baseline of the next one for long. */
const BASELINE = 50;

/** Share of values at or below `value`, 0..1. Null when the sample is too
 *  short to rank against — a percentile over nine observations is a
 *  ranking of nine things wearing a statistic's clothes. */
function percentileOf(values: number[], value: number): number | null {
  if (values.length < 30) return null;
  let below = 0;
  for (const v of values) if (v <= value) below++;
  return below / values.length;
}

function mean(values: number[]): number {
  if (values.length === 0) return 0;
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

function stdDev(values: number[], average: number): number {
  if (values.length < 2) return 0;
  let sum = 0;
  for (const v of values) sum += (v - average) * (v - average);
  return Math.sqrt(sum / (values.length - 1));
}

/** Average volume over the `BASELINE` bars before `index`. Null when there
 *  is not that much history behind the bar. */
function baselineVolume(candles: Candle[], index: number): number | null {
  if (index < BASELINE) return null;
  let sum = 0;
  for (let i = index - BASELINE; i < index; i++) sum += candles[i].volume;
  const average = sum / BASELINE;
  return average > 0 ? average : null;
}

/* ------------------------------------------------------------------ */
/* One bar                                                             */
/* ------------------------------------------------------------------ */

/**
 * What a single session looked like, named for what it shows.
 *
 * Each label is a shape, not an intention. "Absorption" means a great deal
 * of volume produced almost no net movement; whether somebody was
 * absorbing supply is an interpretation the reader is welcome to make and
 * this file will not make for them.
 */
export type BarCharacter =
  /** Extreme volume, a wide range, and a close that rejected the extreme
   *  the bar reached. The classic end-of-move bar. */
  | "climax"
  /** Extreme volume and a narrow range: the effort went in and the price
   *  did not come out. */
  | "absorption"
  /** Heavy volume, wide range, close at the far end — effort and result
   *  agreeing. The only bar here where nothing is in conflict. */
  | "thrust"
  /** An up close on volume in the bottom quarter of normal. The advance
   *  happened without participation. */
  | "no-demand"
  /** A down close on volume in the bottom quarter of normal. */
  | "no-supply"
  /** Heavy volume, ordinary range, close in the middle. Activity with no
   *  direction to it. */
  | "churn"
  /** Nothing abnormal in either dimension. Most days. */
  | "quiet";

export type BarRead = {
  date: string;
  /** Volume against the fifty-session average before it. */
  volumeRatio: number;
  /** Where that volume ranks in the trailing year, 0..1. Null when the
   *  history behind the bar is too short to rank it. */
  volumePercentile: number | null;
  /** The bar's high-low range as a share of its close, and where that
   *  ranks in the same window. */
  rangePercent: number;
  rangePercentile: number | null;
  /** Where in its own range the bar closed. 1 is on the high, 0 on the
   *  low, 0.5 in the middle. */
  closePosition: number;
  /** Close against the previous close. */
  changePercent: number;
  character: BarCharacter;
  /**
   * Effort and result as standard scores over the trailing year, and the
   * distance between them.
   *
   * This is the measurement the adjectives in the literature are standing
   * in for. Effort is the volume; result is the distance the bar actually
   * travelled net of where it started. When effort is two deviations above
   * normal and result is half a deviation below, that gap is the finding —
   * and it is a number rather than a judgement, so the next section can
   * count how often it has been followed by anything.
   */
  effortZ: number;
  resultZ: number;
  /** effortZ − resultZ. Positive is effort that did not convert. */
  gapZ: number;
};

/* The thresholds. Each is a percentile of the instrument's own trailing
   year rather than a constant, because "heavy" on a megacap and "heavy" on
   a thinly traded industrial are different numbers of shares and the same
   rank.

   THE FIRST SET WAS TOO LOOSE, AND THE MEASUREMENT SAID SO. Heavy at the
   80th percentile and wide at the 75th put a "thrust" on 250 of 2,500
   sessions — one day in ten. `base-rates.ts` opens by insisting its
   conditions are events rather than states, because a state counts the
   same advance hundreds of times and reports the trend it was riding. A
   bar that occurs every other week is a state wearing an event's name, so
   the thresholds moved until the counts matched the claim. Rarity is not
   the goal; being an occurrence a reader could point at is. */

/** Top 3% of the year. The literature's "abnormal" or "ultra-high". */
const EXTREME_VOLUME = 0.97;
/** Top 10%. "Heavy". */
const HEAVY_VOLUME = 0.9;
/** Bottom 15%. "Dry", "no interest". */
const DRY_VOLUME = 0.15;
/** Top 15% of the year's ranges. "Wide spread". */
const WIDE_RANGE = 0.85;
/** Bottom 20%. "Narrow spread". */
const NARROW_RANGE = 0.2;
/** How near an end of its own range a close has to be to count as having
 *  finished there. A quarter rather than the conventional third: at a
 *  third, a bar that closed barely above its midpoint counted as having
 *  finished at the top, which is most of why `thrust` was firing on
 *  everything. */
const END_QUARTER = 0.25;

/** How far price has to have travelled over the prior month for a wide
 *  high-volume bar to be a climax rather than just a wide high-volume bar.
 *
 *  This is the condition the books state in words and no indicator
 *  implements: a selling climax happens "after a sustained markdown".
 *  Without it the label fires in the middle of a range, where nothing is
 *  being climaxed, and the measured track record is correspondingly
 *  meaningless — which is exactly what the first run showed. */
const CLIMAX_PRIOR_MOVE = 8;
const CLIMAX_LOOKBACK = 20;

/**
 * Read one bar against the year behind it.
 *
 * Returns null rather than guessing when there is not enough history for
 * the baseline, which is the whole of rule 9 applied to a single row: a
 * ratio against an average of eleven days is a number that looks like the
 * others and is not one.
 */
export function readBar(candles: Candle[], index: number): BarRead | null {
  const candle = candles[index];
  const previous = candles[index - 1];
  if (!candle || !previous) return null;

  const average = baselineVolume(candles, index);
  if (!average) return null;

  const from = Math.max(0, index - NORMAL_WINDOW);
  const history = candles.slice(from, index);
  if (history.length < 30) return null;

  const volumeRatio = candle.volume / average;
  const volumePercentile = percentileOf(
    history.map((c) => c.volume),
    candle.volume,
  );

  const range = candle.high - candle.low;
  const rangePercent = candle.close > 0 ? (range / candle.close) * 100 : 0;
  const rangePercentile = percentileOf(
    history.map((c) => (c.close > 0 ? ((c.high - c.low) / c.close) * 100 : 0)),
    rangePercent,
  );

  /* A bar with no range cannot say where it closed inside itself, and
     dividing by zero would say so with great confidence. */
  const closePosition = range > 0 ? (candle.close - candle.low) / range : 0.5;
  const changePercent =
    previous.close > 0
      ? ((candle.close - previous.close) / previous.close) * 100
      : 0;

  /* Effort and result as standard scores. Result is the absolute move:
     the question is whether the bar travelled, not which way, because a
     huge down day on huge volume is effort converting perfectly well. */
  const volumes = history.map((c) => c.volume);
  const volumeMean = mean(volumes);
  const volumeSd = stdDev(volumes, volumeMean);
  const moves = history.map((c, i) => {
    const prior = history[i - 1];
    return prior && prior.close > 0
      ? Math.abs((c.close - prior.close) / prior.close) * 100
      : 0;
  });
  const moveMean = mean(moves);
  const moveSd = stdDev(moves, moveMean);

  const effortZ = volumeSd > 0 ? (candle.volume - volumeMean) / volumeSd : 0;
  const resultZ =
    moveSd > 0 ? (Math.abs(changePercent) - moveMean) / moveSd : 0;

  return {
    date: candle.date,
    volumeRatio,
    volumePercentile,
    rangePercent,
    rangePercentile,
    closePosition,
    changePercent,
    character: classify(
      volumePercentile,
      rangePercentile,
      closePosition,
      changePercent,
      priorMovePercent(candles, index),
      quieterThanPriorTwo(candles, index),
    ),
    effortZ,
    resultZ,
    gapZ: effortZ - resultZ,
  };
}

/** Price change over the twenty sessions before `index`, in percent. The
 *  context a climax needs: what the bar is climaxing. */
function priorMovePercent(candles: Candle[], index: number): number {
  const from = index - CLIMAX_LOOKBACK;
  if (from < 0) return 0;
  const start = candles[from].close;
  const end = candles[index - 1]?.close;
  if (!start || !end || start <= 0) return 0;
  return ((end - start) / start) * 100;
}

/**
 * Whether this bar traded less than each of the two before it.
 *
 * The actual definition of a no-demand bar, and the part an indicator
 * built only on percentiles misses. The book's test is not "volume was
 * low in absolute terms" — it is that the market rose on LESS activity
 * than it had just been showing, which is a comparison with the immediate
 * neighbours rather than with the year.
 */
function quieterThanPriorTwo(candles: Candle[], index: number): boolean {
  const a = candles[index - 1];
  const b = candles[index - 2];
  if (!a || !b) return false;
  return candles[index].volume < a.volume && candles[index].volume < b.volume;
}

/**
 * The taxonomy, in the order the tests have to run.
 *
 * Order matters and it is not arbitrary. A bar can satisfy more than one
 * description — an extreme-volume bar with a narrow range is both "heavy"
 * and "narrow" — so the more specific reading is taken first and the
 * generic ones catch what is left. A bar that is extreme in volume and
 * tight in range is absorption, not churn, and reporting it as churn would
 * lose the only interesting thing about it.
 */
function classify(
  volumePercentile: number | null,
  rangePercentile: number | null,
  closePosition: number,
  changePercent: number,
  priorMove: number,
  quieter: boolean,
): BarCharacter {
  /* Without a rank there is no "abnormal" to speak of, and every label
     below is a statement about abnormality. */
  if (volumePercentile === null || rangePercentile === null) return "quiet";

  const extreme = volumePercentile >= EXTREME_VOLUME;
  const heavy = volumePercentile >= HEAVY_VOLUME;
  const dry = volumePercentile <= DRY_VOLUME;
  const wide = rangePercentile >= WIDE_RANGE;
  const narrow = rangePercentile <= NARROW_RANGE;

  /* Extreme effort, a wide bar, a close that gave back the end it reached,
     and a month of travel behind it for the bar to be the end OF. Both
     directions: a bar that collapsed from its high after a run and one
     that recovered off its low after a slide are the same event seen from
     either side, which is why the test is on the size of the prior move
     and not on its sign. */
  if (
    extreme &&
    wide &&
    Math.abs(priorMove) >= CLIMAX_PRIOR_MOVE &&
    closePosition >= END_QUARTER &&
    closePosition <= 1 - END_QUARTER
  ) {
    return "climax";
  }
  /* Extreme effort, nothing to show for it. */
  if (extreme && narrow) return "absorption";
  /* Everything agreeing: heavy, wide, and finished at the end it was
     heading for. */
  if (
    heavy &&
    wide &&
    (closePosition >= 1 - END_QUARTER || closePosition <= END_QUARTER)
  ) {
    return "thrust";
  }
  /* The two quiet readings. Three tests, not two: the close's direction
     separates them, the narrow range makes either worth recording — a wide
     bar on low volume is a gap, not a statement about interest — and the
     comparison with the two previous bars is the book's actual test, that
     the move happened on LESS activity than the market had just been
     showing rather than merely on a low number. */
  if (dry && narrow && quieter && changePercent > 0) return "no-demand";
  if (dry && narrow && quieter && changePercent < 0) return "no-supply";
  /* Heavy and went nowhere in particular. */
  if (heavy && !wide) return "churn";
  return "quiet";
}

/** What each character is, in the reader's language. Shapes, never
 *  intentions — see the note on `BarCharacter`. */
export const CHARACTER_LABELS: Record<BarCharacter, string> = {
  climax: "מחזור קיצוני, טווח רחב, וסגירה שהחזירה את הקצה שהנר הגיע אליו",
  absorption: "מחזור קיצוני בטווח צר — מאמץ שלא הזיז מחיר",
  thrust: "מחזור כבד, טווח רחב, וסגירה בקצה — מאמץ ותוצאה מסכימים",
  "no-demand": "סגירה חיובית על מחזור ברבעון התחתון — עלייה בלי השתתפות",
  "no-supply": "סגירה שלילית על מחזור ברבעון התחתון",
  churn: "מחזור כבד בטווח רגיל וסגירה באמצע — פעילות בלי כיוון",
  quiet: "לא חריג במחזור ולא בטווח",
};

/* ------------------------------------------------------------------ */
/* Where the volume traded                                             */
/* ------------------------------------------------------------------ */

export type VolumeShelf = {
  /** Middle of the price bin. */
  price: number;
  /** Share of the window's volume that the bin holds, 0..1. */
  share: number;
  /** Signed distance from the last close, in percent. */
  distancePercent: number;
};

export type VolumeProfile = {
  /** Sessions the profile was built from. */
  window: number;
  bins: number;
  /** The price bin that holds more volume than any other. */
  poc: number;
  /** The band around the POC holding `valueAreaShare` of the volume. */
  valueAreaHigh: number;
  valueAreaLow: number;
  valueAreaShare: number;
  /** Where the last close sits against that band. */
  position: "above-value" | "in-value" | "below-value";
  /** Lowest and highest price the window covered — the axis the histogram
   *  below is drawn against. */
  low: number;
  high: number;
  /** Every bin's share of the window's volume, lowest price first. Fifty
   *  numbers, which is small enough to ship and the only way a page can
   *  draw the shape rather than describe it. The shelves below are the
   *  same data read as a list. */
  histogram: number[];
  /** The heaviest bins, nearest the close first. */
  shelves: VolumeShelf[];
  /** Stretches of price that hold very little of the window's volume. Not
   *  a prediction — a description of where the window spent no time. */
  thin: { from: number; to: number; share: number }[];
  /** The assumption this was built on, in the reader's language. Carried
   *  in the data so a page cannot render the profile without it. */
  caveat: string;
};

/** Enough bins to see a shelf, few enough that each one holds a countable
 *  share of the volume. Fifty over a year of range puts a typical bin
 *  around a day's move wide. */
const BINS = 50;

/** The conventional value area. Seventy per cent of the volume, grown out
 *  from the POC a row at a time. */
const VALUE_AREA = 0.7;

/** Under this share, a bin is somewhere price passed through rather than
 *  somewhere it traded. */
const THIN_BIN = 0.004;

/**
 * Where the volume of the last `window` sessions actually changed hands.
 *
 * THE ASSUMPTION, STATED. A real volume profile is built from intraday
 * prints: every trade at the price it happened. Daily bars do not carry
 * that, so each session's volume has to be spread across its own high-low
 * range, and this spreads it evenly. That is wrong in a direction worth
 * knowing — real sessions trade more heavily near the open and the close
 * than in the middle of the range — so the POC this produces is a
 * reasonable centre of gravity and is not the exact price with the most
 * volume. Anyone treating it as the latter is reading more precision than
 * daily data contains, which is why `caveat` ships inside the object.
 *
 * What it is good for is the shape: whether a year of trading piled up in
 * one band or spread evenly, where the shelves are, and which stretches
 * price crossed without doing business. Those survive the assumption,
 * because they are about the range each day covered rather than about
 * where inside the day the shares traded.
 */
export function volumeProfile(
  candles: Candle[],
  window = NORMAL_WINDOW,
): VolumeProfile | null {
  if (candles.length < 60) return null;
  const rows = candles.slice(-window);
  const lastClose = rows[rows.length - 1].close;

  let low = Infinity;
  let high = -Infinity;
  for (const c of rows) {
    if (c.low < low) low = c.low;
    if (c.high > high) high = c.high;
  }
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) return null;

  const width = (high - low) / BINS;
  const bins = new Array<number>(BINS).fill(0);
  let total = 0;

  for (const c of rows) {
    total += c.volume;
    /* A session with no range traded entirely at one price. Everything
       else is spread across the bins its range covers, weighted by how
       much of the bin the range overlaps — so a bar covering two and a
       half bins gives the half-bin half as much as the whole ones. */
    if (c.high <= c.low) {
      const only = Math.min(BINS - 1, Math.max(0, Math.floor((c.close - low) / width)));
      bins[only] += c.volume;
      continue;
    }
    const first = Math.max(0, Math.floor((c.low - low) / width));
    const last = Math.min(BINS - 1, Math.floor((c.high - low) / width));
    const span = c.high - c.low;
    for (let b = first; b <= last; b++) {
      const binLow = low + b * width;
      const binHigh = binLow + width;
      const overlap = Math.min(c.high, binHigh) - Math.max(c.low, binLow);
      if (overlap > 0) bins[b] += c.volume * (overlap / span);
    }
  }
  if (total <= 0) return null;

  const centre = (b: number) => low + (b + 0.5) * width;

  let pocBin = 0;
  for (let b = 1; b < BINS; b++) if (bins[b] > bins[pocBin]) pocBin = b;

  /* The value area, grown from the POC the way the exchanges define it:
     at each step take whichever neighbour — above or below — holds more
     volume, until the band holds seventy per cent of the total. */
  let lowBin = pocBin;
  let highBin = pocBin;
  let held = bins[pocBin];
  const target = total * VALUE_AREA;
  while (held < target && (lowBin > 0 || highBin < BINS - 1)) {
    const above = highBin < BINS - 1 ? bins[highBin + 1] : -1;
    const below = lowBin > 0 ? bins[lowBin - 1] : -1;
    if (above >= below) {
      highBin++;
      held += Math.max(0, above);
    } else {
      lowBin--;
      held += Math.max(0, below);
    }
  }

  const valueAreaLow = low + lowBin * width;
  const valueAreaHigh = low + (highBin + 1) * width;

  const shelves: VolumeShelf[] = bins
    .map((volume, b) => ({
      price: centre(b),
      share: volume / total,
      distancePercent: ((centre(b) - lastClose) / lastClose) * 100,
    }))
    .sort((a, b) => b.share - a.share)
    .slice(0, 6)
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent));

  /* Consecutive thin bins merged into stretches, so a reader sees one gap
     rather than four adjacent rows each saying the same thing. */
  const thin: { from: number; to: number; share: number }[] = [];
  let run: { from: number; to: number; share: number } | null = null;
  for (let b = 0; b < BINS; b++) {
    const share = bins[b] / total;
    if (share <= THIN_BIN) {
      const binLow = low + b * width;
      const binHigh = binLow + width;
      if (run) {
        run.to = binHigh;
        run.share += share;
      } else {
        run = { from: binLow, to: binHigh, share };
      }
    } else if (run) {
      thin.push(run);
      run = null;
    }
  }
  if (run) thin.push(run);

  return {
    window: rows.length,
    bins: BINS,
    poc: centre(pocBin),
    valueAreaHigh,
    valueAreaLow,
    valueAreaShare: VALUE_AREA,
    position:
      lastClose > valueAreaHigh
        ? "above-value"
        : lastClose < valueAreaLow
          ? "below-value"
          : "in-value",
    low,
    high,
    histogram: bins.map((v) => v / total),
    shelves,
    thin: thin.filter((t) => (t.to - t.from) / lastClose > 0.01).slice(0, 4),
    caveat:
      "הפרופיל נבנה מנרות יומיים, ולכן מחזור כל יום מפוזר באופן אחיד על פני הטווח שלו. " +
      "מסחר אמיתי מתרכז בפתיחה ובנעילה, כך שה-POC הוא מרכז כובד ולא מחיר מדויק.",
  };
}

/* ------------------------------------------------------------------ */
/* On-balance volume                                                   */
/* ------------------------------------------------------------------ */

export type ObvRead = {
  /** The series, aligned to the candles it was built from. */
  latest: number;
  /** Change over the comparison window, as a share of the window's own
   *  absolute movement — a unitless figure, because OBV's own units are
   *  share counts and mean nothing across instruments. */
  slope: number;
  /**
   * Price and OBV disagreeing about the same two swings.
   *
   * "bearish" means price made a higher high over the window and OBV did
   * not; "bullish" the mirror. Null means they agreed, which is the
   * ordinary case and is reported as such rather than hidden.
   */
  divergence: "bearish" | "bullish" | null;
  window: number;
};

/**
 * On-balance volume, and whether it is going the same way as the price.
 *
 * The indicator itself is arithmetic from 1963: add the day's volume when
 * the close is up, subtract it when it is down. Its level is meaningless —
 * it depends entirely on where the series was started — so nothing here
 * reports the level as if it were a price. What is readable is the
 * disagreement: a price that has made a higher high while the running
 * total has not says the second advance was carried on less volume than
 * the first.
 *
 * That is an observation about two windows of arithmetic, not a forecast,
 * and like everything else in this file what it has been followed by on
 * this instrument is measured separately and printed beside it.
 */
export function readObv(candles: Candle[], window = 60): ObvRead | null {
  if (candles.length < window + 2) return null;

  const obv: number[] = [0];
  for (let i = 1; i < candles.length; i++) {
    const change = candles[i].close - candles[i - 1].close;
    obv.push(
      obv[i - 1] + (change > 0 ? candles[i].volume : change < 0 ? -candles[i].volume : 0),
    );
  }

  const rows = candles.slice(-window);
  const tail = obv.slice(-window);
  const half = Math.floor(window / 2);

  const priceFirst = Math.max(...rows.slice(0, half).map((c) => c.high));
  const priceSecond = Math.max(...rows.slice(half).map((c) => c.high));
  const priceLowFirst = Math.min(...rows.slice(0, half).map((c) => c.low));
  const priceLowSecond = Math.min(...rows.slice(half).map((c) => c.low));
  const obvFirstHigh = Math.max(...tail.slice(0, half));
  const obvSecondHigh = Math.max(...tail.slice(half));
  const obvFirstLow = Math.min(...tail.slice(0, half));
  const obvSecondLow = Math.min(...tail.slice(half));

  let divergence: ObvRead["divergence"] = null;
  if (priceSecond > priceFirst && obvSecondHigh <= obvFirstHigh) divergence = "bearish";
  else if (priceLowSecond < priceLowFirst && obvSecondLow >= obvFirstLow) {
    divergence = "bullish";
  }

  /* Normalised by the total volume of the window, which makes the figure
     comparable between a megacap and a small cap. */
  const traded = rows.reduce((sum, c) => sum + c.volume, 0);
  const slope = traded > 0 ? (tail[tail.length - 1] - tail[0]) / traded : 0;

  return { latest: obv[obv.length - 1], slope, divergence, window: rows.length };
}

/* ------------------------------------------------------------------ */
/* The composite                                                       */
/* ------------------------------------------------------------------ */

/**
 * Whether the final candle is a finished session.
 *
 * The bug this exists to prevent was visible within a minute of the panel
 * first rendering: at half past ten in New York, NVDA's "last bar" read
 * 0.2x its average volume at the zeroth percentile of the year, and the
 * tape duly called it a day of no interest. It was not a day of no
 * interest. It was a day that was two hours old.
 *
 * Every threshold in this file compares one session's volume against a
 * year of completed sessions, so a partial bar is not merely imprecise —
 * it is guaranteed to land at the bottom of the distribution, on every
 * name, for the whole trading day. The reading would have been wrong far
 * more often than right.
 *
 * So a candle dated today in New York is dropped while the regular session
 * is still ahead or under way, and `through` says which session was
 * actually read. After the close it is a complete bar and is kept.
 */
export function completeSessions(candles: Candle[]): {
  rows: Candle[];
  droppedPartial: boolean;
} {
  const last = candles[candles.length - 1];
  if (!last) return { rows: candles, droppedPartial: false };
  const state = marketStatus().state;
  const live = state === "open" || state === "pre";
  if (live && last.date.slice(0, 10) === newYorkDate()) {
    return { rows: candles.slice(0, -1), droppedPartial: true };
  }
  return { rows: candles, droppedPartial: false };
}

export type TapeRead = {
  sessions: number;
  /** The last session that had actually finished when this was read. */
  through: string | null;
  /** True when today's incomplete bar was set aside — see
   *  `completeSessions`. Rendered, because a reader looking at a panel
   *  dated yesterday deserves to know why. */
  droppedPartial: boolean;
  /** The most recent session, read. Null when history is too short. */
  latest: BarRead | null;
  /**
   * The abnormal sessions in the recent window, newest first.
   *
   * Only bars whose character is something other than `quiet`, because a
   * list of ordinary days is a list of every day. Capped, because a reader
   * scanning twenty entries is not reading any of them.
   */
  notable: BarRead[];
  /** How many sessions `notable` was drawn from. */
  notableWindow: number;
  profile: VolumeProfile | null;
  obv: ObvRead | null;
  /**
   * Volume over the last ten sessions against the fifty before them.
   *
   * The plainest question about volume and the one most often asked: is
   * participation rising or falling. Under 1 is a contraction.
   */
  trend: number | null;
  caveats: string[];
};

/** How far back the notable list looks. A quarter: long enough to hold the
 *  last earnings reaction, short enough that everything in it is still
 *  about the move the reader is looking at. */
const NOTABLE_WINDOW = 63;

/** Most of a quarter can be abnormal in a violent market. Six is what fits
 *  in a panel and a reader can hold. */
const NOTABLE_LIMIT = 6;

export function readTape(input: Candle[]): TapeRead {
  const { rows: candles, droppedPartial } = completeSessions(input);

  const empty: TapeRead = {
    sessions: candles.length,
    through: candles[candles.length - 1]?.date ?? null,
    droppedPartial,
    latest: null,
    notable: [],
    notableWindow: 0,
    profile: null,
    obv: null,
    trend: null,
    caveats: ["אין די היסטוריה למדידת מחזור מול התפלגות משלה."],
  };
  /* The baseline needs fifty sessions, the percentile needs thirty behind
     that, and a year is what "normal" is defined against. Below this the
     readings exist arithmetically and mean nothing. */
  if (candles.length < BASELINE + 40) return empty;

  const latest = readBar(candles, candles.length - 1);

  const notable: BarRead[] = [];
  const from = Math.max(BASELINE, candles.length - NOTABLE_WINDOW);
  for (let i = candles.length - 1; i >= from; i--) {
    const bar = readBar(candles, i);
    if (bar && bar.character !== "quiet") notable.push(bar);
    if (notable.length >= NOTABLE_LIMIT) break;
  }

  const recent = candles.slice(-10);
  const base = candles.slice(-60, -10);
  const recentAverage = mean(recent.map((c) => c.volume));
  const baseAverage = mean(base.map((c) => c.volume));

  return {
    sessions: candles.length,
    through: candles[candles.length - 1].date,
    droppedPartial,
    latest,
    notable,
    notableWindow: candles.length - from,
    profile: volumeProfile(candles),
    obv: readObv(candles),
    trend: baseAverage > 0 ? recentAverage / baseAverage : null,
    caveats: [
      "כל סף כאן הוא אחוזון מתוך השנה האחרונה של אותו נייר, לא מספר קבוע — " +
        "״כבד״ על מגה-קאפ ו״כבד״ על מניה דלילה הם אותו דירוג ולא אותו מספר מניות.",
      "קריאת נר היא תיאור של צורה, לא זיהוי של מי שעמד בצד השני. " +
        "הטייפ לא מוסר מי סחר.",
    ],
  };
}
