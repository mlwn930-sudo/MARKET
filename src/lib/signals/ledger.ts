import { MIN_SAMPLE } from "@/lib/metrics/base-rates";

/**
 * Every stance the site has taken, and what happened afterwards.
 *
 * This project measures ten years of history for every condition,
 * prints a baseline beside every rate, and once measured a threshold it
 * had invented and published the finding that it was worth minus three
 * tenths of a point. It did all of that to the past and none of it to
 * itself: a stance was stated, the horizon passed, and nothing was ever
 * written down. There was no way to ask whether any of it had been
 * right, and no way to ever start asking about the days already gone.
 *
 * So the ledger records each stance when it is given and scores it when
 * its horizon expires. It is deliberately dull: a row per stance, the
 * close it was measured from, the close at the horizon, and the move.
 *
 * WHAT MAKES IT HONEST RATHER THAN A WIN RATE:
 *
 *   The baseline travels with the row. A stance that leaned up and rose
 *   proves nothing on an instrument that rises 58% of the time anyway,
 *   so the score is always reported against what an arbitrary day in
 *   the same window would have produced.
 *
 *   Resolved and open are counted apart. A scorecard that silently
 *   drops the stances still running is one that can be made to look
 *   good by waiting.
 *
 *   Below `MIN_SAMPLE` there is no verdict at all, only the count. The
 *   first useful reading of this file is months away, and saying so is
 *   better than printing 100% from two rows.
 */

export type LedgerEntry = {
  symbol: string;
  /** The session the stance was measured on. With `horizon`, the key. */
  asOf: string;
  horizon: "swing" | "position";
  horizonDays: number;
  direction: "up" | "down" | "split";
  /** The close the stance was measured from. */
  closeAt: number;
  /** The condition the direction rested on, kept so a bad run can be
   *  traced to a condition rather than to "the engine". */
  leadKey: string | null;
  leadLabel: string | null;
  leadN: number | null;
  /** What the record predicted and what an arbitrary day would have
   *  done. Both, because one without the other is not a measurement. */
  upShareHist: number | null;
  baselineUpShare: number | null;

  /* Filled in when the horizon elapses. */
  resolvedAt?: string;
  closeThen?: number;
  movePct?: number;
  /** True when the move agreed with the direction. Null for `split`,
   *  which claims nothing and therefore cannot be right or wrong. */
  agreed?: boolean | null;
};

export type LedgerFile = {
  builtAt: string;
  entries: LedgerEntry[];
};

export type StanceToRecord = {
  symbol: string;
  asOf: string;
  horizon: "swing" | "position";
  horizonDays: number;
  direction: "up" | "down" | "split";
  closeAt: number;
  leadKey: string | null;
  leadLabel: string | null;
  leadN: number | null;
  upShareHist: number | null;
  baselineUpShare: number | null;
};

const keyOf = (e: { symbol: string; asOf: string; horizon: string }) =>
  `${e.symbol}|${e.horizon}|${e.asOf}`;

/**
 * Add today's stances, skipping any already on record.
 *
 * Conditions are events rather than states — `activeNow` is true on the
 * bar a cross happened and false the next day — so the same stance does
 * not normally repeat. The guard is for the build being run twice in a
 * session, which would otherwise double-count the day and quietly
 * inflate every total that follows.
 */
export function recordStances(
  existing: LedgerEntry[],
  taken: StanceToRecord[],
): LedgerEntry[] {
  const seen = new Set(existing.map(keyOf));
  const added = taken.filter((t) => !seen.has(keyOf(t)));
  return [...existing, ...added];
}

/** A symbol's closes by date, as the resolver needs them. */
export type CloseLookup = (symbol: string) => { date: string; close: number }[] | null;

/**
 * Score every entry whose horizon has elapsed.
 *
 * The horizon is counted in TRADING days, not calendar days, because
 * that is what the base rates counted. Resolving on a calendar offset
 * would score a 21-session claim after 15 sessions and a holiday, and
 * the error would be invisible — the number would simply be slightly
 * wrong forever.
 */
