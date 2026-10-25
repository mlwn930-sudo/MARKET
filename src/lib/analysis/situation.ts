import type { SetupRead } from "@/lib/analysis/setup";
import type { ChartStance } from "@/lib/analysis/stance";
import type { TapeRead } from "@/lib/metrics/tape";
import { MIN_SAMPLE, type BaseRateRead } from "@/lib/metrics/base-rates";

/**
 * Four lines, at the top, before anything asks to be studied.
 *
 * THE COMPLAINT THIS ANSWERS, in the owner's words: the page gives no
 * situational picture and over-complicates. He was right, and the cause
 * was not any single panel. A company page opens with eleven correct
 * sections and no sentence, so the reader has to assemble the picture
 * from panels that were each written to be unarguable rather than
 * readable. Every panel refused to conclude — correctly, on its own
 * terms — and nothing was left to do the concluding.
 *
 * So this concludes, from what the panels already measured, and it is
 * allowed to because it adds no new number. Every line below is a
 * selection out of readings computed elsewhere on the page: the stance
 * the engine derived, the strongest constructive observation, the
 * strongest one against, and the first thing on the route that has not
 * happened yet. Nothing here measures, which is the whole reason it can
 * be short.
 *
 * FOUR LINES AND NOT SIX. The limit is the point: a summary that grows
 * to fit everything true becomes the thing it was meant to replace.
 * When two observations compete for the same line the stronger wins and
 * the other stays in its panel, where it always was.
 */

export type Situation = {
  /** Where this stands, in one sentence. */
  state: string;
  /** The strongest thing in its favour, with its figures. */
  strength: string | null;
  /** The strongest thing against. Never omitted when one exists — a
   *  summary that prints only the supporting half is an advertisement. */
  weakness: string | null;
  /**
   * Whether the measured positives outweigh the measured concerns, and
   * the count both ways.
   *
   * ASKED FOR DIRECTLY — "do the good things outweigh the concerns" —
   * and answerable only as a count, which is what this says. It is not
   * a score and the two sides are not weighted: the site has no way to
   * decide that a trend observation is worth two level observations,
   * and inventing weights is how a count becomes a rating. So the
   * numbers are printed and the comparison is left as what it is.
   */
  balance: {
    forCount: number;
    againstCount: number;
    verdict: string;
  } | null;
  /** The next observable thing worth waiting for, or the next dated
   *  event. Null when there is neither. */
  watch: string | null;
  /**
   * What the counted record says about the months ahead, per horizon.
   *
   * ASKED FOR AS "FORECASTS SIX MONTHS OUT", and the first honest
   * answer was that nothing counted that far: the site measured a week,
   * a fortnight, a month and a quarter. So half a trading year was
   * added to the measured set rather than estimated from the quarter,
   * and this reports it beside the shorter horizons — the same
   * occurrences, the same baseline, counted 126 sessions forward.
   *
   * It is not a forecast and the copy must never let it read as one.
   * It is what followed this condition on this instrument, with the
   * sample attached, and the sample is the thing that thins: an
   * occurrence needs half a year of history after it to be measurable
   * at all, so the six-month row is always the smallest n on the list
   * and says so.
   */
  outlook: {
    condition: string;
    rows: {
      label: string;
      days: number;
      upPercent: number;
      baselinePercent: number;
      medianPct: number;
      n: number;
      thin: boolean;
    }[];
  } | null;
  /** What the lines were drawn from, so the reader can go and check. */
  asOf: string | null;
};

