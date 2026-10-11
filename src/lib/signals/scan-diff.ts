/**
 * What changed between two daily scans.
 *
 * Pure, and in its own file so it can be tested without running the
 * four-minute build that produces its input. It was written inline in
 * `scripts/build-ranks.ts` first, which meant the one piece of logic
 * here that is easy to get wrong had no way to be checked.
 *
 * That piece is the same-session re-run. Run the build twice in a day
 * and a naive diff compares today against today, finds nothing, and
 * silently erases a real morning's movement — the page would then show
 * "nothing changed" on a day when four names turned. So a scan already
 * on the current session carries its previous comparison forward
 * untouched rather than recomputing it against itself.
 */

export type ScanRowLike = {
  symbol: string;
  horizons: { horizon: string; direction: string }[];
};

export type ScanComparison = {
  /** The session compared against, or null when there is nothing to
   *  compare and the page should say so rather than show three empty
   *  lists, which read as "nothing moved". */
  previousAsOf: string | null;
  entered: string[];
  left: string[];
  flipped: { symbol: string; from: string; to: string }[];
};

export type PriorScan = {
  asOf?: string;
  previousAsOf?: string | null;
  entered?: string[];
  left?: string[];
  flipped?: { symbol: string; from: string; to: string }[];
  names?: ScanRowLike[];
};

const EMPTY: ScanComparison = {
  previousAsOf: null,
  entered: [],
  left: [],
  flipped: [],
};

/** A name's state as one comparable string. Sorted, so the order the
 *  horizons happen to be written in cannot register as a change. */
export function directionsOf(row: ScanRowLike): string {
  return row.horizons
    .map((h) => `${h.horizon}:${h.direction}`)
    .sort()
    .join(",");
}

export function compareScans(
  current: { asOf: string; names: ScanRowLike[] },
  prior: PriorScan | null,
): ScanComparison {
  if (!prior?.asOf || !Array.isArray(prior.names)) return EMPTY;

  /* Already on this session: keep the comparison that was computed when
     the session first produced a scan. */
  if (prior.asOf === current.asOf) {
    return {
      previousAsOf: prior.previousAsOf ?? null,
      entered: prior.entered ?? [],
      left: prior.left ?? [],
      flipped: prior.flipped ?? [],
    };
  }

  const before = new Map(prior.names.map((r) => [r.symbol, directionsOf(r)]));
  const now = new Map(current.names.map((r) => [r.symbol, directionsOf(r)]));

  return {
    previousAsOf: prior.asOf,
    entered: [...now.keys()].filter((k) => !before.has(k)).sort(),
    left: [...before.keys()].filter((k) => !now.has(k)).sort(),
    flipped: [...now]
      .filter(([k, v]) => before.has(k) && before.get(k) !== v)
      .map(([k, v]) => ({ symbol: k, from: before.get(k)!, to: v }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol)),
  };
}
