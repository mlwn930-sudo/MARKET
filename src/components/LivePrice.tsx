"use client";

import { useMemo } from "react";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import {
  directionClass,
  fmtChange,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * A live price, big enough to be the subject of the panel it sits in.
 *
 * Fed by the shared tick stream, so the number moves on every trade rather
 * than on a timer. The upstream feed allows one socket per tab and the
 * stream manager reference counts by symbol set, so several of these on one
 * page cost one connection between them.
 *
 * The state line underneath is not decoration. "Live" is a claim, and a
 * still number has at least three innocent explanations: the market is
 * shut, the market is open and nobody traded this minute, or the stream is
 * down and the slower poll is holding the fort. A price that stops moving
 * without saying which of those it is looks broken, so this says which.
 *
 * Seeded from a server-rendered quote, so the page opens on a real price
 * rather than on dashes that fill in a moment later.
 */
export function LivePrice({
  symbol,
  initial,
  size = "large",
}: {
  symbol: string;
  initial: LiveQuote | null;
  size?: "large" | "medium";
}) {
  // Stable identities, or the hook resubscribes on every parent render.
  const watch = useMemo(() => [symbol], [symbol]);
  const seed = useMemo(
    () => (initial ? { [symbol]: initial } : {}),
    [initial, symbol],
  );

  const { quotes, flash, market, feed, lastTickAt, tickCount } = useLiveTicks(
    watch,
    seed,
  );

  const quote = quotes[symbol];
  const direction = flash[symbol];
  const open = market.state === "open";
  const streaming = feed === "live";

  const status = !open
    ? market.label
    : streaming && tickCount > 0
      ? "זרם חי — כל עסקה"
      : streaming
        ? "מחובר, ממתין לעסקה"
        : "רענון מחזורי";

  return (
    <div
      className={`rounded-xl px-3 py-2 ${
        direction === "up"
          ? "flash-up"
          : direction === "down"
            ? "flash-down"
            : ""
      }`}
    >
      <div
        className={`${size === "large" ? "price-xl" : "num text-2xl"} ${
          direction ? (direction === "up" ? "tick-up" : "tick-down") : ""
        }`}
      >
        {fmtPrice(quote?.price)}
      </div>

      <div
        className={`num mt-2 text-sm ${directionClass(quote?.changePercent)}`}
      >
        {fmtChange(quote?.change)} ({fmtPercent(quote?.changePercent)})
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            open && streaming
              ? "bg-up live-dot"
              : open
                ? "bg-gold"
                : "bg-ink-faint"
          }`}
          aria-hidden="true"
        />
        <span className={open && streaming ? "text-up" : undefined}>
          {status}
        </span>
        {lastTickAt && <span className="num">· {fmtTime(lastTickAt)}</span>}
      </div>

      {quote?.high != null && quote?.low != null && quote.high > quote.low && (
        <div className="mt-2 flex items-center gap-2">
          <span className="num text-[10px] text-ink-faint">
            {fmtPrice(quote.low)}
          </span>
          {/* Where the price sits inside today's range — the context a pair
              of numbers alone does not give. */}
          <span className="relative h-1 w-24 rounded-full bg-line-strong">
            <span
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full transition-[inset-inline-start] duration-300"
              style={{
                insetInlineStart: `${
                  (((quote.price ?? quote.low) - quote.low) /
                    (quote.high - quote.low)) *
                  100
                }%`,
                background: "var(--accent)",
              }}
            />
          </span>
          <span className="num text-[10px] text-ink-faint">
            {fmtPrice(quote.high)}
          </span>
          <span className="text-[10px] text-ink-faint">טווח היום</span>
        </div>
      )}
    </div>
  );
}
