import type { Candle } from "@/lib/sources/prices";
import { readLevels, readFlow, type PriceLevel } from "@/lib/metrics/levels";
import { readTape, type TapeRead } from "@/lib/metrics/tape";
import { readStage, readVcp, sma } from "@/lib/metrics/technical";
import { MIN_SAMPLE, type BaseRateRead } from "@/lib/metrics/base-rates";
import type { RankRead } from "@/lib/metrics/rank";

/**
 * Whether a company a reader follows is doing something worth their time
 * today — and the argument for saying so.
 *
 * The agent that mails a watchlist had a problem it could not solve from
 * inside itself: it fired on any session that was not ordinary and any
 * price that was near any level. On two companies that is a handful of
 * messages a week about nothing in particular, and the honest description
 * of a handful of messages a week about nothing in particular is noise.
 * The reader stops opening them, and the one that mattered arrives into an
 * inbox that has learned to ignore it.
 *
 * What separates a thing worth looking at from a thing that is merely true
 * is CONVERGENCE. One measured condition is a fact about a stock. Four
 * independent ones landing in the same week is the thing a person who
 * watches charts is actually looking for, and it is also the only version
 * of "a setup" that can be stated without predicting anything.
 *
 * SO THIS COUNTS, IT DOES NOT SCORE. Rule 8 is the whole shape of the
 * file. It produces a LIST of observations that are true right now, each
 * one carrying the number that produced it and, where the site has
 * measured that condition on this instrument, what it has been followed
 * by. It does not weight them into a total, does not rank the company
 * against another, and does not say what to do. The convergence count is
 * a count of independent observations — not a score, and the difference
 * is that a reader can disagree with any single line and recompute the
 * rest themselves.
 *
 * IT ALSO REPORTS DISAGREEMENT, which is the half that makes it worth
 * reading. A stock sitting on a support that has held eleven times while
 * its volume dries up and its universe rank sits at 9 is not a clean
 * picture, and a list that printed only the supportive observations would
 * be an argument rather than a reading. `tension` carries the lines that
 * point the other way.
 */

export type ObservationSide = "constructive" | "cautionary" | "neutral";

export type Observation = {
  key: string;
  /** What is true, as a thing that happened rather than a judgement. */
  label: string;
  /** The figures behind it, so the reader can check rather than trust. */
  detail: string;
  side: ObservationSide;
  /**
   * What this condition has been followed by on THIS instrument, when the
   * site has counted it. Null where there is no measurement — a level
   * holding is a count of turns, not a base rate, and saying otherwise
   * would borrow authority the number does not have.
   */
  record: {
    occurrences: number;
    upRate: number;
    baselineRate: number;
    liftPp: number;
    sample: number;
  } | null;
};

export type SetupRead = {
  symbol: string;
  asOf: string;
  /** Everything true right now, strongest evidence first. */
  observations: Observation[];
  /** The ones pointing the other way, pulled out so they cannot be
   *  skimmed past. */
  tension: Observation[];
  /**
   * How many INDEPENDENT measured conditions are true at once.
   *
   * Independent is doing real work here. Price above the fifty-day and
   * price above the twenty-day are one observation wearing two hats, and
   * counting them separately is how a convergence count inflates itself
   * into a recommendation. Only the families below count once each:
   * trend, level, volume, rank, contraction.
   */
  convergence: number;
  /** Which families contributed, so the count can be audited. */
  families: string[];
  /** True when there is enough here to be worth a reader's attention —
   *  and the observations are what justify it, not this flag. */
  worthWatching: boolean;
  /** Why the tape cannot be read, when it cannot. */
  caveats: string[];
};

