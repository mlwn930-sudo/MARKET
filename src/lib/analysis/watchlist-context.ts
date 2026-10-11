import { getScan, type ScanHorizon } from "@/lib/signals/scan-store";
import { getCorrelations } from "@/lib/metrics/correlation-store";
import { getNextEarnings } from "@/lib/sources/finnhub";
import { buildChartStance, type StanceDirection } from "@/lib/analysis/stance";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";

/**
 * What else the reader is following, while they look at one chart.
 *
 * The agent could say everything about the instrument in front of it
 * and nothing about the only context that makes a chart a decision:
 * what the person already owns. A direction on one name is a reading.
 * The same direction on every name they follow is a different object —
 * a concentrated position they did not notice assembling — and the site
 * had both halves of that sentence and never put them together.
 *
 * WHERE THE LIST COMES FROM, AND WHY IT IS NOT STORED HERE. The
 * watchlist lives in the reader's own localStorage and the server keeps
 * a copy only for the alert mail, keyed by address. This module is
 * handed the tickers by the page that already has them — the same
 * pattern `/api/watchlist-coverage` uses. That keeps the list on the
 * reader's machine, adds no record anywhere, and means a browser that
 * follows nothing gets a context with nothing in it rather than
 * somebody else's.
 *
 * It is also client-supplied input, and deliberately only a *query*.
 * Every figure below is looked up by the server in its own files; a
 * posted list can ask about different companies and cannot assert
 * anything about them. The one thing it must not be allowed to do is
 * cost: the cap exists so a crafted body cannot turn one question into
 * fifty calendar lookups.
 *
 * NOTHING IS COMPUTED LIVE. The directions come from the nightly scan,
 * so they are dated and the date is carried; correlations come from the
 * matrix the same job writes. A question typed into a chart should not
 * pull a year of candles for every followed name, and the figures that
 * would come back would be the ones already on disk.
 */

/** A question about one chart must not become a sweep of the universe.
 *  The real list is two or three names; this is a ceiling on a crafted
 *  body, not a product decision. */
const MAX_FOLLOWED = 10;

/** Below this, two names moving together is not worth a sentence. Above
 *  it, a reader looking at one chart is also looking at the other and
 *  does not know it. Chosen to match the threshold `portfolio.ts`
 *  already treats as a tight pair, so the two pages do not disagree
 *  about what "together" means. */
const CLOSE_ENOUGH = 0.6;

export type FollowedName = {
  ticker: string;
  /** Today's counted direction per horizon, from the nightly scan.
   *  Absent means no measured condition fired — the normal case. */
  swing: { direction: StanceDirection; lead: string | null } | null;
  position: { direction: StanceDirection; lead: string | null } | null;
  nextEarnings: { date: string; daysAway: number } | null;
  /** Weekly-return correlation with the chart being read, measured over
   *  the matrix's window. Null when either name is outside it. */
  correlation: number | null;
};

export type WatchlistContext = {
  /** Whether the chart in front of the reader is one of their own. */
  isFollowed: boolean;
  followed: FollowedName[];
  /** Followed names whose counted direction matches this chart's, and
   *  the total that have any direction at all. Both, always: three of
   *  three is a different sentence from three of eleven. */
  sameDirection: number;
  withAnyDirection: number;
  /** Followed names correlated with this chart above `CLOSE_ENOUGH`. */
  closeMovers: { ticker: string; correlation: number }[];
  /** When the scan and the matrix were built. Printed, because both are
   *  nightly and a reader comparing them to a live chart deserves to
   *  know which side is dated. */
  scanAsOf: string | null;
  correlationAsOf: string | null;
  correlationWeeks: number | null;
};

const horizonOf = (
  rows: ScanHorizon[] | undefined,
  which: "swing" | "position",
): FollowedName["swing"] => {
  const row = rows?.find((h) => h.horizon === which);
  if (!row || row.direction === "none") return null;
  return { direction: row.direction, lead: row.lead?.label ?? null };
};

