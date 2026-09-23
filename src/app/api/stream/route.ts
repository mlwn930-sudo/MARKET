import { subscribeToTrades } from "@/lib/server/finnhub-socket";

/**
 * Real trades, streamed to the browser.
 *
 * Finnhub publishes a trade websocket and it takes the API key in the
 * connection URL, so a browser opening it directly would publish that key to
 * anyone who looks at the network tab. This route is how to use it anyway:
 * the socket is held on the server, where the key stays, and the prints are
 * forwarded to the page over Server-Sent Events.
 *
 * SSE rather than a socket back to the browser, because the data travels one
 * way and EventSource reconnects on its own. That matters on a serverless
 * host, where a response cannot live indefinitely — so this closes itself a
 * little before the platform's limit and lets the browser reconnect. The
 * seam is invisible: the upstream socket is not owned by this response (see
 * lib/server/finnhub-socket.ts), so cycling costs nothing and the page keeps
 * its last price throughout.
 *
 * What this cannot do is invent activity. Outside market hours the exchange
 * publishes no trades, so the stream connects and stays quiet. That is
 * correct, and the page says which of the two is happening rather than
 * leaving a still number looking broken.
 */

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Closed before the platform's own timeout, so the client reconnects on a
 *  clean shutdown rather than on a dropped connection. */
const LIFETIME_MS = 50_000;
/** Keeps proxies from closing an idle connection, and gives the client a
 *  heartbeat it can use to tell a quiet market from a dead stream. */
const HEARTBEAT_MS = 15_000;
const MAX_SYMBOLS = 25;

export async function GET(request: Request) {
  if (!process.env.FINNHUB_API_KEY) {
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
      let detach: (() => void) | null = null;
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
        detach?.();
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      }

      // The browser navigating away or the hook unmounting lands here.
      request.signal.addEventListener("abort", shutdown);

      detach = subscribeToTrades(symbols, {
        onTicks(ticks) {
          send(
            "ticks",
            ticks.map((tick) => ({
              symbol: tick.symbol,
              price: tick.price,
              at: tick.at,
              size: tick.size,
            })),
          );
        },
        onState(state) {
          send("status", state === "connected" ? { state, symbols } : { state });
        },
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
      // Nginx and some CDNs buffer responses by default, which would hold
      // the ticks back until the stream ended — turning a live feed into a
      // batch delivery.
      "X-Accel-Buffering": "no",
    },
  });
}