/**
 * Below this many independent families, what is on the chart is a fact
 * rather than a situation.
 *
 * THREE IS AN EDITORIAL THRESHOLD AND NOT A PREDICTIVE ONE, and that
 * sentence is the result of measuring it rather than a hedge written
 * before anybody did. `scripts/measure-convergence.ts` walked 41 names
 * over ten years — 17,566 observations, every fifth bar, four families —
 * and asked whether a convergence was followed by anything:
 *
 *   1 family    +1.9pp against the baseline
 *   2 families  +0.4pp
 *   3 families  -0.4pp
 *   4 families  +0.1pp
 *
 * Nothing. A three-family convergence is followed by a higher price
 * slightly LESS often than a random bar in the same window. The number was
 * picked because three felt like the point where a reader would find more
 * than one thing to say, and as a forecast it is worth exactly what that
 * description suggests.
 *
 * It is kept anyway, because filtering was always its job. Its purpose is
 * to stop mailing somebody a single true fact about a chart, and it does
 * that. What changed is what the site is allowed to imply: the count
 * measures how much there is to look at, the individual conditions carry
 * whatever information exists, and `convergenceCaveat` travels in the data
 * so no panel and no email can print the count without the finding that it
 * predicts nothing.
 *
 * The alternative was to try thresholds until one looked good. That is
 * p-hacking, and a site built on printing the unflattering number does not
 * get to make an exception for its own.
 */
const WORTH_WATCHING = 3;

/** Ships inside every read, because a count without this sentence is a
 *  claim the measurement does not support. */
export const CONVERGENCE_CAVEAT =
  "מספר המשפחות הוא מדד לכמה יש להסתכל עליו, לא תחזית. נמדד על 41 ניירות " +
  "ו-17,566 תצפיות: התכנסות של שלוש משפחות ומעלה לוותה בעלייה ב-57.6% " +
  "מהמקרים מול 57.9% ליום אקראי — הפרש של 0.3 נקודות לרעה. מה שנושא מידע, " +
  "אם בכלל, הוא שיעור הבסיס של כל תנאי בנפרד.";

/** How close to a level counts as being at it. The same figure the
 *  watchlist agent uses, which is the point — two thresholds for one idea
 *  is how a panel and an email start describing different charts. */
export const AT_LEVEL_PERCENT = 2;

function rateFor(
  rates: BaseRateRead | null,
  key: string,
  horizon = 21,
): Observation["record"] {
  const condition = rates?.conditions.find((c) => c.key === key);
  const outcome = condition?.outcomes.find((o) => o.days === horizon);
  if (!condition || !outcome || outcome.n < MIN_SAMPLE) return null;
  return {
    occurrences: condition.occurrences,
    upRate: outcome.up,
    baselineRate: outcome.baselineUp,
    liftPp: outcome.liftPp,
    sample: outcome.n,
  };
}

