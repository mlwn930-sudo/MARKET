"use client";

/**
 * The watchlist, and what it looked like last time.
 *
 * Kept in localStorage, which is a deliberate choice and not a shortcut.
 * The project has no database and no accounts; a watchlist is the smallest
 * possible piece of personal state, and putting it on the reader's own
 * machine keeps it working without either. The cost is honest and stated on
 * the page: the list does not follow you to another browser.
 *
 * Two things are stored, not one. The list is what the reader chose to
 * follow. The snapshot is what those companies looked like the last time
 * the page was open — and the difference between the snapshot and now is
 * the only reason a watchlist beats a list of links.
 */

const LIST_KEY = "market-intel:watchlist:v1";
const SNAPSHOT_KEY = "market-intel:watchlist-snapshot:v1";

/** Fired when the list changes, so a star on a company page and the board
 *  on the watchlist page never disagree within one tab. The storage event
 *  covers other tabs; it does not fire in the tab that wrote. */
export const WATCHLIST_EVENT = "market-intel:watchlist";

export type SnapshotRow = {
  price: number | null;
  filingAsOf: string | null;
  newsCount: number;
};

export type Snapshot = {
  checkedAt: string;
  rows: Record<string, SnapshotRow>;
};

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    // A browser with storage disabled gets a watchlist that lasts the
    // session. It does not get an exception on every render.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* Quota or a private window. Nothing here is worth failing a render. */
  }
}

export function getWatchlist(): string[] {
  const list = read<string[]>(LIST_KEY, []);
  return Array.isArray(list)
    ? list.filter((t) => typeof t === "string").slice(0, 40)
    : [];
}

export function setWatchlist(tickers: string[]): void {
  write(LIST_KEY, [...new Set(tickers.map((t) => t.toUpperCase()))]);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(WATCHLIST_EVENT));
  }
}

export function isWatched(ticker: string): boolean {
  return getWatchlist().includes(ticker.toUpperCase());
}

/** Returns the new state, so a button can render from the return value
 *  rather than reading storage again. */
export function toggleWatch(ticker: string): boolean {
  const symbol = ticker.toUpperCase();
  const current = getWatchlist();
  const next = current.includes(symbol)
    ? current.filter((t) => t !== symbol)
    : [...current, symbol];
  setWatchlist(next);
  return next.includes(symbol);
}

export function getSnapshot(): Snapshot | null {
  const snapshot = read<Snapshot | null>(SNAPSHOT_KEY, null);
  return snapshot && typeof snapshot.checkedAt === "string" && snapshot.rows
    ? snapshot
    : null;
}

export function saveSnapshot(snapshot: Snapshot): void {
  write(SNAPSHOT_KEY, snapshot);
}

/* ------------------------------------------------------------------ */
/* What changed                                                        */
/* ------------------------------------------------------------------ */

export type Change = {
  ticker: string;
  kind: "price" | "filing" | "news" | "new";
  text: string;
  /** Only a price change may carry a direction. */
  direction?: "up" | "down";
};

/** Below this a price move is not news, it is a market being open. The
 *  threshold is a judgement and it is printed on the page rather than
 *  hidden here. */
export const PRICE_MOVE_THRESHOLD = 3;

export function diffAgainst(
  snapshot: Snapshot | null,
  rows: {
    ticker: string;
    price: number | null;
    filingAsOf: string | null;
    news: { count: number };
  }[],
): Change[] {
  if (!snapshot) return [];

  const changes: Change[] = [];

  for (const row of rows) {
    const before = snapshot.rows[row.ticker];
    if (!before) {
      changes.push({
        ticker: row.ticker,
        kind: "new",
        text: "נוספה לרשימה מאז הבדיקה הקודמת",
      });
      continue;
    }

    if (
      before.price !== null &&
      row.price !== null &&
      Number.isFinite(before.price) &&
      before.price !== 0
    ) {
      const move = ((row.price - before.price) / before.price) * 100;
      if (Math.abs(move) >= PRICE_MOVE_THRESHOLD) {
        changes.push({
          ticker: row.ticker,
          kind: "price",
          direction: move > 0 ? "up" : "down",
          text: `המחיר זז ${move > 0 ? "+" : "−"}${Math.abs(move).toFixed(1)}% מאז הביקור הקודם`,
        });
      }
    }

    // The signal a research watchlist exists for: new numbers to read.
    if (row.filingAsOf && row.filingAsOf !== before.filingAsOf) {
      changes.push({
        ticker: row.ticker,
        kind: "filing",
        text: `דוח חדש נקלט — המדדים עודכנו לתקופה שהסתיימה ${row.filingAsOf}`,
      });
    }

    const newStories = row.news.count - before.newsCount;
    if (newStories > 0) {
      changes.push({
        ticker: row.ticker,
        kind: "news",
        text: `${newStories} כתבות חדשות בפיד מאז הביקור הקודם`,
      });
    }
  }

  return changes;
}
