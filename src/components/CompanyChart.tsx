"use client";

import { useMemo } from "react";
import { LiveChart, type ChartLevel, type ChartMarker } from "./LiveChart";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import type { Candle } from "@/lib/sources/prices";
import {
  directionClass,
  fmtChange,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * The price half of a company page: the headline quote and the chart,
 * driven by one subscription.
 *
 * They are one component rather than two because they have to share a
 * connection, and because they have to agree. The upstream feed accepts a
 * single socket; a separate live quote and a separate live chart would each
 * want one, and — even with the connection manager deduplicating them — the
 * number in the header and the last candle on the chart should be the same
 * print rather than two renders of the same feed a frame apart.
 */
export function CompanyChart({
  symbol,
  candles,
  initial,
  accent,
  levels,
  markers,
  name,
}: {
  symbol: string;
  candles: Candle[];
  initial: LiveQuote | null;
  accent: string;
  levels?: ChartLevel[];
  markers?: ChartMarker[];
  name: string;
}) {
  // Stable identity, or the hook re-subscribes on every parent render.
  const seed = useMemo(
    () => (initial ? { [symbol]: initial } : {}),
    [initial, symbol],
  );
  const watch = useMemo(() => [symbol], [symbol]);

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
    <div className="space-y-4">
      <div
        className={`panel panel-lit flex flex-wrap items-end justify-between gap-4 p-5 ${
          direction === "up"
            ? "flash-up"
            : direction === "down"
              ? "flash-down"
              : ""
        }`}
      >
        <div>
          <div
            className={`price-xl ${
              direction ? (direction === "up" ? "tick-up" : "tick-down") : ""
            }`}
          >
            {fmtPrice(quote?.price)}
          </div>

          <div
            className={`num mt-2 text-base ${directionClass(quote?.changePercent)}`}
          >
            {fmtChange(quote?.change)} ({fmtPercent(quote?.changePercent)})
          </div>
        </div>

        <div className="flex flex-col items-start gap-2 text-[11px] sm:items-end">
          <span className="flex items-center gap-2">
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
            <span className={open && streaming ? "text-up" : "text-ink-muted"}>
              {status}
            </span>
            {lastTickAt && (
              <span className="num text-ink-faint">· {fmtTime(lastTickAt)}</span>
            )}
          </span>

          {quote?.high != null &&
            quote?.low != null &&
            quote.high > quote.low && (
              <span className="flex items-center gap-2 text-ink-faint">
                <span className="num">{fmtPrice(quote.low)}</span>
                {/* Where the price sits inside today's range — the context a
                    pair of numbers alone does not give. */}
                <span className="relative h-1 w-24 rounded-full bg-line-strong">
                  <span
                    className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full transition-[inset-inline-start] duration-300"
                    style={{
                      insetInlineStart: `${
                        (((quote.price ?? quote.low) - quote.low) /
                          (quote.high - quote.low)) *
                        100
                      }%`,
                      background: accent,
                    }}
                  />
                </span>
                <span className="num">{fmtPrice(quote.high)}</span>
                <span>טווח היום</span>
              </span>
            )}
        </div>
      </div>

      <LiveChart
        candles={candles}
        livePrice={quote?.price ?? null}
        accent={accent}
        levels={levels}
        markers={markers}
        label={`גרף נרות יומי של ${name}, עם ממוצעים נעים 20, 50, 150 ו-200`}
      />
    </div>
  );
}
