"use client";

import { useEffect, useRef, useState } from "react";

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
  /** "up" or "down" for a few hundred ms after a price moves, so the change
   *  is visible without the reader having to watch the number. */
  flash: Record<string, "up" | "down" | undefined>;
  fetchedAt: Date | null;
  failing: boolean;
};

const POLL_MS = 15_000;
const FLASH_MS = 900;

/**
 * Polls the quotes route and reports which prices just moved.
 *
 * Two behaviours worth knowing about:
 *
 * A failed poll does NOT clear the prices. The previous price is real — it
 * is simply not current — and blanking the table would tell the reader the
 * market went away. The `failing` flag surfaces the staleness instead.
 *
 * Polling pauses while the tab is hidden. A background tab burning four
 * requests a minute against a 60-per-minute allowance is the kind of waste
 * that only shows up as a rate-limit error hours later.
 */
export function useLiveQuotes(
  symbols: string[],
  initial: Record<string, LiveQuote> = {},
): QuoteState {
  const [quotes, setQuotes] = useState<Record<string, LiveQuote>>(initial);
  const [flash, setFlash] = useState<QuoteState["flash"]>({});
  const [fetchedAt, setFetchedAt] = useState<Date | null>(null);
  const [failing, setFailing] = useState(false);

  const previous = useRef<Record<string, number | null>>({});
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const key = symbols.join(",");

  useEffect(() => {
    let cancelled = false;

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

    poll();
    const interval = setInterval(poll, POLL_MS);

    // Catch up immediately when the tab comes back rather than waiting out
    // the rest of the interval on a stale number.
    const onVisible = () => {
      if (document.visibilityState === "visible") poll();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
      timers.current.forEach(clearTimeout);
      timers.current = [];
    };
  }, [key]);

  return { quotes, flash, fetchedAt, failing };
}
