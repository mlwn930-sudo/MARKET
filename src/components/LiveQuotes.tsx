"use client";

import Link from "next/link";
import { useLiveQuotes, type LiveQuote } from "@/lib/use-live-quotes";
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
 * shows real prices before the first poll lands rather than a row of dashes
 * that fill in a moment later.
 */

function flashClass(direction: "up" | "down" | undefined): string {
  if (!direction) return "";
  return direction === "up" ? "flash-up" : "flash-down";
}

export function LiveIndexStrip({
  items,
  initial,
}: {
  items: { symbol: string; label: string; note: string }[];
  initial: Record<string, LiveQuote>;
}) {
  const symbols = items.map((item) => item.symbol);
  const { quotes, flash, fetchedAt, failing } = useLiveQuotes(symbols, initial);

  return (
    <section aria-labelledby="indices">
      <div className="mb-2 flex items-center justify-end gap-2 text-[11px]">
        {failing ? (
          <span className="text-ink-muted">
            העדכון החי נקטע — המחירים למטה הם האחרונים שהתקבלו
          </span>
        ) : (
          fetchedAt && (
            <>
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" />
              <span className="num text-ink-muted">
                עודכן {fmtTime(fetchedAt)}
              </span>
            </>
          )
        )}
      </div>

      <h2 id="indices" className="sr-only">
        מדדים מובילים
      </h2>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line md:grid-cols-4">
        {items.map((item) => {
          const quote = quotes[item.symbol];
          return (
            <div
              key={item.symbol}
              className={`bg-surface px-4 py-3 ${flashClass(flash[item.symbol])}`}
            >
              <div className="flex items-baseline justify-between">
                <span className="text-[11px] tracking-wide text-ink-muted">
                  {item.label}
                </span>
                <span className="num text-[10px] text-ink-faint">
                  {item.note}
                </span>
              </div>
              <div className="num mt-1 text-lg">{fmtPrice(quote?.price)}</div>
              <div
                className={`num text-xs ${directionClass(quote?.changePercent)}`}
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
            <th className="px-4 py-2 text-right font-normal">סימבול</th>
            <th className="px-4 py-2 text-right font-normal">מחיר</th>
            <th className="px-4 py-2 text-right font-normal">שינוי</th>
            <th className="px-4 py-2 text-right font-normal">%</th>
            <th className="hidden px-4 py-2 text-right font-normal sm:table-cell">
              טווח יומי
            </th>
          </tr>
        </thead>
        <tbody>
          {symbols.map((symbol) => {
            const quote = quotes[symbol];
            return (
              <tr
                key={symbol}
                className={`border-b border-line last:border-0 hover:bg-surface ${flashClass(flash[symbol])}`}
              >
                <td className="num px-4 py-2.5 text-right">
                  <Link
                    href={`/company/${symbol}`}
                    className="hover:text-gold"
                  >
                    {symbol}
                  </Link>
                </td>
                <td className="num px-4 py-2.5 text-right">
                  {fmtPrice(quote?.price)}
                </td>
                <td
                  className={`num px-4 py-2.5 text-right ${directionClass(quote?.change)}`}
                >
                  {fmtChange(quote?.change)}
                </td>
                <td
                  className={`num px-4 py-2.5 text-right ${directionClass(quote?.changePercent)}`}
                >
                  {fmtPercent(quote?.changePercent)}
                </td>
                <td className="num hidden px-4 py-2.5 text-right text-ink-muted sm:table-cell">
                  {quote?.high != null && quote?.low != null
                    ? `${fmtPrice(quote.low)} – ${fmtPrice(quote.high)}`
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
