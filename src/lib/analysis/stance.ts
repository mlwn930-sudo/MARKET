import { MEANINGFUL_PP, MIN_SAMPLE } from "@/lib/metrics/base-rates";
import type {
  BaseRateRead,
  ConditionRead,
  Outcome,
} from "@/lib/metrics/base-rates";
import { CONVERGENCE_CAVEAT } from "./setup";
import type { Observation, ObservationSide, SetupRead } from "./setup";

/**
 * A stated direction for one horizon, earned from counting.
 *
 * This is the private build's answer to "what do you think". The hard
 * part was never having an opinion — it was deciding what an opinion is
 * allowed to rest on, and the measurements settled most of that before
 * a line of this file was written.
 *
 * WHAT IT REFUSES TO REST ON: the convergence count. Five independent
 * families agreeing on one chart looks exactly like conviction, and
 * `scripts/measure-convergence.ts` walked 17,566 observations and found a
 * three-or-more convergence worth MINUS 0.3 percentage points against an
 * arbitrary day. A stance built on that would be confident and wrong,
 * which is the only outcome here that costs real money. Structure appears
 * below as context, carries `record: null`, and is never counted.
 *
 * WHAT IT RESTS ON: the base rates for this instrument. Every occurrence
 * of a named condition over ten years of its own closes, against the
 * baseline of a random day in the same window. A condition earns a vote
 * when it is true today, has at least `MIN_SAMPLE` occurrences, and sits
 * at least `MEANINGFUL_PP` from its own baseline.
 *
 * AND MOSTLY THERE IS NOTHING. Run that rule over all 123 names in
 * `content/base-rates/latest.json` and ten of them produce a direction;
 * the distribution of agreeing conditions is {0: 113, 1: 10, 2: 0, 3: 0}.
 * So `direction: "none"` is the normal answer, not the failure case, and
 * everything downstream is built to render it as an answer. A panel that
 * reads as broken when nothing is firing is a panel that will be loosened
 * until something fires.
 *
 * THREE THINGS THIS DELIBERATELY DOES NOT COMPUTE, each of which was in
 * the first design:
 *
 *   A conviction score. An integer 0-3 is a rating, and on today's data
 *   two of its four levels never occur. A scale with dead levels is a
 *   scale that gets relaxed until they light up — the exact p-hacking
 *   `setup.ts` forbids itself. The count is reported in words with its
 *   samples instead.
 *
 *   A blended probability. Two conditions firing on the same bar are not
 *   two independent trials: same ticker, overlapping forward windows.
 *   Averaging their up-rates produces a figure that was never measured
 *   for the joint event, which is rule 9 — in our own code, two panels
 *   after we stopped the model doing it. Every figure here belongs to one
 *   condition and is carried per condition.
 *
 *   A single implied price. `lastClose x (1 + medianPct/100)` renders the
 *   2.8% and buries the 3.9% drawdown that came with it, and no label
 *   survives being read as a target. The panel renders five labelled
 *   quantiles from one condition instead; five cannot be read as a
 *   target, one can.
 *
 * PURE AND FLAG-FREE. `isPrivateBuild()` is not imported here: the flag
 * controls display, so this is unit-testable without touching the
 * environment and cannot behave differently in the two builds. It must
 * also never import `base-rate-store`, `rank-store` or anything under
 * `sources/` — one `node:fs` import reached the browser bundle once and
 * 500'd sixteen of eighteen pages, and neither tsc nor eslint sees it.
 */

/** Weeks, and quarters — the two spans the question "swing or long term"
 *  actually asks about, mapped onto horizons the base rates already
 *  count. */
export const SWING_DAYS = 21;
export const POSITION_DAYS = 63;

export type StanceHorizon = "swing" | "position";

export const HORIZON_NAME: Record<StanceHorizon, string> = {
  swing: "סווינג",
  position: "טווח ארוך",
};

export const HORIZON_SPAN: Record<StanceHorizon, string> = {
  swing: "21 ימי מסחר",
  position: "63 ימי מסחר",
};

const DAYS: Record<StanceHorizon, number> = {
  swing: SWING_DAYS,
  position: POSITION_DAYS,
};

/**
 * `none` is not a hedge and `split` is not "sideways".
 *
 * `none` means no counted condition is firing, so there is nothing to
 * take a direction from. `split` means two are firing and their records
 * point opposite ways — the measurements contradict each other. Neither
 * is a claim that the price will range, because nothing in this file
 * measures ranging.
 */
