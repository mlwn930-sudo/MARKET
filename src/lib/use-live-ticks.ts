"use client";

import { useEffect, useRef, useState } from "react";
import {
  marketStatus,
  pollIntervalFor,
  type MarketStatus,
} from "./market-hours";
import { subscribeToTicks } from "./tick-stream";

export type LiveQuote = {
  symbol: string;
  price: number | null;
  change?: number | null;
  changePercent?: number | null;
  high?: number;
  low?: number;
  previousClose?: number;
  at?: string;
};

export type Direction = "up" | "down";

export type FeedState = "live" | "connecting" | "polling" | "closed";

export type TickState = {
  quotes: Record<string, LiveQuote>;
  /** Set for a moment after a price moves, so a change is visible without
   *  the reader having to be watching that row at that instant. */
  flash: Record<string, Direction | undefined>;
  market: MarketStatus;
  feed: FeedState;
  lastTickAt: Date | null;
  /** Ticks received this session. The honest way to show that a still
   *  number means a quiet market rather than a broken page. */
  tickCount: number;
};

const FLASH_MS = 700;

/**
 * How often the poll runs while the stream is carrying the price.
 *
 * This is the single most important number in the file. The REST endpoint
 * and the trade socket draw on ONE rate-limit budget, so polling hard while
 * streaming does not add safety — it spends the allowance the socket needs
 * and the handshake comes back 429. Measured directly: with the dashboard
 * polling eleven symbols the socket was refused every time, and the moment
 * the polling stopped the same key connected and streamed trades.
 *
 * So once the stream is live the poll drops to a slow re-sync. Its only job
 * then is the session high and low, which a trade print does not carry.
 */
const SYNC_MS = 90_000;

/**
 * Live prices, from two sources that each supply what the other cannot.
 *
 * The trade stream is the real-time half. It carries the last traded price
 * and nothing else — no previous close, no session high or low — because
 * that is all a trade print is. On its own it can show a moving number with
 * no idea whether the day is up or down.
 *
 * So a slow poll runs underneath it for the full quote, and the stream
 * overlays the price on top. Between polls the change is recomputed from the
 * previous close the poll last supplied, which is fixed for the session, so
 * the percentage stays correct tick by tick without asking for it again.
 *
 * If the stream cannot be established — blocked, out of hours, unsupported —
 * the poll simply carries on alone and the page says it is polling. It never
 * degrades to nothing, and it never claims to be live when it is not.
 */
export function useLiveTicks(
  symbols: string[],
  initial: Record<string, LiveQuote> = {},
): TickState {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>(initial);
  const [flash, setFlash] = useState<TickState["flash"]>({});
  const [market, setMarket] = useState<MarketStatus>(() => marketStatus());
  const [feed, setFeed] = useState<FeedState>("connecting");
  const [lastTickAt, setLastTickAt] = useState<Date | null>(null);
  const [tickCount, setTickCount] = useState(0);

  const previous = useRef<Record<string, number>>({});
  const flashTimers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const key = symbols.join(",");

  /** Read by the polling loop to decide its cadence. A ref rather than the
   *  state value so changing it never restarts the loop. */
  const streaming = useRef(false);
  useEffect(() => {
    streaming.current = feed === "live";
  }, [feed]);

  /** Applies a new price and reports the direction it moved. */
  function applyPrice(symbol: string, price: number, patch?: Partial<LiveQuote>) {
    setQuotes((current) => {
      const existing = current[symbol];
      const previousClose = patch?.previousClose ?? existing?.previousClose;

      const change =
        previousClose && previousClose > 0 ? price - previousClose : existing?.change ?? null;
      const changePercent =
        previousClose && previousClose > 0
          ? ((price - previousClose) / previousClose) * 100
          : existing?.changePercent ?? null;

      return {
        ...current,
        [symbol]: {
          ...existing,
          ...patch,
          symbol,
          price,
          previousClose,
          change,
          changePercent,
          // The session range has to widen with the live price, otherwise
          // the day's high stops being the day's high between polls.
          high: Math.max(patch?.high ?? existing?.high ?? price, price),
          low: Math.min(patch?.low ?? existing?.low ?? price, price),
        },
      };
    });

    const before = previous.current[symbol];
    if (before !== undefined && price !== before) {
      const direction: Direction = price > before ? "up" : "down";
      setFlash((current) => ({ ...current, [symbol]: direction }));

      const timer = setTimeout(() => {
        setFlash((current) => {
          if (current[symbol] !== direction) return current;
          const next = { ...current };
          delete next[symbol];
          return next;
        });
      }, FLASH_MS);
      flashTimers.current.push(timer);
    }
    previous.current[symbol] = price;
  }

  /* ---- The slow poll: full quotes ---- */

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    if (list.length === 0) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;

        const data: { quotes: LiveQuote[] } = await res.json();
        if (cancelled) return;

        for (const quote of data.quotes) {
          if (quote.price === null) continue;
          applyPrice(quote.symbol, quote.price, {
            previousClose:
              quote.previousClose ??
              (quote.change != null ? quote.price - quote.change : undefined),
            high: quote.high,
            low: quote.low,
            at: quote.at,
          });
        }
      } catch {
        // The stream may still be running; a failed poll is not worth
        // reporting on its own.
      }
    }

    /**
     * Rescheduled after each run rather than on a fixed interval, so the
     * cadence can change with the session AND with whether the stream is
     * carrying the price — a fixed interval would be locked in at mount,
     * which is before either is known.
     */
    function loop() {
      if (cancelled) return;

      const status = marketStatus();
      setMarket(status);

      const wait = streaming.current
        ? SYNC_MS
        : pollIntervalFor(status.state, list.length);

      timer = setTimeout(async () => {
        await poll();
        loop();
      }, wait);
    }

    /**
     * The first poll is skipped when the server already rendered a quote for
     * every symbol — which it does on every page that uses this hook.
     *
     * This is not a micro-optimisation. A burst of eleven REST calls at mount
     * exhausts the per-minute allowance at exactly the moment the socket is
     * trying to shake hands, and the handshake comes back 429. Measured: with
     * the burst the stream never opened; without it, it opens on the first
     * try. Those eleven calls bought nothing either way, because the prices
     * they fetch are the prices already on screen.
     */
    const seeded = list.every((symbol) => initial[symbol]?.price != null);
    for (const symbol of list) {
      const price = initial[symbol]?.price;
      if (price != null) previous.current[symbol] = price;
    }

    if (!seeded) poll();
    loop();

    // Coming back to the tab re-syncs the session range, but only when the
    // stream is not already supplying prices.
    const onVisible = () => {
      if (document.visibilityState === "visible" && !streaming.current) poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    const timers = flashTimers.current;
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      timers.forEach(clearTimeout);
      flashTimers.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  /* ---- The fast stream: trade prints ---- */

  useEffect(() => {
    if (key.length === 0) return;

    return subscribeToTicks(key, {
      onTicks(rows) {
        for (const row of rows) applyPrice(row.symbol, row.price);
        setLastTickAt(new Date());
        setTickCount((n) => n + rows.length);
      },
      onState(state) {
        // "limited" and "connecting" both mean the poll is currently the
        // thing keeping prices moving, and the badge says so. Only a run of
        // failures long enough for the manager to give up turns into a
        // settled "polling".
        setFeed(
          state === "live"
            ? "live"
            : state === "failed"
              ? "polling"
              : "connecting",
        );
      },
    });
  }, [key]);

  return { quotes, flash, market, feed, lastTickAt, tickCount };
}
