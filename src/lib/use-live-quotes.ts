"use client";

import { useEffect, useRef, useState } from "react";
import {
  marketStatus,
  pollIntervalFor,
  type MarketStatus,
} from "./market-hours";

export type LiveQuote = {
  symbol: string;
  price: number | null;
  change?: number | null;
  changePercent?: number | null;
  high?: number;
  low?: number;
  at?: string;
};

export type QuoteState = {
  quotes: Record<string, LiveQuote>;
  /** "up" or "down" for a moment after a price moves, so the change is
   *  visible without the reader having to watch the number. */
  flash: Record<string, "up" | "down" | undefined>;
  fetchedAt: Date | null;
  failing: boolean;
  /** Session state, so the UI can say why prices are or are not moving. */
  market: MarketStatus;
  /** The current cadence in milliseconds, so the UI can state it plainly
   *  instead of leaving the reader to guess how live "live" is. */
  intervalMs: number;
};

const FLASH_MS = 900;

/**
 * Polls the quotes route and reports which prices just moved.
 *
 * Why polling and not a WebSocket, since this is the question anyone reading
 * it will ask: Finnhub's socket takes the API key in the connection URL, so
 * opening it from the browser publishes the key to anyone who looks at the
 * network tab. The usual answer is to proxy the socket server-side, and
 * Vercel's Hobby runtime has no long-lived process to hold that connection
 * open. Polling keeps the key on the server and costs, at one symbol, a
 * four-second delay that a medium-term research tool cannot feel.
 *
 * The cadence comes from the market session and the number of symbols rather
 * than from a constant — see market-hours.ts for the arithmetic.
 *
 * Two behaviours worth knowing about.
 *
 * A failed poll does NOT clear the prices. The previous price is real — it
 * is simply not current — and blanking the table would tell the reader the
 * market went away. The `failing` flag surfaces the staleness instead.
 *
 * Polling stops while the tab is hidden and catches up the moment it comes
 * back. A background tab burning requests against a shared allowance is the
 * kind of waste that only surfaces as a rate-limit error hours later.
 */
export function useLiveQuotes(
  symbols: string[],
  initial: Record<string, LiveQuote> = {},
): QuoteState {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>(initial);
  const [flash, setFlash] = useState<QuoteState["flash"]>({});
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [failing, setFailing] = useState(false);
  const [market, setMarket] = useState<MarketStatus>(() => marketStatus());
  const [intervalMs, setIntervalMs] = useState(() =>
    pollIntervalFor(marketStatus().state, symbols.length),
  );

  const previous = useRef<Record<string, number | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const key = symbols.join(",");

  useEffect(() => {
    const list = key.split(",").filter(Boolean);
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | null = null;
    let sessionState = marketStatus().state;

    async function poll() {
      if (document.visibilityState === "hidden") return;

      try {
        const res = await fetch(
          `/api/quotes?symbols=${encodeURIComponent(key)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error(String(res.status));

        const data: { quotes: LiveQuote[]; fetchedAt: string } =
          await res.json();
        if (cancelled) return;

        const next: Record<string, LiveQuote> = {};
        const moved: QuoteState["flash"] = {};

        for (const quote of data.quotes) {
          if (quote.price === null) continue;
          next[quote.symbol] = quote;

          const before = previous.current[quote.symbol];
          if (before != null && quote.price !== before) {
            moved[quote.symbol] = quote.price > before ? "up" : "down";
          }
          previous.current[quote.symbol] = quote.price;
        }

        setQuotes((current) => ({ ...current, ...next }));
        setFetchedAt(new Date(data.fetchedAt));
        setFailing(false);

        if (Object.keys(moved).length > 0) {
          setFlash(moved);
          const timer = setTimeout(() => {
            if (!cancelled) setFlash({});
          }, FLASH_MS);
          timers.current.push(timer);
        }
      } catch {
        if (!cancelled) setFailing(true);
      }
    }

    function schedule() {
      const status = marketStatus();
      sessionState = status.state;
      const wait = pollIntervalFor(status.state, list.length);

      setMarket(status);
      setIntervalMs(wait);

      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        // Re-check the session each tick, so the cadence tightens by itself
        // when the bell rings rather than waiting for a page reload.
        if (marketStatus().state !== sessionState) {
          schedule();
          return;
        }
        poll();
      }, wait);
    }

    poll();
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    const pending = timers.current;
    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      pending.forEach(clearTimeout);
      timers.current = [];
    };
  }, [key]);

  return { quotes, flash, fetchedAt, failing, market, intervalMs };
}
