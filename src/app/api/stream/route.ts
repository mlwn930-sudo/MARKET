import WebSocket from "ws";

/**
 * Real trades, streamed to the browser.
 *
 * Finnhub publishes a trade websocket, and it takes the API key in the
 * connection URL — so a browser opening it directly would publish that key to
 * anyone who looks at the network tab. This route is the way to use it
 * anyway: the socket is opened here, on the server, where the key stays, and
 * the ticks are forwarded to the page over Server-Sent Events.
 *
 * SSE rather than a websocket back to the browser, because the data only
 * travels one way and EventSource reconnects on its own. That matters on a
 * serverless host: the function has a maximum lifetime, so this deliberately
 * closes itself a little before that limit and lets the browser reconnect.
 * The seam is invisible — a reconnect costs a fraction of a second, and the
 * page keeps the last price throughout.
 *
 * What this cannot do is invent activity. Outside market hours the exchange
 * publishes no trades, so the stream connects and stays quiet. That is the
 * correct behaviour, and the page says which of the two is happening rather
 * than leaving a still number looking broken.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Closed before the platform's own timeout so the client reconnects on a
 *  clean shutdown rather than on a dropped connection. */
const LIFETIME_MS = 50_000;
/** Keeps proxies from closing an idle connection, and gives the client a
 *  heartbeat it can use to tell "quiet market" from "dead stream". */
const HEARTBEAT_MS = 15_000;
const MAX_SYMBOLS = 25;

export async function GET(request: Request) {
  const key = process.env.FINNHUB_API_KEY;
  if (!key) {
    return new Response("stream unavailable", { status: 503 });
  }

  const raw = new URL(request.url).searchParams.get("symbols") ?? "";
  const symbols = [
    ...new Set(
      raw
        .split(",")
        .map((s) => s.trim().toUpperCase())
        .filter((s) => /^[A-Z.\-]{1,10}$/.test(s)),
    ),
  ].slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return new Response("no valid symbols", { status: 400 });
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;
      let socket: WebSocket | null = null;
      let heartbeat: ReturnType<typeof setInterval> | null = null;
      let lifetime: ReturnType<typeof setTimeout> | null = null;

      const send = (event: string, data: unknown) => {
        if (closed) return;
        try {
          controller.enqueue(
            encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
          );
        } catch {
          // The client went away between the check and the write.
          shutdown();
        }
      };

      function shutdown() {
        if (closed) return;
        closed = true;
        if (heartbeat) clearInterval(heartbeat);
        if (lifetime) clearTimeout(lifetime);
        try {
          socket?.close();
        } catch {
          /* already gone */
        }
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      // The browser navigating away or the hook unmounting lands here.
      request.signal.addEventListener("abort", shutdown);

      socket = new WebSocket(`wss://ws.finnhub.io?token=${key}`);

      socket.on("open", () => {
        for (const symbol of symbols) {
          socket?.send(JSON.stringify({ type: "subscribe", symbol }));
        }
        send("status", { state: "connected", symbols });
      });

      socket.on("message", (payload: WebSocket.RawData) => {
        let message: { type?: string; data?: unknown[] };
        try {
          message = JSON.parse(payload.toString());
        } catch {
          return;
        }

        if (message.type !== "trade" || !Array.isArray(message.data)) return;

        // Several trades in the same symbol can arrive in one frame. Only the
        // last one is a price; forwarding all of them would make the page
        // render a flicker of stale prints to land on the same number.
        const latest = new Map<string, { price: number; at: number; size: number }>();

        for (const row of message.data as {
          s?: string;
          p?: number;
          t?: number;
          v?: number;
        }[]) {
          if (!row.s || typeof row.p !== "number" || !Number.isFinite(row.p)) {
            continue;
          }
          const previous = latest.get(row.s);
          const at = row.t ?? Date.now();
          if (!previous || at >= previous.at) {
            latest.set(row.s, { price: row.p, at, size: row.v ?? 0 });
          }
        }

        if (latest.size === 0) return;

        send(
          "ticks",
          [...latest.entries()].map(([symbol, tick]) => ({
            symbol,
            price: tick.price,
            at: tick.at,
            size: tick.size,
          })),
        );
      });

      socket.on("error", (error: Error) => {
        // A 429 on the handshake is the REST polling and this socket
        // competing for one rate-limit budget, not a broken stream. It is
        // reported separately so the client waits and retries rather than
        // concluding that streaming is unavailable and giving up on it for
        // the rest of the session.
        const limited = /\b429\b/.test(error.message);
        send("status", { state: limited ? "limited" : "error" });
        shutdown();
      });

      socket.on("close", () => {
        shutdown();
      });

      heartbeat = setInterval(() => send("beat", { at: Date.now() }), HEARTBEAT_MS);

      // A clean, expected end. The client treats this as "reconnect now"
      // rather than as a failure, so no error is ever shown for it.
      lifetime = setTimeout(() => {
        send("status", { state: "cycling" });
        shutdown();
      }, LIFETIME_MS);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      // Nginx and some CDNs buffer responses by default, which would hold the
      // ticks back until the stream ended — turning a live feed into a batch.
      "X-Accel-Buffering": "no",
    },
  });
}