export function resolveEntries(
  entries: LedgerEntry[],
  closesFor: CloseLookup,
): { entries: LedgerEntry[]; resolved: number } {
  let resolved = 0;

  const out = entries.map((entry) => {
    if (entry.resolvedAt) return entry;

    const closes = closesFor(entry.symbol);
    if (!closes) return entry;

    const start = closes.findIndex((c) => c.date === entry.asOf);
    if (start === -1) return entry;

    const target = start + entry.horizonDays;
    if (target >= closes.length) return entry;

    const then = closes[target];
    const movePct = ((then.close - entry.closeAt) / entry.closeAt) * 100;
    resolved++;

    return {
      ...entry,
      resolvedAt: then.date,
      closeThen: then.close,
      movePct,
      /* `split` says the measurements contradict each other, which is
         not a claim about direction and cannot be scored. Counting it
         as a miss would punish the engine for being honest. */
      agreed:
        entry.direction === "split"
          ? null
          : entry.direction === "up"
            ? movePct > 0
            : movePct < 0,
    };
  });

  return { entries: out, resolved };
}

export type LedgerScore = {
  /** Scored, still running, and unscoreable. All three, so the total
   *  cannot be read as the sample. */
  resolved: number;
  open: number;
  /** `split` stances, which make no directional claim. */
  unscoreable: number;
  /** Of the resolved directional stances, how many moved the way they
   *  leaned. Null below MIN_SAMPLE. */
  agreedShare: number | null;
  /** What the conditions behind them said should happen, averaged over
   *  the same rows. The number the share above has to be read against. */
  claimedShare: number | null;
  /** And what an arbitrary day in the same windows would have given. */
  baselineShare: number | null;
  /** Said in words when there is nothing to say yet. */
  verdict: string;
};

/**
 * The scorecard.
 *
 * Returns three shares rather than one, and the reason is the whole
 * point of the file. "62% of stances were right" means nothing alone.
 * It means something next to "the conditions claimed 71%" and "an
 * arbitrary day would have given 58%" — the first says whether the
 * engine underdelivered on its own record, the second whether the
 * record was worth having.
 */
export function scoreLedger(entries: LedgerEntry[]): LedgerScore {
  const open = entries.filter((e) => !e.resolvedAt).length;
  const done = entries.filter((e) => e.resolvedAt);
  const unscoreable = done.filter((e) => e.agreed === null).length;
  const scored = done.filter((e) => e.agreed === true || e.agreed === false);

  if (scored.length < MIN_SAMPLE) {
    return {
      resolved: done.length,
      open,
      unscoreable,
      agreedShare: null,
      claimedShare: null,
      baselineShare: null,
      verdict:
        `${scored.length} עמדות הגיעו לסוף האופק. מתחת ל-${MIN_SAMPLE} אין כאן שיעור ` +
        `להציג — מספר שמחושב מכמה שורות הוא רעש עם נקודה עשרונית. ` +
        `${open} עמדות עדיין פתוחות.`,
    };
  }

  const agreedShare =
    scored.filter((e) => e.agreed === true).length / scored.length;

  /* A stance that leaned down is right when the price falls, so the
     record's claim for it is the complement of its up-rate. Without
     this flip the engine's own prediction would be scored upside down
     for every bearish row. */
  const claimed = scored
    .map((e) =>
      e.upShareHist === null
        ? null
        : e.direction === "down"
          ? 1 - e.upShareHist
          : e.upShareHist,
    )
    .filter((v): v is number => v !== null);
  const base = scored
    .map((e) =>
      e.baselineUpShare === null
        ? null
        : e.direction === "down"
          ? 1 - e.baselineUpShare
          : e.baselineUpShare,
    )
    .filter((v): v is number => v !== null);

  const mean = (xs: number[]) =>
    xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;

  const claimedShare = mean(claimed);
  const baselineShare = mean(base);

  const pct = (v: number) => `${Math.round(v * 100)}%`;
  const verdict =
    `${scored.length} עמדות נסגרו. ${pct(agreedShare)} זזו לכיוון שהן נטו אליו` +
    (claimedShare !== null ? `, מול ${pct(claimedShare)} שהרשומה הבטיחה` : "") +
    (baselineShare !== null ? ` ו-${pct(baselineShare)} ליום אקראי` : "") +
    `. ${open} עדיין פתוחות.`;

  return {
    resolved: done.length,
    open,
    unscoreable,
    agreedShare,
    claimedShare,
    baselineShare,
    verdict,
  };
}