export function readSetup(
  symbol: string,
  candles: Candle[],
  rates: BaseRateRead | null,
  rank: RankRead | null,
): SetupRead {
  const observations: Observation[] = [];
  const tension: Observation[] = [];
  const families = new Set<string>();
  const caveats: string[] = [];

  const tape: TapeRead = readTape(candles);
  const asOf = tape.through ?? candles[candles.length - 1]?.date ?? "";
  const close = candles[candles.length - 1]?.close ?? 0;

  const push = (o: Observation, family: string) => {
    families.add(family);
    (o.side === "cautionary" ? tension : observations).push(o);
  };

  /* ---- Volume, read bar by bar ---- */
  const bar = tape.latest;
  if (bar && bar.character !== "quiet") {
    const record = rateFor(rates, `${bar.character}-bar`);
    const constructive =
      bar.character === "thrust" ||
      bar.character === "absorption" ||
      bar.character === "climax";
    push(
      {
        key: `tape-${bar.character}`,
        label: CHARACTER_SENTENCE[bar.character] ?? "נר חריג",
        detail:
          `${bar.date} · מחזור ×${bar.volumeRatio.toFixed(1)}` +
          (bar.volumePercentile !== null
            ? ` (אחוזון ${Math.round(bar.volumePercentile * 100)})`
            : "") +
          `, טווח ${bar.rangePercent.toFixed(1)}%, סגירה ב-${Math.round(bar.closePosition * 100)}% מהטווח`,
        side: constructive ? "constructive" : "neutral",
        record,
      },
      "volume",
    );
  }

  /* Participation expanding or contracting is a separate statement from
     any one bar, and it is the one a reader of a base actually wants. */
  if (tape.trend !== null) {
    if (tape.trend < 0.75) {
      push(
        {
          key: "volume-dry",
          label: "המחזור התייבש",
          detail: `מחזור 10 הימים האחרונים הוא ×${tape.trend.toFixed(2)} מהמחזור של 50 הימים שלפניהם`,
          side: "constructive",
          record: null,
        },
        "volume",
      );
    } else if (tape.trend > 1.4) {
      push(
        {
          key: "volume-expanding",
          label: "ההשתתפות מתרחבת",
          detail: `מחזור 10 הימים האחרונים הוא ×${tape.trend.toFixed(2)} מהמחזור של 50 הימים שלפניהם`,
          side: "neutral",
          record: null,
        },
        "volume",
      );
    }
  }

  if (tape.obv?.divergence) {
    push(
      {
        key: `obv-${tape.obv.divergence}`,
        label:
          tape.obv.divergence === "bearish"
            ? "המחיר עשה שיא גבוה יותר, המחזור המצטבר לא"
            : "המחיר עשה שפל נמוך יותר, המחזור המצטבר לא",
        detail: `נמדד על ${tape.obv.window} ימי מסחר`,
        side: tape.obv.divergence === "bearish" ? "cautionary" : "constructive",
        record: null,
      },
      "volume",
    );
  }

  /* ---- Where the price is standing ---- */
  const levels = readLevels(candles, 8);
  const atLevel = levels
    .filter(
      (l) => l.touches >= 3 && Math.abs(l.distancePercent) <= AT_LEVEL_PERCENT,
    )
    .sort((a, b) => Math.abs(a.distancePercent) - Math.abs(b.distancePercent))[0] as
    | PriceLevel
    | undefined;

  if (atLevel) {
    const side = atLevel.kind === "support" ? "תמיכה" : "התנגדות";
    /* TWO COUNTS THAT READ AS A CONTRADICTION AND ARE NOT, which is why
       each one now carries its unit.

       `touches` is the swings that formed the band — three pivots inside
       one price zone is what made it a level in the first place.
       `held + broke` is every later approach, counted as episodes of the
       close entering the band and leaving it, and there are normally far
       more of those than there are pivots.

       Printed as "held 14 of 15" beside "3 touches", a reader concludes
       one of the two is broken — and the model answering questions about
       the chart repeats the apparent contradiction. Named, each number
       says what it counted and both are true at once. */
    const encounters = atLevel.held + atLevel.broke;
    push(
      {
        key: `level-${atLevel.kind}`,
        label: `המחיר על ${side} שהחזיקה ב-${atLevel.held} מתוך ${encounters} המפגשים איתה`,
        detail:
          `${close.toFixed(2)} מול ${atLevel.price.toFixed(2)} ` +
          `(${atLevel.distancePercent >= 0 ? "+" : ""}${atLevel.distancePercent.toFixed(1)}%), ` +
          `הרמה נבנתה מ-${atLevel.touches} תפניות, האחרונה ב-${atLevel.lastTouch}`,
        /* A band that has broken as often as it held is not support. The
           count decides the side, not the word "support". */
        side:
          atLevel.broke > atLevel.held
            ? "cautionary"
            : atLevel.kind === "support"
              ? "constructive"
              : "neutral",
        record: null,
      },
      "level",
    );
  }

  /* ---- The trend the price is in ---- */
  const stage = readStage(candles);
  const ma50 = sma(candles, 50);
  const ma200 = sma(candles, 200);
  const last = candles.length - 1;
  const above50 = ma50[last] !== null && close > ma50[last]!;
  const above200 = ma200[last] !== null && close > ma200[last]!;

  if (stage.stage === 2) {
    push(
      {
        key: "stage-2",
        label: "שלב 2 בוויינשטיין — מגמת עלייה מבוססת",
        detail: stage.note,
        side: "constructive",
        record: null,
      },
      "trend",
    );
  } else if (stage.stage === 4) {
    push(
      {
        key: "stage-4",
        label: "שלב 4 בוויינשטיין — מגמת ירידה",
        detail: stage.note,
        side: "cautionary",
        record: null,
      },
      "trend",
    );
  } else if (above50 !== above200) {
    push(
      {
        key: "trend-mixed",
        label: above200
          ? "מעל ממוצע 200 ומתחת ל-50"
          : "מתחת לממוצע 200 ומעל 50",
        detail: "המגמה הארוכה והקצרה לא מסכימות",
        side: "cautionary",
        record: null,
      },
      "trend",
    );
  }

  /* ---- Conditions the site has measured, that fired on the last bar ---- */
  for (const condition of rates?.conditions ?? []) {
    if (!condition.activeNow) continue;
    /* Volume conditions are already reported above by the tape, from the
       same definitions. Counting them twice would inflate the convergence
       with one observation wearing two names. */
    if (condition.key.endsWith("-bar")) continue;
    const record = rateFor(rates, condition.key);
    push(
      {
        key: condition.key,
        label: condition.label,
        detail: record
          ? `${record.occurrences} מופעים בעשר שנים`
          : `${condition.occurrences} מופעים — מעט מדי לשיעור`,
        side:
          record && Math.abs(record.liftPp) >= 10
            ? record.liftPp > 0
              ? "constructive"
              : "cautionary"
            : "neutral",
        record,
      },
      condition.key.includes("50") || condition.key.includes("cross")
        ? "trend"
        : "event",
    );
  }

  /* ---- Contraction, which is the one pattern that needs volume to mean
          anything and therefore belongs beside it ---- */
  /* A run of pullbacks is not a contraction unless each one is shallower
     than the last, and `readVcp` already knows the difference — it was
     reporting "four consecutive contractions" over a note that said, in
     the same breath, that the latest was deeper than the one before and
     therefore not a contraction at all. The label now follows the verdict
     rather than the count, and a range that is opening says so. */
  const vcp = readVcp(candles);
  if (vcp.contractions.length >= 2) {
    const tight = vcp.tightening && vcp.verdict !== "loose";
    push(
      {
        key: "vcp",
        label: tight
          ? `${vcp.contractions.length} התכווצויות רצופות, כל אחת רדודה מקודמתה`
          : `${vcp.contractions.length} נסיגות רצופות — אבל הטווח נפתח, לא מתכווץ`,
        detail: vcp.note,
        side: tight ? "constructive" : "cautionary",
        record: null,
      },
      "contraction",
    );
  }

  /* ---- Where it stands against everything else ---- */
  if (rank?.strengthRank != null) {
    const r = rank.strengthRank;
    if (r >= 80 || r <= 20) {
      push(
        {
          key: "rank",
          label:
            r >= 80
              ? `כוח יחסי ${r} מתוך 99 — מהחזקים ביקום המחקר`
              : `כוח יחסי ${r} מתוך 99 — מהחלשים ביקום המחקר`,
          detail: `תשואה משוקללת ${rank.strengthScore?.toFixed(1) ?? "—"}% מול שאר החברות`,
          side: r >= 80 ? "constructive" : "cautionary",
          record: null,
        },
        "rank",
      );
    }
  }

  /* ---- What is missing ---- */
  const flow = readFlow(candles);
  if (flow.upVolumeShare === null) {
    caveats.push("אין די נתוני מחזור לקריאת זרימה.");
  }
  if (!rates) {
    caveats.push(
      "הנייר אינו ביקום המחקר, ולכן אין שיעורי בסיס מדודים לצד הממצאים.",
    );
  }
  caveats.push(...tape.caveats);
  /* First, because it is the one a reader of the count most needs. */
  caveats.unshift(CONVERGENCE_CAVEAT);

  const all = [...observations, ...tension];
  observations.sort((a, b) => Number(Boolean(b.record)) - Number(Boolean(a.record)));

  return {
    symbol,
    asOf,
    observations,
    tension,
    convergence: families.size,
    families: [...families],
    /* Enough independent families to be a situation rather than a fact,
       and at least one of them measured. A chart with three unmeasured
       descriptions of itself is still just a description. */
    worthWatching:
      families.size >= WORTH_WATCHING && all.some((o) => o.record !== null),
    caveats,
  };
}

/** The bar characters as sentences rather than labels, because an email
 *  is read as prose and "absorption" is a word only this site uses. */
const CHARACTER_SENTENCE: Record<string, string> = {
  climax: "נר שיא — מחזור קיצוני בטווח רחב, והסגירה החזירה את הקצה",
  absorption: "ספיגה — מחזור קיצוני ומחיר שכמעט לא זז",
  thrust: "דחיפה — מחזור כבד, טווח רחב, סגירה בקצה",
  "no-demand": "עלייה בלי השתתפות — מחזור ברבעון התחתון",
  "no-supply": "ירידה בלי היצע — מחזור ברבעון התחתון",
  churn: "מחזור כבד בלי כיוון",
};
