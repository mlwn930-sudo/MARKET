"use client";

import Link from "next/link";
import { useLiveQuotes, type LiveQuote } from "@/lib/use-live-quotes";
import { identityFor } from "@/lib/company-identity";
import {
  directionClass,
  fmtChange,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * The live parts of the dashboard.
 *
 * Both components are seeded with quotes rendered on the server, so the page
 * opens on real prices instead of a row of dashes that fill in a moment
 * later.
 */

function flashClass(direction: "up" | "down" | undefined): string {
  if (!direction) return "";
  return direction === "up" ? "flash-up" : "flash-down";
}

function StatusDot({ state }: { state: string }) {
  const live = state === "open";
  return (
    <span
      className={`inline-block h-2 w-2 rounded-full ${live ? "bg-up" : "bg-ink-faint"}`}
      style={live ? { boxShadow: "0 0 0 3px rgba(27,175,122,0.18)" } : undefined}
    />
  );
}

export function LiveIndexStrip({
  items,
  initial,
}: {
  items: { symbol: string; label: string; note: string }[];
  initial: Record<string, LiveQuote>;
}) {
  const symbols = items.map((item) => item.symbol);
  const { quotes, flash, fetchedAt, failing, market } = useLiveQuotes(
    symbols,
    initial,
  );

  return (
    <section aria-labelledby="indices">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 id="indices" className="text-sm text-ink-muted">
          מדדים מובילים
        </h2>

        <div className="flex items-center gap-2 text-[11px]">
          <StatusDot state={market.state} />
          <span className={market.state === "open" ? "text-up" : "text-ink-muted"}>
            {market.label}
          </span>
          {failing ? (
            <span className="text-ink-faint">· העדכון נקטע</span>
          ) : (
            fetchedAt && (
              <span className="num text-ink-faint">
                · {fmtTime(fetchedAt)}
              </span>
            )
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {items.map((item) => {
          const quote = quotes[item.symbol];
          const up = (quote?.changePercent ?? 0) >= 0;
          return (
            <div
              key={item.symbol}
              className={`relative overflow-hidden panel p-4 ${flashClass(flash[item.symbol])}`}
            >
              <div
                className="absolute inset-x-0 top-0 h-0.5"
                style={{ background: up ? "#1baf7a" : "#e24b4a", opacity: 0.7 }}
                aria-hidden="true"
              />
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-wide text-ink-muted">
                  {item.label}
                </span>
                <span className="num text-[10px] text-ink-faint">
                  {item.note}
                </span>
              </div>
              <div className="num mt-2 text-2xl">{fmtPrice(quote?.price)}</div>
              <div
                className={`num mt-0.5 text-xs ${directionClass(quote?.changePercent)}`}
              >
                {fmtPercent(quote?.changePercent)}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function LiveWatchlist({
  symbols,
  initial,
}: {
  symbols: string[];
  initial: Record<string, LiveQuote>;
}) {
  const { quotes, flash } = useLiveQuotes(symbols, initial);

  return (
    <div className="overflow-hidden rounded-xl border border-line">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-line bg-surface text-[11px] text-ink-muted">
            <th className="px-4 py-2.5 text-right font-normal">סימבול</th>
            <th className="px-4 py-2.5 text-right font-normal">מחיר</th>
            <th className="px-4 py-2.5 text-right font-normal">שינוי</th>
            <th className="px-4 py-2.5 text-right font-normal">%</th>
            <th className="hidden px-4 py-2.5 text-right font-normal sm:table-cell">
              טווח יומי
            </th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => {
            const quote = quotes[symbol];
            const identity = identityFor(symbol);
            const range =
              quote?.high != null && quote?.low != null && quote.high > quote.low
                ? ((quote.price ?? 0) - quote.low) / (quote.high - quote.low)
                : null;

            return (
              <tr
                key={symbol}
                className={`border-b border-line last:border-0 transition-colors hover:bg-surface ${flashClass(flash[symbol])}`}
              >
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/company/${symbol}`}
                    className="num inline-flex items-center gap-2 font-medium hover:underline"
                    style={{ color: identity.accent }}
                  >
                    <span
                      className="inline-block h-3 w-0.5 rounded-full"
                      style={{ background: identity.accent }}
                      aria-hidden="true"
                    />
                    {symbol}
                  </Link>
                </td>
                <td className="num px-4 py-3 text-right">
                  {fmtPrice(quote?.price)}
                </td>
                <td
                  className={`num px-4 py-3 text-right ${directionClass(quote?.change)}`}
                >
                  {fmtChange(quote?.change)}
                </td>
                <td
                  className={`num px-4 py-3 text-right ${directionClass(quote?.changePercent)}`}
                >
                  {fmtPercent(quote?.changePercent)}
                </td>
                <td className="hidden px-4 py-3 text-right sm:table-cell">
                  {range === null ? (
                    <span className="num text-ink-faint">—</span>
                  ) : (
                    <div className="flex items-center justify-end gap-2">
                      <span className="num text-[10px] text-ink-faint">
                        {fmtPrice(quote?.low)}
                      </span>
                      {/* Where today's price sits inside today's range,
                          which a pair of numbers alone does not show. */}
                      <span className="relative h-1 w-16 rounded-full bg-line-strong">
                        <span
                          className="absolute top-1/2 h-2 w-0.5 -translate-y-1/2 rounded-full bg-ink"
                          style={{ insetInlineStart: `${range * 100}%` }}
                        />
                      </span>
                      <span className="num text-[10px] text-ink-faint">
                        {fmtPrice(quote?.high)}
                      </span>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