/**
 * The context for one corroborated chart and the reader's own list.
 *
 * The direction to compare against is taken from the chart's live
 * stance rather than from the scan, and swing is preferred over the
 * quarter because a reader holding several names is exposed to all of
 * them over the same weeks. When the short horizon has no direction the
 * long one is used instead — otherwise a chart that leans only over a
 * quarter would report nothing in common with a list that leans the
 * same way.
 */
export async function watchlistFor(
  checked: Pick<Corroboration, "ticker" | "setup" | "baseRates" | "lastClose">,
  tickers: string[],
): Promise<WatchlistContext | null> {
  if (tickers.length === 0) return null;
  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });
  const direction =
    stance?.swing.direction && stance.swing.direction !== "none"
      ? stance.swing.direction
      : (stance?.position.direction ?? "none");
  return watchlistContext(checked.ticker, tickers, direction);
}

export async function watchlistContext(
  chartTicker: string,
  tickers: string[],
  /** The chart's own direction, to compare the followed names against.
   *  Passed in rather than read from the scan: the chart's stance is
   *  computed live from fresh candles and the scan is last night's, and
   *  silently mixing the two would compare a reading to itself a day
   *  late. */
  chartDirection: StanceDirection,
): Promise<WatchlistContext | null> {
  const symbol = chartTicker.toUpperCase();
  const list = [
    ...new Set(
      tickers
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim().toUpperCase())
        .filter((t) => /^[A-Z.\-]{1,10}$/.test(t)),
    ),
  ].slice(0, MAX_FOLLOWED);

  if (list.length === 0) return null;

  const others = list.filter((t) => t !== symbol);

  const [scan, correlations, earnings] = await Promise.all([
    getScan().catch(() => null),
    getCorrelations().catch(() => null),
    Promise.all(
      others.map(async (t) => {
        const next = await getNextEarnings(t).catch(() => null);
        return [t, next] as const;
      }),
    ),
  ]);

  const byTicker = new Map(
    (scan?.names ?? []).map((n) => [n.symbol.toUpperCase(), n.horizons]),
  );
  const earningsBy = new Map(earnings);

  const index = new Map(
    (correlations?.symbols ?? []).map((s, i) => [s.toUpperCase(), i]),
  );
  const self = index.get(symbol);
  const correlationWith = (t: string): number | null => {
    const other = index.get(t);
    if (self === undefined || other === undefined) return null;
    const value = correlations?.matrix[self]?.[other];
    return typeof value === "number" ? value : null;
  };

  const followed: FollowedName[] = others.map((t) => {
    const rows = byTicker.get(t);
    const next = earningsBy.get(t) ?? null;
    return {
      ticker: t,
      swing: horizonOf(rows, "swing"),
      position: horizonOf(rows, "position"),
      nextEarnings: next
        ? {
            date: next.date,
            daysAway: Math.round(
              (new Date(next.date).getTime() - Date.now()) / 86_400_000,
            ),
          }
        : null,
      correlation: correlationWith(t),
    };
  });

  /* Counted both ways on purpose. "Three of three lean the same way" is
     a concentration; "three of eleven" is a coincidence, and a single
     number cannot tell them apart. */
  const withAnyDirection = followed.filter(
    (f) => f.swing || f.position,
  ).length;
  const sameDirection =
    chartDirection === "up" || chartDirection === "down"
      ? followed.filter(
          (f) =>
            f.swing?.direction === chartDirection ||
            f.position?.direction === chartDirection,
        ).length
      : 0;

  return {
    isFollowed: list.includes(symbol),
    followed,
    sameDirection,
    withAnyDirection,
    closeMovers: followed
      .filter((f) => f.correlation !== null && f.correlation >= CLOSE_ENOUGH)
      .map((f) => ({ ticker: f.ticker, correlation: f.correlation! }))
      .sort((a, b) => b.correlation - a.correlation),
    scanAsOf: scan?.asOf ?? null,
    correlationAsOf: correlations?.asOf ?? null,
    correlationWeeks: correlations?.weeks ?? null,
  };
}
