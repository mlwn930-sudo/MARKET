"use client";

import { useMemo } from "react";
import { LiveChart, type ChartLevel, type ChartMarker } from "./LiveChart";
import { LiveBadge, Quote } from "./ui";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { describeStatus } from "@/lib/market-hours";
import type { Candle } from "@/lib/sources/prices";
import { fmtChange, fmtPrice, fmtTime } from "@/lib/format";

/**
 * The price half of a company page: the headline quote and the chart,
 * driven by one subscription.
 *
 * They are one component rather than two because they have to agree. A
 * separate live quote and a separate live chart would each want their own
 * subscription, and — even with the stream manager deduplicating them — the
 * number in the header and the last candle on the chart should be the same
 * print rather than two renders of one feed a frame apart.
 *
 * The status line is not decoration. A still price has three innocent
 * explanations: the market is shut, it is open and nobody traded this
 * minute, or the stream is down and the slower poll is holding the fort.
 * A price that stops moving without saying which looks broken — so this
 * says which, and when the market is shut it says when it opens.
 */
export function CompanyChart({
  symbol,
  candles,
  initial,
  levels,
  markers,
  name,
}: {
  symbol: string;
  candles: Candle[];
  initial: LiveQuote | null;
  levels?: ChartLevel[];
  markers?: ChartMarker[];
  name: string;
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
  const moved = flash[symbol];
  const open = market.state === "open";
  const streaming = feed === "live";

  const state = open && streaming ? "live" : open ? "waiting" : "idle";
  const status = !open
    ? describeStatus(market)
    : streaming && tickCount > 0
      ? "זרם חי — כל עסקה"
      : streaming
        ? "מחובר, ממתין לעסקה"
        : "רענון מחזורי";

  const range =
    quote?.high != null && quote?.low != null && quote.high > quote.low
      ? ((quote.price ?? quote.low) - quote.low) / (quote.high - quote.low)
      : null;

  return (
    <div className="space-y-4">
      {/* NUMBER, then CHANGE, then CONTEXT — in that order, at those three
          weights. The price is the largest figure on the page and the only
          one set at display size; the change is a chip the eye finds
          without reading; the feed state and the day's range are the small
          print that explains what the first two mean right now. */}
      <div className="surface flex flex-wrap items-end justify-between gap-x-10 gap-y-6 p-6">
        <Quote
          price={
            <span
              className={
                moved === "up"
                  ? "settle-up"
                  : moved === "down"
                    ? "settle-down"
                    : undefined
              }
            >
              {fmtPrice(quote?.price)}
            </span>
          }
          change={quote?.changePercent}
          absolute={
            quote?.change != null ? fmtChange(quote.change) : undefined
          }
          live={<LiveBadge state={state} label={status} />}
          context={
            lastTickAt ? (
              <span className="num">עדכון אחרון {fmtTime(lastTickAt)}</span>
            ) : undefined
          }
        />

        {range !== null && (
          <div className="pb-1">
            <div className="text-[11px] text-ink-faint">טווח היום</div>
            <div className="mt-2 flex items-center gap-2.5">
              <span className="num text-[11px] text-ink-ghost">
                {fmtPrice(quote?.low)}
              </span>
              {/* Where the price sits inside today's range — the context a
                  pair of numbers alone does not give. */}
              <span className="relative h-[3px] w-28 rounded-full bg-overlay">
                <span
                  className="absolute top-1/2 h-3 w-[2px] -translate-y-1/2 rounded-full bg-ink transition-[inset-inline-start] duration-500"
                  style={{ insetInlineStart: `${range * 100}%` }}
                />
              </span>
              <span className="num text-[11px] text-ink-ghost">
                {fmtPrice(quote?.high)}
              </span>
            </div>
          </div>
        )}
      </div>

      <LiveChart
        symbol={symbol}
        candles={candles}
        livePrice={quote?.price ?? null}
        levels={levels}
        markers={markers}
        label={`גרף נרות יומי של ${name}, עם ממוצעים נעים 20, 50, 150 ו-200`}
      />
    </div>
  );
}
