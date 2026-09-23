import WebSocket from "ws";

/**
 * One upstream trade socket per server process, shared by every reader.
 *
 * The browser side already multiplexes: a tab opens one SSE request for the
 * union of the symbols its components want. That was not enough, and the
 * failure was instructive.
 *
 * An SSE response cannot live for ever on a serverless host, so the route
 * closes itself before the platform's timeout and the browser reconnects.
 * When each response owned its own upstream socket, every one of those
 * cycles left a socket that the upstream still counted as open — it is only
 * torn down when the abort propagates, which is neither immediate nor, in
 * some runtimes, reliable. The next connection therefore asked for a second
 * concurrent socket on a feed that allows one, was refused with 429,
 * retried, was refused again, and the page sat on a price that never moved
 * while the network tab filled with dozens of requests.
 *
 * So the socket is no longer owned by a request. It lives here, opens on
 * the first subscriber, stays open across the SSE cycles above it, and
 * closes only once nothing has wanted it for a while. Reconnecting the
 * response is now free.
 *
 * Symbols are the union of what subscribers want. New ones are subscribed
 * on the existing socket rather than by reopening it, which is what the
 * upstream protocol is for.
 */

export type Tick = { symbol: string; price: number; at: number; size: number };

type Subscriber = {
  symbols: Set<string>;
  onTicks: (ticks: Tick[]) => void;
  onState: (state: "connected" | "limited" | "error") => void;
};

const subscribers = new Set<Subscriber>();

let socket: WebSocket | null = null;
let connected = false;
/** Symbols currently subscribed on the open socket. */
const active = new Set<string>();
let retry: ReturnType<typeof setTimeout> | null = null;
let idle: ReturnType<typeof setTimeout> | null = null;
let attempts = 0;

/** The upstream cap on a free connection. */
const MAX_SYMBOLS = 45;
/** Kept open briefly with no subscribers, because the SSE layer above
 *  reconnects every fifty seconds by design and tearing the upstream down
 *  in that gap is what caused the problem this module exists to fix. */
const IDLE_MS = 90_000;
const MAX_ATTEMPTS = 6;

function broadcast(state: "connected" | "limited" | "error") {
  for (const subscriber of subscribers) subscriber.onState(state);
}

function wanted(): string[] {
  const union = new Set<string>();
  for (const subscriber of subscribers) {
    for (const symbol of subscriber.symbols) union.add(symbol);
  }
  return [...union].slice(0, MAX_SYMBOLS);
}

/** Brings the socket's subscriptions in line with what is wanted, without
 *  reopening it. */
function reconcile() {
  if (!socket || !connected) return;

  const target = new Set(wanted());

  for (const symbol of target) {
    if (active.has(symbol)) continue;
    socket.send(JSON.stringify({ type: "subscribe", symbol }));
    active.add(symbol);
  }

  for (const symbol of [...active]) {
    if (target.has(symbol)) continue;
    socket.send(JSON.stringify({ type: "unsubscribe", symbol }));
    active.delete(symbol);
  }
}

function open() {
  const key = process.env.FINNHUB_API_KEY;
  if (!key || socket) return;

  attempts++;
  const instance = new WebSocket(`wss://ws.finnhub.io?token=${key}`);
  socket = instance;

  instance.on("open", () => {
    connected = true;
    attempts = 0;
    active.clear();
    reconcile();
    broadcast("connected");
  });

  instance.on("message", (payload: WebSocket.RawData) => {
    let message: { type?: string; data?: unknown[] };
    try {
      message = JSON.parse(payload.toString());
    } catch {
      return;
    }
    if (message.type !== "trade" || !Array.isArray(message.data)) return;

    // Several prints in one symbol can arrive in a single frame. Only the
    // last is a price; forwarding all of them makes the page render a
    // flicker of stale prints to land on the same number.
    const latest = new Map<string, Tick>();
    for (const row of message.data as {
      s?: string;
      p?: number;
      t?: number;
      v?: number;
    }[]) {
      if (!row.s || typeof row.p !== "number" || !Number.isFinite(row.p)) {
        continue;
      }
      const at = row.t ?? Date.now();
      const previous = latest.get(row.s);
      if (!previous || at >= previous.at) {
        latest.set(row.s, {
          symbol: row.s,
          price: row.p,
          at,
          size: row.v ?? 0,
        });
      }
    }
    if (latest.size === 0) return;

    const ticks = [...latest.values()];
    for (const subscriber of subscribers) {
      const mine = ticks.filter((tick) => subscriber.symbols.has(tick.symbol));
      if (mine.length > 0) subscriber.onTicks(mine);
    }
  });

  instance.on("error", (error: Error) => {
    // A 429 on the handshake means something else already holds the one
    // allowed connection — another server instance, or an orphan that has
    // not timed out yet. Reported separately so the client waits rather
    // than concluding the stream is unavailable.
    broadcast(/\b429\b/.test(error.message) ? "limited" : "error");
  });

  instance.on("close", () => {
    if (socket !== instance) return;
    socket = null;
    connected = false;
    active.clear();

    if (subscribers.size === 0 || attempts >= MAX_ATTEMPTS) return;

    // Backed off, because the usual reason for a failed reopen is the
    // upstream still counting the connection that just closed.
    retry = setTimeout(open, Math.min(2000 * attempts, 15_000));
  });
}

/**
 * Receive trades for a set of symbols. Returns the unsubscribe function.
 *
 * Attaching costs nothing when the socket is already open — the symbols are
 * added to the existing subscription. The first subscriber opens it; the
 * last one leaving starts an idle timer rather than closing immediately.
 */
export function subscribeToTrades(
  symbols: string[],
  handlers: {
    onTicks: (ticks: Tick[]) => void;
    onState: (state: "connected" | "limited" | "error") => void;
  },
): () => void {
  const subscriber: Subscriber = {
    symbols: new Set(symbols),
    onTicks: handlers.onTicks,
    onState: handlers.onState,
  };

  if (idle) {
    clearTimeout(idle);
    idle = null;
  }

  subscribers.add(subscriber);

  if (!socket) {
    attempts = 0;
    if (retry) {
      clearTimeout(retry);
      retry = null;
    }
    open();
  } else if (connected) {
    reconcile();
    subscriber.onState("connected");
  }

  return () => {
    subscribers.delete(subscriber);

    if (subscribers.size > 0) {
      reconcile();
      return;
    }

    idle = setTimeout(() => {
      idle = null;
      if (subscribers.size > 0) return;
      socket?.close();
      socket = null;
      connected = false;
      active.clear();
    }, IDLE_MS);
  };
}