export type StanceDirection = "up" | "down" | "split" | "none";

export const DIRECTION_NAME: Record<StanceDirection, string> = {
  up: "הרשומה נוטה למעלה",
  down: "הרשומה נוטה למטה",
  split: "הרשומות סותרות זו את זו",
  none: "אין תנאי נמדד שפעל",
};

/**
 * One condition's own figures, never merged with another's.
 *
 * Every field is copied from a single `Outcome`. Nothing here is an
 * average, a weighted blend or a derived statistic, and
 * `scripts/stance.test.ts` asserts that every number in the output is
 * identical to a number present in some input outcome. That test is the
 * strongest available expression of rule 9, and it fails loudly if
 * anybody adds a blend later.
 */
export type ConditionCite = {
  key: string;
  label: string;
  /** Occurrences with enough history after them for THIS horizon. */
  n: number;
  /** Every firing in the window, including ones too recent to measure. */
  occurrences: number;
  lastAt: string | null;
  /** The share that closed higher. Named `…Hist` because it is a count
   *  of overlapping historical windows on one ticker, not a probability
   *  of anything happening next. */
  upShareHist: number;
  baselineUpShare: number;
  liftPp: number;
  medianPct: number;
  baselineMedianPct: number;
  p25Pct: number;
  p75Pct: number;
  worstPct: number;
  /** Negative by construction — the lowest low relative to the trigger
   *  close. Absent on stored files written before it was measured. */
  medianAdversePct: number | null;
  baselineAdversePct: number | null;
};

/**
 * One checkable state on the route.
 *
 * `kind` is what the step does to the stance, not what the reader should
 * do about it. "now" is already true, "confirm" would add a counted
 * condition to the same side, "end" refutes it, "expires" is the horizon
 * running out. There is no "enter" and there will not be one: the site
 * does not know this reader's position, horizon or risk, and a step that
 * said "buy here" would be inventing all three.
 */
export type RouteStep = {
  order: number;
  kind: "now" | "confirm" | "end" | "expires";
  label: string;
  detail: string;
};

export const ROUTE_KIND_NAME: Record<RouteStep["kind"], string> = {
  now: "נכון עכשיו",
  confirm: "יחזק את זה",
  end: "יסיים את זה",
  expires: "פג",
};

/** Context from the chart's structure. Carries no record, is never
 *  counted, and cannot change a direction. */
export type StructureNote = {
  key: string;
  label: string;
  detail: string;
  side: ObservationSide;
};

export type HorizonStance = {
  horizon: StanceHorizon;
  horizonDays: number;
  direction: StanceDirection;
  /** Conditions firing today with a sample and a gap worth leaning on. */
  agreeing: ConditionCite[];
  /** Firing and eligible, but inside `MEANINGFUL_PP` of their own
   *  baseline. Shown, because "measured and added nothing" is a finding
   *  and hiding it would make the panel look more decisive than the data.
   */
  quiet: ConditionCite[];
  structure: StructureNote[];
  /** The key of the best-sampled agreeing condition — the only one the
   *  panel turns into prices. */
  bestKey: string | null;
  /**
   * The unconditional record for this horizon: what an arbitrary day on
   * this instrument was followed by.
   *
   * It is the only honest number when nothing is firing, which is the
   * normal case, and it is what every conditional rate above has to be
   * read against. Copied rather than computed — `outcomesFor` measures
   * the baseline over every bar in the window, so it is identical on
   * every condition at a given horizon, and any one of them will do.
   */
  baseline: {
    upShare: number;
    medianPct: number;
    adversePct: number | null;
  } | null;
  because: string[];
  /** Never empty while anything is firing. */
  against: string[];
  invalidation: string[];
  /**
   * The same evidence in the order a person would actually use it.
   *
   * Asked for as "a route", and the honest version of that is a
   * sequence of checkable states rather than a plan: what is true now,
   * what would add to it, what would end it, and when it expires
   * regardless. Every step is an observable close — it happened or it
   * did not — so the whole thing can be scored afterwards instead of
   * remembered favourably.
   *
   * It contains no new measurement. It is `agreeing`, the conditions
   * that lean the same way and have not fired yet, and `invalidation`,
   * put in order. A route that introduced a figure the panel above does
   * not show would be a forecast wearing a checklist.
   */
  route: RouteStep[];
  /** The bar this was measured on, and the close it was measured from. */
  asOf: string;
  lastClose: number;
  basis: string;
  caveats: string[];
};

