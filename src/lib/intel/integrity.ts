/**
 * What the site knows about what it knows.
 *
 * Every figure on this site already carries a source somewhere. What it
 * did not carry is *age with a verdict attached* — the difference between
 * a price printed four seconds ago and the same price printed on Friday
 * afternoon, shown identically on a Sunday.
 *
 * A `Fact` is a value plus the six things that decide whether a reader
 * should act on it: where it came from, when the source published it,
 * when this site fetched it, when it was last confirmed, how fresh that
 * makes it, and how much the site trusts the value itself.
 *
 * The distinction that matters most here is between **freshness** and
 * **confidence**, because they move independently and collapsing them is
 * the usual mistake. A 10-Q from four months ago has high confidence and
 * is historical: the number is a matter of record and it describes a
 * period that ended. A live quote has high freshness and medium
 * confidence: it is a single print that a late correction can revise.
 * One tells you how old; the other tells you how much to lean on it.
 */

export type Freshness =
  /** Arriving now, or within the time one would expect a new print. */
  | "live"
  /** Behind real time by a known, stated amount. */
  | "delayed"
  /** Not live, but within the window the reader would call current. */
  | "recent"
  /** Old enough that it should not be read as describing now. */
  | "stale"
  /** Describes a period that has ended. Age is expected, not a fault. */
  | "historical"
  /** Nothing came back. */
  | "unavailable";

export const FRESHNESS_LABELS: Record<Freshness, string> = {
  live: "חי",
  delayed: "בהשהיה",
  recent: "עדכני",
  stale: "ישן",
  historical: "היסטורי",
  unavailable: "לא זמין",
};

/**
 * What each state means, shown beside it rather than left to the reader
 * to infer. A six-level scale that is never defined on screen is a scale
 * everyone invents their own meaning for.
 */
export const FRESHNESS_MEANING: Record<Freshness, string> = {
  live: "הנתון התקבל בטווח הזמן שבו מצופה פרינט חדש.",
  delayed: "הנתון מפגר אחרי הזמן האמיתי בפרק זמן ידוע, שמצוין לידו.",
  recent: "לא חי, אבל בתוך החלון שבו סביר לקרוא לו נוכחי.",
  stale: "ישן מספיק כדי שאסור לקרוא אותו כמתאר את המצב עכשיו.",
  historical: "מתאר תקופה שהסתיימה. הגיל כאן צפוי ואינו תקלה.",
  unavailable: "לא התקבל נתון. זה שונה מאפס ושונה מ״לא השתנה״.",
};

/** How much the site trusts the value, independent of how old it is. */
export type DataConfidence = "high" | "medium" | "low";

export const DATA_CONFIDENCE_LABELS: Record<DataConfidence, string> = {
  high: "נתון מדווח",
  medium: "נתון נמדד",
  low: "נתון חלקי",
};

/**
 * The kind of thing being measured, which is what sets the thresholds.
 *
 * Two minutes is stale for a quote and meaningless for a filing. Rather
 * than let every call site invent its own cutoffs — which is how two
 * pages end up disagreeing about whether the same number is current —
 * the windows live here, per kind, in minutes.
 */
export type FactKind =
  | "quote"
  | "index"
  | "filing"
  | "news"
  | "announcement"
  | "computed";

const WINDOWS: Record<FactKind, { live: number; recent: number; stale: number }> =
  {
    /* A traded price. Live while a new print is plausible. */
    quote: { live: 2, recent: 20, stale: 120 },
    index: { live: 5, recent: 30, stale: 180 },
    /* A filing describes a closed period, so it is never "live". The
       window here decides when it stops being the *latest* filing worth
       leaning on — 45 days is the 13F deadline and roughly the gap
       between a quarter ending and the 10-Q landing. */
    filing: { live: 0, recent: 60 * 24 * 45, stale: 60 * 24 * 135 },
    news: { live: 30, recent: 60 * 24, stale: 60 * 24 * 7 },
    /* A company statement — a release date, a guidance note. It does not
       decay on its own; it decays because the company may have changed
       it and nobody re-checked. */
    announcement: { live: 0, recent: 60 * 24 * 30, stale: 60 * 24 * 90 },
    /* Something this site calculated from inputs of its own. */
    computed: { live: 5, recent: 60, stale: 60 * 24 },
  };

