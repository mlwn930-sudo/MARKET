import { detectTickers } from "@/lib/company-names";
import { getPriceHistory } from "@/lib/sources/prices";
import { readLevels, type PriceLevel } from "@/lib/metrics/levels";
import type { Candle } from "@/lib/sources/prices";
import { readTape, type TapeRead } from "@/lib/metrics/tape";
import {
  atr,
  readTrendFor,
  readStage,
  type TrendRead,
  type StageRead,
} from "@/lib/metrics/technical";
import { readSetup, type SetupRead } from "@/lib/analysis/setup";
import { rankFor } from "@/lib/metrics/rank-store";
import type { ChartRead } from "./chart-reader";
import type { BaseRateRead } from "@/lib/metrics/base-rates";
import { baseRatesFor } from "@/lib/metrics/base-rate-store";
import { getNextEarnings } from "@/lib/sources/finnhub";
import { watchlistNews } from "@/lib/watchlist-news";

/**
 * Checks a read of a picture against the data the site already holds.
 *
 * This is the one thing a chart reader attached to a research site can do
 * that a chart reader on its own cannot. Everything the model says comes
 * from pixels: it reads a number off an axis and reports a level. Whether
 * that level exists is a separate question, and this site can answer it —
 * it has the real candles, and `metrics/levels.ts` already finds the bands
 * price actually turned at, from swing pivots rather than from a drawing.
 *
 * So the read stops being a second opinion about an image and becomes a
 * claim with a test attached. A level the model saw that the candles also
 * show is corroborated. One the candles do not show is not called wrong —
 * a chart screenshot can be an index, a crypto pair, an intraday window or
 * a timeframe this site does not carry — it is called unconfirmed, and the
 * reason is printed.
 *
 * Nothing here grades the read or scores it. It reports agreement and
 * disagreement, which is rule 8: the reader is handed the argument, not a
 * verdict about it.
 */

export type LevelCheck = {
  /** What the model read off the picture. */
  read: number;
  kind: "support" | "resistance" | "pivot";
  /** The nearest band the real candles support, when there is one close
   *  enough to be the same level rather than a different one. */
  matched: number | null;
  /** How far apart, as a percentage of the matched price. */
  driftPercent: number | null;
  /** Separate swings that reversed inside the matched band. */
  touches: number | null;
};

export type Corroboration = {
  ticker: string;
  /** Candles the check was run against, so the reader knows the window. */
  candleCount: number;
  lastClose: number;
  /** Every level the model named, with its test. */
  levels: LevelCheck[];
  /** Bands the candles show that the model did not mention. Not a failure
   *  — a screenshot may simply not reach back far enough to show them. */
  missedByRead: { price: number; kind: string; touches: number }[];
  /**
   * Every band the real candles support, in price order and whole.
   *
   * `levels` above is organised around the read — what the model named,
   * and whether the candles back it — and `missedByRead` is the leftover,
   * capped at four. Neither answers the question a person actually asks a
   * chart, which is *which prices matter and how far away are they from
   * here*. That needs one ladder rather than two lists sorted by whose
   * claim they were, so the ladder is carried separately and the read's
   * own arithmetic is left alone.
   *
   * Measured rather than drawn, and each rung keeps the count behind it:
   * a band with six touches that held five times is a different object
   * from one with two touches that broke both, and showing the price
   * without that is rule 5 in its purest form.
   */
  realLevels: PriceLevel[];
  /** The model's trend claim, against the one the candles support. */
  trend: TrendCheck;
  /** Average true range in price, so the risk arithmetic can place a
   *  stop in the instrument's own volatility rather than in a round
   *  percentage. Computed here because this is where the candles are. */
  atr: number | null;
  confirmed: number;
  unconfirmed: number;
  /**
   * What this instrument's own history did after the conditions that are
   * true on it today, and after the ones that are not yet.
   *
   * This is the half of the read the model is structurally unable to
   * supply. It is looking at pixels: it can say "price is testing the
   * fifty-day" and it cannot say what that has been followed by, because
   * nothing it has access to counted. The site counted — ten years of
   * closes per name, every occurrence, against the baseline of a random
   * day in the same window.
   *
   * It is also the only honest way to answer the question a reader
   * actually brings to a chart, which is "what are the odds". A model
   * asked that produces a number from nowhere, which is why
   * `scrubStatistic` deletes percentages out of the read. A number with a
   * sample behind it is a different object, and it is allowed to be shown.
   */
  baseRates: BaseRateRead | null;
  /**
   * The volume underneath the picture, read bar by bar.
   *
   * The half of a chart a screenshot carries worst and a model reads
   * worst. Volume sits in a strip an eighth the height of the price panel,
   * often cropped out of the image entirely, and even when it is there a
   * model can see that one bar is taller than its neighbours and cannot
   * say whether that is the ninety-eighth percentile of the year or a
   * Tuesday. Both of those require the series, and the site has it.
   *
   * So this is not a second opinion on what the model saw. It is the
   * measurement the model structurally cannot make, in the same way the
   * base rates are — and like them, every threshold is a rank within the
   * instrument's own trailing year, and every reading is a shape rather
   * than a claim about who was trading.
   */
  tape: TapeRead | null;
  /**
   * The convergence read — how many independent measured families are
   * true on this instrument at once, and where they disagree.
   *
   * The reader could already say what the picture showed, test its levels
   * against real candles, and quote a base rate for each condition it
   * named. What it could not do is the thing a person actually wants from
   * a chart: put those together and say whether anything is converging.
   * Four panels each reporting one true thing leaves that work to the
   * reader, and that work is what the site exists to do.
   *
   * The same engine the watchlist agent uses, deliberately. A setup
   * described one way in an email and another way on the page would be
   * two opinions with no way to tell which one is the site's.
   */
  setup: SetupRead | null;
  /**
   * What is happening at the company, which a picture cannot show.
   *
   * Kept beside the chart and never folded into it. The chart figures
   * are counted over ten years; a catalyst is dated and its effect on
   * this company is not measured anywhere here. Putting them in one
   * sentence would dress a calendar entry as a measurement, which is
   * the one thing this project does not do.
   */
  context: CompanyContext;
};