export type ChartStance = {
  symbol: string;
  swing: HorizonStance;
  position: HorizonStance;
};

/**
 * The opposite EVENT, for the conditions that have one.
 *
 * This map exists because the obvious invalidation is a category error,
 * and it was in the first draft. `base-rates.ts` is explicit that every
 * condition is an event and not a state — the day the cross happened,
 * not every day the average stayed above. A golden cross cannot
 * un-happen, and by the next bar every condition in the file is false
 * again. A stance invalidated by "the condition stopped being true"
 * would therefore announce its own refutation one day after appearing.
 *
 * What can actually refute the record behind a direction is the paired
 * opposite firing. Only four of the sixteen conditions have one. The
 * other twelve are left unpaired on purpose rather than matched to
 * something that merely feels contrary: `thrust-bar` and `no-demand-bar`
 * are not opposites, they are two different things about volume, and
 * pairing them would manufacture an invalidation that measures nothing.
 */
const OPPOSITE: Record<string, string> = {
  "reclaim-50": "lose-50",
  "lose-50": "reclaim-50",
  "golden-cross": "death-cross",
  "death-cross": "golden-cross",
  "rsi-leaves-oversold": "rsi-leaves-overbought",
  "rsi-leaves-overbought": "rsi-leaves-oversold",
  "template-complete": "template-broken",
  "template-broken": "template-complete",
};

