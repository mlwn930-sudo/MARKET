"use client";

/**
 * One trade stream per tab, shared by everything that wants ticks.
 *
 * The rule that forces this design: the upstream feed accepts a single
 * concurrent connection, and a second one is refused with 429. That makes
 * "open a stream in a hook" quietly wrong, because there are at least three
 * ways to end up with two of them —
 *
 *   React's development strict mode mounts every effect twice, so a single
 *   component opens two connections and the second kills the first;
 *
 *   two components on one page can both want prices, and on this site they
 *   do — a watchlist and a header quote are separate components;
 *
 *   a reconnect can race the socket it is replacing, so the old connection
 *   is still counted upstream while the new one shakes hands.
 *
 * So connections live here instead, keyed by symbol set and reference
 * counted. Subscribing twice to the same symbols costs one connection; the
 * last unsubscribe closes it, after a short grace period so that a
 * navigation between two pages watching the same symbols does not tear the
 * stream down and immediately rebuild it.
 */

export type Tick = { symbol: string; price: number; at: number };
export type StreamState = "live" | "connecting" | "limited" | "failed";

type Listener = {
  onTicks: (ticks: Tick[]) => void;
  onState: (state: StreamState) => void;
};

type Connection = {
  source: EventSource | null;
  listeners: Set<Listener>;
  state: StreamState;
  failures: number;
  limited: boolean;
  retry: ReturnType<typeof setTimeout> | null;
  closing: ReturnType<typeof setTimeout> | null;
};

const connections = new Map<string, Connection>();

/** Attempts before the stream is declared unavailable and the caller falls
 *  back to polling. Generous, because most failures here are the route
 *  cycling itself rather than a fault. */
const MAX_FAILURES = 8;
/** How long a connection is kept alive with no listeners, so a navigation
 *  between two pages that want the same symbols reuses it. */
const GRACE_MS = 3000;

function announce(connection: Connection, state: StreamState) {
  connection.state = state;
  for (const listener of connection.listeners) listener.onState(state);
}

function open(key: string) {
  const connection = connections.get(key);
  if (!connection || connection.source) return;

  connection.limited = false;
  announce(connection, connection.state === "live" ? "connecting" : connection.state);

  const source = new EventSource(
    `/api/stream?symbols=${encodeURIComponent(key)}`,
  );
  connection.source = source;

  source.addEventListener("status", (event) => {
    const payload = JSON.parse((event as MessageEvent).data) as {
      state: string;
    };

    if (payload.state === "connected") {
      connection.failures = 0;
      announce(connection, "live");
      return;
    }

    // Refused for rate limiting rather than broken. The retry below waits
    // longer for this, because the thing to wait for is the upstream
    // allowance recovering — retrying immediately just spends it again.
    if (payload.state === "limited") {
      connection.limited = true;
      announce(connection, "limited");
    }
  });

  source.addEventListener("ticks", (event) => {
    const rows = JSON.parse((event as MessageEvent).data) as Tick[];
    connection.failures = 0;
    if (connection.state !== "live") announce(connection, "live");
    for (const listener of connection.listeners) listener.onTicks(rows);
  });

  source.onerror = () => {
    source.close();
    connection.source = null;

    // No listeners left: the cleanup path already ran, nothing to retry for.
    if (connection.listeners.size === 0) return;

    connection.failures++;
    if (connection.failures >= MAX_FAILURES) {
      announce(connection, "failed");
      return;
    }

    const wait = connection.limited
      ? Math.min(3000 * connection.failures, 20_000)
      : Math.min(500 * connection.failures, 4000);

    announce(connection, connection.limited ? "limited" : "connecting");
    connection.retry = setTimeout(() => open(key), wait);
  };
}

function teardown(key: string) {
  const connection = connections.get(key);
  if (!connection) return;

  if (connection.retry) clearTimeout(connection.retry);
  if (connection.closing) clearTimeout(connection.closing);
  connection.source?.close();
  connections.delete(key);
}

/**
 * Receive ticks for a set of symbols. Returns the unsubscribe function.
 *
 * The symbol string is the identity of the connection, so callers that want
 * the same symbols in the same order share one. Callers that want different
 * sets get different connections — which the upstream limit means should be
 * avoided, and is why the pages here pass one combined list rather than one
 * per component.
 */
export function subscribeToTicks(
  key: string,
  listener: Listener,
): () => void {
  let connection = connections.get(key);

  if (!connection) {
    connection = {
      source: null,
      listeners: new Set(),
      state: "connecting",
      failures: 0,
      limited: false,
      retry: null,
      closing: null,
    };
    connections.set(key, connection);
  }

  // A listener arriving during the grace period cancels the shutdown.
  if (connection.closing) {
    clearTimeout(connection.closing);
    connection.closing = null;
  }

  connection.listeners.add(listener);
  listener.onState(connection.state);

  if (!connection.source && !connection.retry) open(key);

  return () => {
    const current = connections.get(key);
    if (!current) return;

    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;

    current.closing = setTimeout(() => teardown(key), GRACE_MS);
  };
}