/**
 * The model's headline claim, tested.
 *
 * Everything else on this page got a test and the most important
 * sentence in any chart read did not. The levels are checked against
 * real bands, the volume is ranked inside the instrument's own year,
 * the conditions are counted over ten years — and *which way the thing
 * is trending*, which is the claim a reader actually carries away, was
 * taken on the word of a model that looked at a JPEG.
 *
 * It is the easiest claim to get wrong from a picture and the most
 * expensive to get wrong. A screenshot cropped to six months of a
 * two-year decline shows a clean advance. The axis can be log or
 * linear. The window can end on a bounce. None of that is visible in
 * the image, and all of it is visible in the candles.
 *
 * NO NEW FORMULA. `readTrend` and `readStage` already answer this and
 * already answer it on the company page; computing a second trend here
 * would be the one thing rule 4 forbids, and would let the chart reader
 * and the company page describe the same stock differently. Both are
 * imported, and `agreement` is the only thing this file decides.
 *
 * Disagreement is not an accusation. The image may be of a different
 * timeframe, a different instrument, or a window the site does not
 * hold — so the figures are printed and the reader is told what each
 * side measured, which is rule 8: hand over the argument, not a verdict
 * about who was right.
 */
export type TrendCheck = {
  /** What the model said the picture showed. */
  read: ChartRead["trend"];
  /** What the candles say, from the same function the company page uses. */
  measured: TrendRead["verdict"];
  stage: StageRead;
  /** Distance from the long average, and which way that average points. */
  vsAveragePercent: number | null;
  averageDirection: TrendRead["averageDirection"];
  fromHighPercent: number | null;
  fromLowPercent: number | null;
  /**
   * How the two relate.
   *
   * `qualified` is its own answer rather than a softened agreement: the
   * measured read returns `mixed` when price is above a falling average
   * or below a rising one, which is a real finding and not an absence
   * of one. A model calling that an uptrend is not wrong about the
   * picture — it is describing the half of the structure the window
   * showed.
   */
  agreement: "agrees" | "qualified" | "contradicts" | "unclear";
};

export type CompanyContext = {
  nextEarnings: { date: string; daysAway: number } | null;
  /** Catalysts and unclear stories, newest and most significant first.
   *  Noise is dropped: the queue has already judged it, and a chart
   *  reader listing every headline buries the dated event. */
  stories: {
    title: string;
    at: string;
    catalyst: string | null;
    catalystKind: "catalyst" | "noise" | "unclear" | null;
    significance: "high" | "medium" | "low";
    impact: string;
    /**
     * The OTHER companies the reading names, when it names any.
     *
     * The piece of information that decides whether a catalyst can be
     * trusted as this company's, and it was being thrown away. A story
     * reaches this list because the model read it and named this company
     * — which is the right test for "is it relevant" and the wrong one
     * for "whose catalyst is this". Measured: a Fastly upgrade arrived on
     * Take-Two's wire with `["FSLY","TTWO","DDOG"]`, because Take-Two is
     * mentioned in it, and its catalyst paragraph is about Fastly.
     *
     * The readings are written per article and cannot be split per
     * company, so the honest move is to carry the fact rather than guess
     * at a primary subject. The panel prints these beside the headline
     * and the prompt prints them too: a reader and a model both need to
     * see `FSLY · DDOG` next to a sentence about a growth wave.
     */
    otherTickers: string[];
  }[];
};