export type Fact<T> = {
  value: T | null;
  /** Named so a reader can go and check. */
  source: string;
  sourceUrl?: string;
  /** When the source published it. Null when the source does not say. */
  publishedAt: string | null;
  /** When this site fetched it. */
  retrievedAt: string;
  /**
   * When someone or something last confirmed the value still holds.
   *
   * Distinct from `retrievedAt` on purpose. A release date fetched today
   * from a page written in November was retrieved today and verified in
   * November, and only the second number tells a reader how much to
   * trust it.
   */
  lastVerifiedAt: string | null;
  freshness: Freshness;
  confidence: DataConfidence;
  note?: string;
};

const minutesSince = (iso: string | null): number | null => {
  if (!iso) return null;
  const then = Date.parse(iso);
  if (!Number.isFinite(then)) return null;
  return (Date.now() - then) / 60_000;
};

/**
 * The freshness verdict for a value of a given kind.
 *
 * `marketOpen` matters for a quote and for nothing else: a price that has
 * not moved in three hours is stale on a Tuesday afternoon and is simply
 * Friday's close on a Sunday. Calling the second one "stale" would be
 * technically true and would tell the reader the site is broken.
 */
export function freshnessOf({
  kind,
  at,
  marketOpen = true,
}: {
  kind: FactKind;
  /** The moment the value describes — published, filed or printed. */
  at: string | null;
  marketOpen?: boolean;
}): Freshness {
  if (!at) return "unavailable";

  const age = minutesSince(at);
  if (age === null) return "unavailable";

  if (kind === "filing") {
    /* A filing is historical by nature. What the window decides is
       whether it is the *current* filing or one that should have been
       superseded by now. */
    return age > WINDOWS.filing.stale ? "stale" : "historical";
  }

  if ((kind === "quote" || kind === "index") && !marketOpen) {
    return "delayed";
  }

  const window = WINDOWS[kind];
  if (age <= window.live && window.live > 0) return "live";
  if (age <= window.recent) return "recent";
  if (age <= window.stale) return "delayed";
  return "stale";
}

/** Builds a fact and grades its own freshness. */
export function fact<T>({
  value,
  kind,
  source,
  sourceUrl,
  publishedAt,
  retrievedAt = new Date().toISOString(),
  lastVerifiedAt = null,
  confidence = "high",
  marketOpen = true,
  note,
}: {
  value: T | null;
  kind: FactKind;
  source: string;
  sourceUrl?: string;
  publishedAt: string | null;
  retrievedAt?: string;
  lastVerifiedAt?: string | null;
  confidence?: DataConfidence;
  marketOpen?: boolean;
  note?: string;
}): Fact<T> {
  return {
    value,
    source,
    sourceUrl,
    publishedAt,
    retrievedAt,
    lastVerifiedAt,
    freshness:
      value === null
        ? "unavailable"
        : freshnessOf({ kind, at: publishedAt ?? retrievedAt, marketOpen }),
    confidence,
    note,
  };
}

/** Human age, for printing beside a fact. */
export function ageText(at: string | null): string {
  const minutes = minutesSince(at);
  if (minutes === null) return "—";
  if (minutes < 1) return "הרגע";
  if (minutes < 60) return `לפני ${Math.round(minutes)} דק׳`;
  const hours = minutes / 60;
  if (hours < 24) return `לפני ${Math.round(hours)} שע׳`;
  const days = Math.round(hours / 24);
  if (days < 60) return `לפני ${days} ימים`;
  return `לפני ${Math.round(days / 30)} חודשים`;
}

/* ------------------------------------------------------------------ */
/* Source status                                                       */
/* ------------------------------------------------------------------ */

export type SourceKey = "market" | "news" | "sec" | "fred" | "model";

export const SOURCE_LABELS: Record<SourceKey, string> = {
  market: "מחירים",
  news: "חדשות",
  sec: "דוחות SEC",
  fred: "FRED",
  model: "מודל",
};

export type SourceState = "available" | "delayed" | "stale" | "error";

export const SOURCE_STATE_LABELS: Record<SourceState, string> = {
  available: "זמין",
  delayed: "בהשהיה",
  stale: "ישן",
  error: "תקלה",
};

export type SourceStatus = {
  key: SourceKey;
  state: SourceState;
  /** One line: what the state means for this source right now. */
  detail: string;
  at: string | null;
};
