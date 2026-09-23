"use client";

import { useEffect, useRef, useState } from "react";
import { marketStatus, type MarketStatus } from "./market-hours";

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
};

const FLASH_MS = 900;

/**
 * Polls the quotes route and reports which prices just moved.
 *
 * The cadence comes from the market session rather than a fixed constant.
 * Finnhub's free tier allows 60 calls a minute and every symbol is one call,
 * so the budget is the real constraint on how fast this can go: eight
 * seconds while the exchange is open, two minutes when it is shut. Polling
 * hard overnight would spend the allowance to receive an unchanged number.
 *
 * Two behaviours worth knowing about:
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

  const previous = useRef<Record<string, number | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const key = symbols.join(",");

  useEffect(() => {
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
      setMarket(status);

      if (interval) clearInterval(interval);
      interval = setInterval(() => {
        // Re-check the session each tick, so the cadence tightens by itself
        // when the bell rings rather than waiting for a page reload.
        if (marketStatus().state !== sessionState) {
          schedule();
          return;
        }
        poll();
      }, status.pollMs);
    }

    poll();
    schedule();

    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [key]);

  return { quotes, flash, fetchedAt, failing, market };
}