/* Two readings of the same level will never be identical: one is measured
   off an axis in a screenshot, the other off closing prices. A band within
   1.5% is the same level read twice; beyond that they are two levels, and
   calling them one would manufacture an agreement that is not there. */
const SAME_LEVEL = 0.015;

/**
 * Which company the picture is of, when that can be established.
 *
 * Only the model's own `instrument` field is searched, never the summary:
 * a read of an Nvidia chart that mentions AMD as a peer must not be
 * checked against AMD's candles. A wrong corroboration is worse than none,
 * because it looks like evidence.
 */
export function tickerFromRead(read: ChartRead): string | null {
  if (!read.instrument) return null;
  const direct = read.instrument.trim().toUpperCase();
  /* A bare symbol, which is what a chart's own title usually carries. */
  if (/^[A-Z]{1,5}$/.test(direct)) return direct;
  const found = detectTickers(read.instrument, 1);
  return found[0] ?? null;
}

export async function corroborate(
  read: ChartRead,
): Promise<Corroboration | null> {
  const ticker = tickerFromRead(read);
  if (!ticker) return null;
  if (read.levels.length === 0) return null;

  const history = await getPriceHistory(ticker).catch(() => null);
  if (!history || history.candles.length === 0) return null;

  const real = readLevels(history.candles, 8);
  if (real.length === 0) return null;

  const lastClose = history.candles[history.candles.length - 1].close;

  /* The precomputed ten-year measurement, not one taken from the two years
     of candles above: four golden crosses is not a rate, and the file the
     nightly job writes already has the long window. A ticker outside the
     research universe simply has none, and the renderer says so rather
     than measuring whatever happens to be here. */
  const baseRates = await baseRatesFor(ticker).catch(() => null);
  /* The universe rank, which is one of the five families the setup read
     counts and the only one that cannot be computed from this
     instrument alone. */
  const rank = await rankFor(ticker).catch(() => null);

  const levels: LevelCheck[] = [];
  const usedReal = new Set<number>();

  for (const level of read.levels) {
    /* The model returns the price as a string because a chart axis can
       carry a currency sign, a thousands separator or a suffix. Anything
       that is not a number simply cannot be checked. */
    const value = Number(String(level.price).replace(/[^0-9.]/g, ""));
    if (!Number.isFinite(value) || value <= 0) {
      levels.push({
        read: Number.NaN,
        kind: level.kind,
        matched: null,
        driftPercent: null,
        touches: null,
      });
      continue;
    }

    let best: (typeof real)[number] | null = null;
    let bestDrift = Infinity;
    for (const band of real) {
      const drift = Math.abs(band.price - value) / band.price;
      if (drift < bestDrift) {
        bestDrift = drift;
        best = band;
      }
    }

    if (best && bestDrift <= SAME_LEVEL) {
      usedReal.add(best.price);
      levels.push({
        read: value,
        kind: level.kind,
        matched: best.price,
        driftPercent: bestDrift * 100,
        touches: best.touches,
      });
    } else {
      levels.push({
        read: value,
        kind: level.kind,
        matched: null,
        driftPercent: null,
        touches: null,
      });
    }
  }

  const missedByRead = real
    .filter((band) => !usedReal.has(band.price))
    .slice(0, 4)
    .map((band) => ({
      price: band.price,
      kind: band.kind,
      touches: band.touches,
    }));

  return {
    ticker,
    candleCount: history.candles.length,
    lastClose,
    levels,
    missedByRead,
    realLevels: real,
    trend: checkTrend(read, history.candles),
    atr: atr(history.candles),
    confirmed: levels.filter((l) => l.matched !== null).length,
    unconfirmed: levels.filter((l) => l.matched === null).length,
    baseRates,
    /* Measured from the candles pulled above rather than from the stored
       file: the tape describes the last few sessions, and a reading that
       is a day old is the wrong reading. The base rates are the opposite —
       ten years, rebuilt nightly — which is why the two come from
       different places. */
    tape: readTape(history.candles),
    setup: readSetup(ticker, history.candles, baseRates, rank),
    /* WHAT IS HAPPENING AT THE COMPANY, which the picture cannot show.
     *
     * The chart reader knew the candles and nothing else — it could not
     * know that a company has a product launch dated in February, so it
     * read every chart as if the next quarter were a blank page. A
     * reader looking at TTWO is not asking what the trend template did
     * on fifty-three occasions; they are asking that AND what happens
     * when the game ships.
     *
     * Both sides stay separate in the output and separate on the page.
     * The chart is counted; a catalyst is dated but its effect is not
     * measured here, and merging them into one confident sentence would
     * dress a calendar entry as a measurement. */
    context: await companyContext(ticker),
  };
}

