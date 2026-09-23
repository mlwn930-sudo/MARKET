"use client";

/**
 * One trade stream per tab, multiplexed across everything that wants ticks.
 *
 * The rule that forces this design: the upstream feed accepts a single
 * concurrent connection, and a second one is refused with 429.
 *
 * The first version keyed a connection per symbol set, which fixed strict
 * mode mounting effects twice but not the real case. A launch page asks for
 * three things at once — the hero price, the chart, and the value chain
 * below it — and the first two want one symbol while the third wants four.
 * Two different sets, two connections, and the second one refused. The page
 * sat on "polling" with a price that never moved.
 *
 * So there is exactly one connection now, and it carries the union of every
 * symbol anyone has asked for. Subscribers receive only the symbols they
 * asked about. When the union changes the socket is reopened with the new
 * set, debounced, because a page mounting three components in one frame
 * should reconnect once rather than three times.
 */

export type Tick = { symbol: string; price: number; at: number };
export type StreamState = "live" | "connecting" | "limited" | "failed";

type Listener = {
  symbols: string[];
  onTicks: (ticks: Tick[]) => void;
  onState: (state: StreamState) => void;
};

const listeners = new Set<Listener>();

let source: EventSource | null = null;
let state: StreamState = "connecting";
let failures = 0;
let limited = false;
let subscribed = "";
let retry: ReturnType<typeof setTimeout> | null = null;
let settle: ReturnType<typeof setTimeout> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;

/** Attempts before the stream is declared unavailable and callers fall back
 *  to polling. Generous, because most failures are the route cycling itself
 *  rather than a fault. */
const MAX_FAILURES = 8;
/** Components mounting together should produce one connection, not one per
 *  component. Long enough to collect a render, short enough to be invisible. */
const SETTLE_MS = 120;
/** Kept alive briefly with no listeners, so navigating between two pages
 *  that both want prices does not tear the stream down and rebuild it. */
const IDLE_MS = 3000;
/** The upstream cap. Past this the oldest requests are dropped rather than
 *  the connection being refused outright. */
const MAX_SYMBOLS = 25;

function wanted(): string {
  const union = new Set<string>();
  for (const listener of listeners) {
    for (const symbol of listener.symbols) union.add(symbol);
  }
  return [...union].sort().slice(0, MAX_SYMBOLS).join(",");
}

function announce(next: StreamState) {
  state = next;
  for (const listener of listeners) listener.onState(next);
}

function close() {
  source?.close();
  source = null;
  subscribed = "";
}

function connect() {
  if (retry) {
    clearTimeout(retry);
    retry = null;
  }

  const symbols = wanted();
  if (symbols.length === 0) {
    close();
    return;
  }

  // Already streaming exactly this set — nothing to do.
  if (source && subscribed === symbols) return;

  close();
  limited = false;
  if (state !== "live") announce("connecting");

  subscribed = symbols;
  const stream = new EventSource(
    `/api/stream?symbols=${encodeURIComponent(symbols)}`,
  );
  source = stream;

  stream.addEventListener("status", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as {
      state: string;
    };

    if (payload.state === "connected") {
      failures = 0;
      announce("live");
      return;
    }

    // Refused for rate limiting rather than broken. The retry waits longer
    // for this: the thing to wait for is the upstream allowance recovering,
    // and reconnecting immediately just spends it again.
    if (payload.state === "limited") {
      limited = true;
      announce("limited");
    }
  });

  stream.addEventListener("ticks", (event) => {
    const rows = JSON.parse((event as MessageEvent).data) as Tick[];
    failures = 0;
    if (state !== "live") announce("live");

    // Each subscriber sees only what it asked for. A watchlist component
    // should not re-render because an unrelated symbol on another panel
    // printed.
    for (const listener of listeners) {
      const mine = rows.filter((row) => listener.symbols.includes(row.symbol));
      if (mine.length > 0) listener.onTicks(mine);
    }
  });

  stream.onerror = () => {
    if (source !== stream) return; // superseded by a newer connection
    close();

    if (listeners.size === 0) return;

    failures++;
    if (failures >= MAX_FAILURES) {
      announce("failed");
      return;
    }

    const wait = limited
      ? Math.min(3000 * failures, 20_000)
      : Math.min(500 * failures, 4000);

    announce(limited ? "limited" : "connecting");
    retry = setTimeout(connect, wait);
  };
}

/** Coalesces the reconnects that a page mounting several components in one
 *  frame would otherwise trigger. */
function schedule() {
  if (settle) clearTimeout(settle);
  settle = setTimeout(() => {
    settle = null;
    connect();
  }, SETTLE_MS);
}

/**
 * Receive ticks for a set of symbols. Returns the unsubscribe function.
 *
 * Callers pass whatever they need; the manager works out the union. There
 * is no benefit to combining symbol lists at the call site and no penalty
 * for not doing so.
 */
export function subscribeToTicks(
  key: string,
  handlers: {
    onTicks: (ticks: Tick[]) => void;
    onState: (state: StreamState) => void;
  },
): () => void {
  const listener: Listener = {
    symbols: key.split(",").filter(Boolean),
    onTicks: handlers.onTicks,
    onState: handlers.onState,
  };

  if (idle) {
    clearTimeout(idle);
    idle = null;
  }

  listeners.add(listener);
  listener.onState(state);

  // Only reconnect when this subscriber actually widens the set. A second
  // component asking for symbols already on the wire costs nothing.
  const covered = subscribed.split(",");
  if (!source || listener.symbols.some((s) => !covered.includes(s))) {
    schedule();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      idle = setTimeout(() => {
        idle = null;
        if (listeners.size === 0) {
          close();
          failures = 0;
        }
      }, IDLE_MS);
      return;
    }

    // Narrowing the set is not urgent — the extra symbols cost nothing on
    // an open connection, and reconnecting to drop them would cost a gap in
    // the prices that remain.
  };
}