const pct = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}%`;
const share = (v: number) => `${Math.round(v * 100)}%`;
const points = (v: number) => `${v >= 0 ? "+" : ""}${Math.round(v)} נק׳`;

function cite(condition: ConditionRead, outcome: Outcome): ConditionCite {
  return {
    key: condition.key,
    label: condition.label,
    n: outcome.n,
    occurrences: condition.occurrences,
    lastAt: condition.lastAt,
    upShareHist: outcome.up,
    baselineUpShare: outcome.baselineUp,
    liftPp: outcome.liftPp,
    medianPct: outcome.medianPct,
    baselineMedianPct: outcome.baselineMedianPct,
    p25Pct: outcome.p25Pct,
    p75Pct: outcome.p75Pct,
    worstPct: outcome.worstPct,
    /* Present only on files the nightly job wrote after the excursion
       measurement landed. Null rather than zero: a zero here would read
       as "it never went against you", which is the opposite of unknown. */
    medianAdversePct:
      typeof outcome.medianAdversePct === "number" ? outcome.medianAdversePct : null,
    baselineAdversePct:
      typeof outcome.baselineAdversePct === "number"
        ? outcome.baselineAdversePct
        : null,
  };
}

/** Everything firing today that this horizon can measure, split by
 *  whether its gap to its own baseline is worth anything. */
function firing(
  rates: BaseRateRead,
  days: number,
): { agreeing: ConditionCite[]; quiet: ConditionCite[] } {
  const agreeing: ConditionCite[] = [];
  const quiet: ConditionCite[] = [];

  for (const condition of rates.conditions) {
    if (!condition.activeNow) continue;
    /* Read from the condition's own outcomes at THIS horizon.
       `setup.observations[].record` is hard-coded to 21 days, so a
       position stance that borrowed it would quietly be a swing stance
       wearing a quarter's label. */
    const outcome = condition.outcomes.find((o) => o.days === days);
    if (!outcome || outcome.n < MIN_SAMPLE) continue;
    const row = cite(condition, outcome);
    if (Math.abs(outcome.liftPp) >= MEANINGFUL_PP) agreeing.push(row);
    else quiet.push(row);
  }

  /* Widest gap first, so a reader and any model summarising this meet the
     strongest count before the marginal ones. */
  agreeing.sort((a, b) => Math.abs(b.liftPp) - Math.abs(a.liftPp));
  quiet.sort((a, b) => Math.abs(b.liftPp) - Math.abs(a.liftPp));
  return { agreeing, quiet };
}

/**
 * Structure, with the base-rate evidence removed from it.
 *
 * `readSetup` pushes every active base-rate condition into its own
 * observations, under the same keys, and pushes tape conditions as
 * `tape-<character>` against a `<character>-bar` condition. Showing both
 * lists unfiltered would print the same evidence twice and make the panel
 * look like it has twice as much behind it as it does.
 */
function structureOf(
  setup: SetupRead | null,
  conditionKeys: Set<string>,
): StructureNote[] {
  if (!setup) return [];
  const notes: StructureNote[] = [];
  const seen = new Set<string>();

  for (const o of [...setup.observations, ...setup.tension] as Observation[]) {
    if (conditionKeys.has(o.key)) continue;
    /* The tape naming, which is the half that is easy to miss. */
    if (o.key.startsWith("tape-") && conditionKeys.has(`${o.key.slice(5)}-bar`)) {
      continue;
    }
    if (seen.has(o.key)) continue;
    seen.add(o.key);
    notes.push({ key: o.key, label: o.label, detail: o.detail, side: o.side });
  }

  return notes;
}

/** The stance for one horizon. */
function stanceFor(
  horizon: StanceHorizon,
  rates: BaseRateRead,
  setup: SetupRead | null,
  lastClose: number,
  asOf: string,
): HorizonStance {
  const days = DAYS[horizon];
  const { agreeing, quiet } = firing(rates, days);
  const conditionKeys = new Set(
    rates.conditions.filter((c) => c.activeNow).map((c) => c.key),
  );
  const structure = structureOf(setup, conditionKeys);

  const up = agreeing.filter((c) => c.liftPp > 0);
  const down = agreeing.filter((c) => c.liftPp < 0);

  const direction: StanceDirection =
    agreeing.length === 0
      ? "none"
      : up.length && down.length
        ? "split"
        : up.length
          ? "up"
          : "down";

  /* The best-sampled row, not the widest gap: the figures the panel turns
     into prices should come from the count with the most behind it, and a
     nine-occurrence row with a spectacular lift is the one most likely to
     be an artefact of its own window. */
  const best = agreeing.reduce<ConditionCite | null>(
    (pick, row) => (pick === null || row.n > pick.n ? row : pick),
    null,
  );

  /* Any condition's outcome at this horizon carries it; they all measure
     the same window. Taken from the first one that has the horizon at
     all, so a file missing a horizon on one condition still reports it. */
  const anyOutcome = rates.conditions
    .map((c) => c.outcomes.find((o) => o.days === days))
    .find((o): o is Outcome => o !== undefined);
  const baseline = anyOutcome
    ? {
        upShare: anyOutcome.baselineUp,
        medianPct: anyOutcome.baselineMedianPct,
        adversePct:
          typeof anyOutcome.baselineAdversePct === "number"
            ? anyOutcome.baselineAdversePct
            : null,
      }
    : null;

  /* ---- Why ---- */
  const because: string[] = [];
  for (const c of agreeing) {
    because.push(
      `${c.label}: ${share(c.upShareHist)} סגרו גבוה יותר מול בסיס ` +
        `${share(c.baselineUpShare)} (${points(c.liftPp)}), על ${c.n} מופעים` +
        (c.lastAt ? ` · האחרון ב-${c.lastAt}` : ""),
    );
  }
  if (!because.length) {
    because.push(
      "אין על הנייר הזה תנאי נמדד שפעל בנר האחרון, ולכן אין כאן כיוון שנשען על ספירה. " +
        "רוב הימים ברוב הניירות אינם אירוע — זו המדידה, לא תקלה.",
    );
  }

  /* ---- Against, which may never be empty while anything is firing ---- */
  const against: string[] = [];

  /* The adverse path first. It is the number that decides whether a
     direction was survivable, and on most rows in this file it is larger
     than the move itself. */
  for (const c of agreeing) {
    if (c.medianAdversePct === null) continue;
    against.push(
      `בדרך, לפני שהאופק נגמר, ${c.label} ירד בחציון ${pct(c.medianAdversePct)}` +
        (c.baselineAdversePct !== null
          ? ` (בסיס ${pct(c.baselineAdversePct)})`
          : "") +
        `, והמקרה הגרוע היה ${pct(c.worstPct)}.`,
    );
  }
  if (quiet.length) {
    against.push(
      `${quiet.length} ${quiet.length === 1 ? "תנאי נוסף פעל" : "תנאים נוספים פעלו"} ` +
        `וההפרש שלהם מול הבסיס קטן מ-${MEANINGFUL_PP} נקודות: ` +
        quiet.map((c) => `${c.label} (${points(c.liftPp)})`).join(", ") +
        ". הם נמדדו ולא הוסיפו מידע.",
    );
  }
  for (const note of structure) {
    const opposes =
      (direction === "up" && note.side === "cautionary") ||
      (direction === "down" && note.side === "constructive");
    if (opposes) against.push(`${note.label} (${note.detail})`);
  }
  for (const c of agreeing) {
    if (c.n < MIN_SAMPLE * 2) {
      against.push(
        `המדגם של ${c.label} הוא ${c.n} חלונות חופפים של נייר אחד. ` +
          "זה מספיק כדי להדפיס שיעור ולא מספיק כדי לסמוך עליו.",
      );
    }
  }
  if (agreeing.length && against.length === 0) {
    /* Reachable only on a stored file with no excursion fields, no quiet
       conditions, no opposing structure and a large sample. It is still
       reachable, and a panel with an empty counter-column reads as
       endorsement. */
    against.push(
      "אין כאן ראיה נמדדת לכיוון ההפוך — וזה עצמו סייג: " +
        "היעדר ראיה נגדית אינו ראיה.",
    );
  }

  /* ---- What would refute it ---- */
  const invalidation: string[] = [];
  for (const c of agreeing) {
    const opposite = OPPOSITE[c.key];
    const pair = opposite
      ? rates.conditions.find((x) => x.key === opposite)
      : undefined;
    if (pair) {
      invalidation.push(
        `${pair.label} — האירוע ההפוך. אם הוא פועל, הרשומה שמאחורי הכיוון ` +
          "הזה היא של הצד השני, והעמדה הזאת בטלה.",
      );
    } else {
      invalidation.push(
        `ל"${c.label}" אין אירוע הפוך נמדד באתר. ההפרכה היחידה שלו היא ` +
          "תום האופק.",
      );
    }
  }
  invalidation.push(
    `תום האופק: העמדה נמדדה על הנר של ${asOf} ומדברת על ${HORIZON_SPAN[horizon]}. ` +
      "אחרי זה היא פגה ואינה אומרת דבר — עמדה שלא נפסלת בזמן הופכת לדעה קבועה.",
  );

  /* ---- The route: the same evidence, in the order it gets used ---- */
  const route: RouteStep[] = [];
  let step = 1;

  for (const c of agreeing) {
    route.push({
      order: step++,
      kind: "now",
      label: c.label,
      detail:
        `${share(c.upShareHist)} מול בסיס ${share(c.baselineUpShare)} (${points(c.liftPp)}), ` +
        `על ${c.n} מופעים` +
        (c.medianAdversePct !== null
          ? `. ירידה חציונית בדרך ${pct(c.medianAdversePct)}.`
          : "."),
    });
  }

  /* What would add a second counted condition to the same side. Only
     when there is a side: with no direction there is nothing to
     confirm, and listing "events that would make a case" under a stance
     that has no case is how a blank panel starts implying one. */
  if (direction === "up" || direction === "down") {
    const wanted = direction === "up" ? 1 : -1;
    for (const condition of rates.conditions) {
      if (condition.activeNow) continue;
      const o = condition.outcomes.find((x) => x.days === days);
      if (!o || o.n < MIN_SAMPLE) continue;
      if (Math.abs(o.liftPp) < MEANINGFUL_PP) continue;
      if (Math.sign(o.liftPp) !== wanted) continue;
      route.push({
        order: step++,
        kind: "confirm",
        label: condition.label,
        detail:
          `עוד לא קרה הפעם. כשקרה: ${share(o.up)} מול בסיס ${share(o.baselineUp)} ` +
          `(${points(o.liftPp)}), על ${o.n} מופעים.`,
      });
    }
  }

  for (const line of invalidation) {
    const expiry = line.includes("תום האופק");
    /* The invalidation lines are written as "<event> — <why>", and the
       row prints a label above a detail. Splitting on the dash keeps the
       event out of the detail: printed whole it read as the event name
       twice in one row. */
    const dash = line.indexOf(" — ");
    route.push({
      order: step++,
      kind: expiry ? "expires" : "end",
      label: expiry
        ? `תום ${HORIZON_SPAN[horizon]}`
        : dash === -1
          ? line
          : line.slice(0, dash),
      detail: dash === -1 ? line : line.slice(dash + 3),
    });
  }

  /* ---- Basis ---- */
  const basis =
    `נספר מ-${rates.sessions} ימי מסחר של ${rates.symbol} עצמו ` +
    `(${rates.from} עד ${rates.to}), אופק ${days} ימי מסחר. ` +
    `המחיר שממנו נמדד: ${lastClose.toFixed(2)} — הסגירה היומית של ${asOf}, לא מחיר חי.`;

  const caveats = [
    ...(rates.caveats ?? []),
    ...(structure.length ? [CONVERGENCE_CAVEAT] : []),
    "כל מספר כאן שייך לתנאי אחד ולא מוזג עם אחר: שני תנאים שפעלו באותו נר " +
      "אינם שני ניסויים בלתי תלויים, וממוצע שלהם הוא מספר שלא נמדד.",
    "אין כאן רמת סטופ, אין גודל פוזיציה ואין מחיר יעד. זו התפלגות של מה " +
      "שכבר קרה, וההחלטה היא של הקורא.",
  ];

  return {
    horizon,
    horizonDays: days,
    direction,
    agreeing,
    quiet,
    structure,
    bestKey: best?.key ?? null,
    baseline,
    because,
    against,
    invalidation,
    route,
    asOf,
    lastClose,
    basis,
    caveats,
  };
}

/**
 * Both horizons, which is the pair "swing or long term" asks for.
 *
 * Returns null without base rates. That is the screenshot of an index, a
 * crypto pair or any company outside the research universe: the site has
 * counted nothing about it, and a stance over nothing is the one output
 * here with no defence at all.
 */
export function buildChartStance({
  setup,
  baseRates,
  lastClose,
  asOf,
}: {
  setup: SetupRead | null;
  baseRates: BaseRateRead | null;
  lastClose: number;
  /** Defaults to the setup's own date, then the base rates' last bar.
   *  Explicit because a stance has to be able to expire, and a stance
   *  with no date cannot. */
  asOf?: string;
}): ChartStance | null {
  if (!baseRates) return null;

  /* `tape` is deliberately NOT a parameter. Every tape fact already
     arrives through `setup.observations` as a `tape-*` observation, and
     taking it from both places is exactly the double count `structureOf`
     exists to remove. */
  const when = asOf ?? setup?.asOf ?? baseRates.to;

  return {
    symbol: baseRates.symbol,
    swing: stanceFor("swing", baseRates, setup, lastClose, when),
    position: stanceFor("position", baseRates, setup, lastClose, when),
  };
}

/**
 * The five numbers the panel renders as prices, from one condition.
 *
 * Returned as a list rather than a shape so the caller cannot pick the
 * median out and render it alone, which is the failure this exists to
 * prevent. The adverse row carries `emphasis` so the renderer cannot
 * quietly demote the half that decides whether the move was sittable.
 */
export type QuantileRow = {
  label: string;
  percent: number;
  baselinePercent: number | null;
  price: number;
  emphasis: boolean;
};

export function quantileRows(
  c: ConditionCite,
  lastClose: number,
): QuantileRow[] {
  const at = (p: number) => lastClose * (1 + p / 100);
  const rows: QuantileRow[] = [
    {
      label: "רבעון תחתון",
      percent: c.p25Pct,
      baselinePercent: null,
      price: at(c.p25Pct),
      emphasis: false,
    },
    {
      label: "חציון",
      percent: c.medianPct,
      baselinePercent: c.baselineMedianPct,
      price: at(c.medianPct),
      emphasis: false,
    },
    {
      label: "רבעון עליון",
      percent: c.p75Pct,
      baselinePercent: null,
      price: at(c.p75Pct),
      emphasis: false,
    },
  ];
  if (c.medianAdversePct !== null) {
    rows.push({
      label: "הירידה בדרך, חציון",
      percent: c.medianAdversePct,
      baselinePercent: c.baselineAdversePct,
      price: at(c.medianAdversePct),
      emphasis: true,
    });
  }
  rows.push({
    label: "המקרה הגרוע",
    percent: c.worstPct,
    baselinePercent: null,
    price: at(c.worstPct),
    emphasis: true,
  });
  return rows;
}