/**
 * The model's trend against the measured one.
 *
 * The comparison is possible without translation because `readTrend`
 * already answers in the same three words the model is asked for, which
 * is not luck — both describe a trend, and there are only so many
 * honest answers. The fourth word on each side is where they differ:
 * the model may say `range` or `unclear`, and the measurement never
 * says "unclear", it says `mixed` and explains which two signals
 * disagreed.
 */
function checkTrend(read: ChartRead, candles: Candle[]): TrendCheck {
  const measured = readTrendFor(candles);
  const stage = readStage(candles);

  const agreement: TrendCheck["agreement"] = (() => {
    if (measured.verdict === null || read.trend === "unclear") return "unclear";
    /* A picture showing a range against candles that are trending is a
       real contradiction and not a softer one: the structure the reader
       was shown is not the structure the instrument is in. */
    if (read.trend === "range") {
      return measured.verdict === "mixed" ? "agrees" : "contradicts";
    }
    if (read.trend === measured.verdict) return "agrees";
    if (measured.verdict === "mixed") return "qualified";
    return "contradicts";
  })();

  return {
    read: read.trend,
    measured: measured.verdict,
    stage,
    vsAveragePercent: measured.vsAveragePercent,
    averageDirection: measured.averageDirection,
    fromHighPercent: measured.fromHighPercent,
    fromLowPercent: measured.fromLowPercent,
    agreement,
  };
}

/**
 * The dated events and the analysed stories for one company.
 *
 * Nothing here is generated at read time: the earnings date comes from
 * the calendar the site already polls, and the readings were written by
 * the news queue. A chart read waits for neither.
 */
async function companyContext(ticker: string): Promise<CompanyContext> {
  const [nextReport, articles] = await Promise.all([
    getNextEarnings(ticker).catch(() => null),
    /* A wider pool than the watchlist panel renders, because the two are
       choosing differently: that panel wants the latest stories and this
       wants the most significant ones, and a high-significance catalyst
       can sit twenty headlines deep on an active name. The pool costs no
       extra request — it is a slice of a window already fetched. */
    watchlistNews(ticker, 24).catch(() => []),
  ]);

  const analysed = articles.filter((a) => a.analysis);

  return {
    nextEarnings: nextReport
      ? {
          date: nextReport.date,
          daysAway: Math.round(
            (new Date(nextReport.date).getTime() - Date.now()) / 86_400_000,
          ),
        }
      : null,
    /* Catalysts first and noise dropped. The queue has already decided
       which is which, and a chart reader that listed every headline
       would bury the one dated event under ten pieces of commentary. */
    stories: analysed
      .filter((a) => a.analysis!.catalystKind !== "noise")
      .sort((a, b) => {
        const rank = (s: string) => (s === "high" ? 0 : s === "medium" ? 1 : 2);
        const bySignificance =
          rank(a.analysis!.significance) - rank(b.analysis!.significance);
        if (bySignificance !== 0) return bySignificance;
        /* Then by how much of the story is about this company. A reading
           naming one ticker is a story about it; a reading naming four is
           a story the company appears in, and its catalyst paragraph is
           as likely to belong to one of the others. Neither is dropped —
           the count is shown — but the focused ones come first, which is
           what a reader scanning five rows actually wants. */
        const focus =
          (a.analysis!.tickers?.length || 1) -
          (b.analysis!.tickers?.length || 1);
        if (focus !== 0) return focus;
        return a.at < b.at ? 1 : -1;
      })
      .slice(0, 5)
      .map((a) => ({
        title: a.title,
        at: a.at,
        catalyst: a.analysis!.catalyst ?? null,
        catalystKind: a.analysis!.catalystKind ?? null,
        significance: a.analysis!.significance,
        impact: a.analysis!.impact,
        otherTickers: (a.analysis!.tickers ?? []).filter(
          (t) => t.toUpperCase() !== ticker,
        ),
      })),
  };
}
