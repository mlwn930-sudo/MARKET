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
  /* The server copy is kept in step HERE rather than in toggleWatch,
     because this is the one function every path goes through.
     toggleWatch is only the star on a company page; the watchlist board
     adds and removes by calling this directly, and so does the thesis
     notebook. Syncing in the caller meant a company added from the
     watchlist page — the main way anyone adds one — never reached the
     alerts at all. */
  const before = new Set(getWatchlist());
  const next = [...new Set(tickers.map((t) => t.toUpperCase()))];
  write(LIST_KEY, next);

  const after = new Set(next);
  for (const ticker of after) if (!before.has(ticker)) syncFollow(ticker, true);
  for (const ticker of before) if (!after.has(ticker)) syncFollow(ticker, false);

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

/* ------------------------------------------------------------------ */
/* Telling the server, for the alerts                                  */
/* ------------------------------------------------------------------ */

/**
 * Who this browser is, as given at the door.
 *
 * Stored so the star on a company page can say which watchlist it just
 * changed. Nothing else uses it, and it is never sent anywhere except to
 * this site's own follow route.
 *
 * localStorage rather than sessionStorage on purpose: the session flag at
 * the gate should expire so the door is seen again, and the identity
 * should not — being asked to retype an address on every visit to keep
 * alerts working is the kind of friction that ends with alerts switched
 * off.
 */
const EMAIL_KEY = "market-intel:email:v1";

export function rememberEmail(email: string): void {
  write(EMAIL_KEY, email);
}

export function knownEmail(): string | null {
  const value = read<string | null>(EMAIL_KEY, null);
  return typeof value === "string" && value.includes("@") ? value : null;
}

/**
 * Mirrors one change to the server.
 *
 * Deliberately not awaited by the caller and deliberately silent on
 * failure. The browser list is the one the reader is looking at, and it
 * has already been updated by the time this runs; a star that un-stars
 * itself because a network call failed would be a worse bug than a
 * watchlist that is briefly out of step with the mail.
 *
 * Someone who never gave an address simply skips this, and their
 * watchlist stays exactly as local as it always was.
 */
export function syncFollow(ticker: string, following: boolean): void {
  const email = knownEmail();
  if (!email) return;
  /* The signature is invalidated BEFORE the request, not after it. If this
     call never lands — offline, a closed tab, a bad minute — the next page
     load sees a mismatch and pushes the whole list. Clearing it afterwards
     would mean a lost call is never noticed. */
  try {
    window.localStorage.removeItem("market-intel:watchlist-synced:v2");
  } catch {}
  void fetch("/api/alerts/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      email,
      ticker,
      action: following ? "follow" : "unfollow",
    }),
    keepalive: true,
  }).catch(() => {
    /* Offline, or the route is not configured. The local list stands. */
  });
}

/**
 * Pushes the whole local list to the server, once per browser session.
 *
 * Needed because the sync above only fires on a change, and a watchlist
 * that was built before any of this existed never changes until the
 * reader touches it. Without this, someone who followed twelve companies
 * last week would get alerts about none of them.
 *
 * Guarded by a session flag rather than a timestamp: once per session is
 * often enough to catch a list that moved on another device, and rare
 * enough that it costs one request.
 */
/**
 * Keeps the server's copy identical to this browser's, on every load.
 *
 * The first version ran once per session and only added. Both were wrong
 * for the thing a watchlist is: adding a company and removing one have to
 * reach the agent by themselves, every time, or the list on screen and the
 * list being mailed about quietly drift apart.
 *
 * So it compares a signature of the local list against the last one it
 * successfully sent. Identical means nothing to do and no request. Any
 * difference — an add, a removal, or a sync that failed earlier and was
 * never retried — sends the whole list and records the signature only
 * after the server confirms. A failed call therefore retries on the next
 * page load instead of waiting for a new session.
 */
const SYNCED_KEY = "market-intel:watchlist-synced:v2";

function signature(list: string[]): string {
  return [...list].sort().join(",");
}

export function reconcileWatchlist(): void {
  if (typeof window === "undefined") return;
  const email = knownEmail();
  if (!email) return;

  const tickers = getWatchlist();
  const sig = signature(tickers);

  /* An empty list is not pushed. It means "nothing to say" far more often
     than "I follow nothing" — a page can run this before localStorage has
     been read — and the server refuses an empty replace for the same
     reason. Removing the last company is done by unfollowing it. */
  if (tickers.length === 0) return;

  try {
    if (window.localStorage.getItem(SYNCED_KEY) === sig) return;
  } catch {
    /* No storage: send every load rather than never. */
  }

  void fetch("/api/alerts/follow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, action: "replace", tickers }),
  })
    .then((res) => {
      /* Recorded only on success, so a failure is retried next load. */
      if (!res.ok) return;
      try {
        window.localStorage.setItem(SYNCED_KEY, sig);
      } catch {}
    })
    .catch(() => {});
}
