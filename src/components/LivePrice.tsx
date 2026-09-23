"use client";

import { useLiveQuotes, type LiveQuote } from "@/lib/use-live-quotes";
import {
  directionClass,
  fmtChange,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * The live price at the top of a company page.
 *
 * One symbol costs one call, so this refreshes every four seconds while the
 * exchange is open — fast enough that the number visibly moves, which is the
 * whole point of putting it at the top of the page.
 *
 * The cadence is printed next to it on purpose. "Live" is a claim, and a
 * reader deciding what to do with a figure is entitled to know whether it is
 * four seconds old or two minutes old. The indicator also stops pulsing when
 * the feed stops: an animation that keeps running after the data has died is
 * worse than having no indicator at all.
 *
 * Seeded from a server-rendered quote so the page opens on a real price
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
  const { quotes, flash, fetchedAt, failing, market, intervalMs } =
    useLiveQuotes([symbol], initial ? { [symbol]: initial } : {});

  const quote = quotes[symbol];
  const direction = flash[symbol];
  const open = market.state === "open";
  const streaming = open && !failing;

  const priceClass = size === "large" ? "text-4xl" : "text-2xl";

  return (
    <div
      className={`rounded-xl px-3 py-2 ${
        direction === "up" ? "flash-up" : direction === "down" ? "flash-down" : ""
      }`}
    >
      <div className={`num ${priceClass} leading-none`}>
        {fmtPrice(quote?.price)}
      </div>

      <div
        className={`num mt-1.5 text-sm ${directionClass(quote?.changePercent)}`}
      >
        {fmtChange(quote?.change)} ({fmtPercent(quote?.changePercent)})
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-ink-faint">
        <span
          className={`inline-block h-1.5 w-1.5 rounded-full ${
            streaming ? "bg-up live-dot" : "bg-ink-faint"
          }`}
          aria-hidden="true"
        />
        <span className={streaming ? "text-up" : undefined}>{market.label}</span>

        {failing ? (
          <span>· העדכון נקטע, המחיר האחרון נשמר</span>
        ) : (
          <>
            <span className="num">
              · רענון כל {Math.round(intervalMs / 1000)} שניות
            </span>
            {fetchedAt && <span className="num">· {fmtTime(fetchedAt)}</span>}
          </>
        )}
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
              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full"
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