export function readSituation(input: {
  setup: SetupRead | null;
  stance: ChartStance | null;
  tape: TapeRead | null;
  /** The counted history, for the forward rows. */
  rates: BaseRateRead | null;
  nextReport: { date: string; daysAway: number } | null;
}): Situation | null {
  const { setup, stance, tape, rates, nextReport } = input;
  if (!setup && !stance) return null;

  /* ---- Where this stands ---- */
  const horizon = stance?.swing.direction !== "none" ? stance?.swing : stance?.position;
  const state =
    horizon && horizon.direction !== "none"
      ? horizon.verdict
      : setup && setup.observations.length > 0
        ? `אין תנאי נמדד שפעל, ו${setup.convergence} משפחות נמדדות נכונות בו-זמנית. ` +
          "זה מצב ולא אירוע."
        : "אין כאן מדידה שפעלה ואין מספיק שנכון בו-זמנית כדי לתאר מצב.";

  /* ---- The strongest thing either way ----
     Taken from `observations` and `tension`, which the setup already
     sorted by strength of evidence. Taking the first is therefore a
     selection and not a new judgement. */
  const strongest = setup?.observations.find((o) => o.side === "constructive");
  const against =
    setup?.tension.find((o) => o.side === "cautionary") ??
    setup?.observations.find((o) => o.side === "cautionary");

  const withRecord = (o: typeof strongest) =>
    o
      ? o.record
        ? `${o.label} — ${Math.round(o.record.upRate * 100)}% סגרו גבוה יותר מול בסיס ${Math.round(o.record.baselineRate * 100)}%, על ${o.record.sample} מופעים.`
        : `${o.label}. ${o.detail}`
      : null;

  /* ---- What has not happened yet ----
     The route's first unmet step when there is one, because that is a
     thing to watch rather than a thing to know. A dated report is the
     fallback: it is the one future event the site is certain of. */
  const confirm = horizon?.route.find((r) => r.kind === "confirm");
  const watch = confirm
    ? `${confirm.label} — ${confirm.detail}`
    : nextReport && nextReport.daysAway >= 0
      ? `הדוח הרבעוני ב-${nextReport.date}, בעוד ${nextReport.daysAway} ימים. רוב השינויים בקריאה של האתר קורים ביום הזה.`
      : tape?.control
        ? tape.control.note.split(".")[0] + "."
        : null;

  /* ---- Does the good outweigh the concerns ----
     A count and never a score. Weighting one family against another
     would require deciding that a trend reading is worth two level
     readings, which nothing here measured, and that decision is how a
     count turns into a rating. Both numbers are printed and the reader
     does the weighing — which is also the only honest answer, because
     the weights depend on what they are buying it for. */
  const all = [...(setup?.observations ?? []), ...(setup?.tension ?? [])];
  const forCount = all.filter((o) => o.side === "constructive").length;
  const againstCount = all.filter((o) => o.side === "cautionary").length;
  const balance =
    forCount + againstCount === 0
      ? null
      : {
          forCount,
          againstCount,
          verdict:
            forCount > againstCount
              ? `${forCount} תצפיות נמדדות בעד מול ${againstCount} נגד. זו ספירה ולא ציון — האתר לא שוקל תצפית אחת מול אחרת, כי אין לו מדידה שתגיד איזו מהן חשובה יותר.`
              : againstCount > forCount
                ? `${againstCount} תצפיות נמדדות נגד מול ${forCount} בעד. זו ספירה ולא ציון, והיא לא אומרת שהחששות גדולים יותר — רק שיש יותר מהן.`
                : `${forCount} בעד ו-${againstCount} נגד. המדידות חלוקות, וזו תשובה ולא היעדר תשובה.`,
        };

  /* ---- What followed this, out to half a year ----
     Built from the condition with the largest sample that is true
     today, because a record is only worth quoting when there is one
     behind it — and the largest sample is the one least likely to be
     describing three coincidences. */
  const live = (rates?.conditions ?? []).filter((c) => c.activeNow);
  const best = live
    .slice()
    .sort((a, b) => (b.occurrences ?? 0) - (a.occurrences ?? 0))[0];

  /* NO LIVE CONDITION IS THE COMMON CASE AND MUST NOT BE A BLANK.
     Most days on most names nothing fires, and the first version
     printed nothing at all then — which is exactly the "I have no
     data" state the owner said must never happen. The unconditional
     baseline is always there: it is what a random day on this
     instrument was followed by, over the same windows, and it is the
     number every conditional rate is read against anyway. Taken off
     any condition's outcomes, because the baseline is a property of
     the instrument and the window, not of the condition. */
  const fallback = rates?.conditions[0];

  const outlook = best
    ? {
        condition: best.label,
        rows: best.outcomes
          .filter((o) => o.days >= 21 && o.n > 0)
          .map((o) => ({
            label:
              o.days === 21
                ? "חודש"
                : o.days === 63
                  ? "רבעון"
                  : o.days === 126
                    ? "חצי שנה"
                    : `${o.days} ימי מסחר`,
            days: o.days,
            upPercent: Math.round(o.up * 100),
            baselinePercent: Math.round(o.baselineUp * 100),
            medianPct: o.medianPct,
            n: o.n,
            /* Below the sample the rest of the site refuses to quote a
               rate on. Printed anyway here, marked, because the reader
               asked what is known further out and "the sample runs out"
               is the answer rather than a blank. */
            thin: o.n < MIN_SAMPLE,
          })),
      }
    : fallback
      ? {
          condition: "יום אקראי על הנייר הזה",
          rows: fallback.outcomes
            .filter((o) => o.days >= 21)
            .map((o) => ({
              label:
                o.days === 21
                  ? "חודש"
                  : o.days === 63
                    ? "רבעון"
                    : o.days === 126
                      ? "חצי שנה"
                      : String(o.days) + " ימי מסחר",
              days: o.days,
              upPercent: Math.round(o.baselineUp * 100),
              baselinePercent: Math.round(o.baselineUp * 100),
              medianPct: o.baselineMedianPct,
              /* Every session in the window is a sample here, which is
                 why this row is never thin — and why it can never be
                 called a signal either. */
              n: rates?.sessions ?? 0,
              thin: false,
            })),
        }
      : null;

  return {
    state,
    strength: withRecord(strongest),
    weakness: withRecord(against),
    balance,
    watch,
    outlook: outlook && outlook.rows.length > 0 ? outlook : null,
    asOf: setup?.asOf ?? stance?.swing.asOf ?? null,
  };
}
