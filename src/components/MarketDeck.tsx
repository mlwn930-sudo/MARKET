"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { identityFor } from "@/lib/company-identity";
import {
  directionClass,
  fmtChange,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * The live surface of the dashboard: four index cards and a watchlist, all
 * fed by one stream.
 *
 * One hook for the whole deck rather than one per card. Fifteen components
 * each opening their own connection would be fifteen sockets against an
 * allowance built for a handful, and they would tick out of step with each
 * other — the same index showing two prices half a second apart on one
 * screen, which looks like a bug because it is one.
 *
 * The pulse this reports upward is the share of the watchlist that is green.
 * The page tints its background with it, so the room warms on a strong tape
 * and cools on a weak one. That colour never touches a figure: the numbers
 * keep their own meaning, and only the air around them changes.
 */

export type IndexCard = {
  symbol: string;
  label: string;
  note: string;
  /** Closing prices through today's session, oldest first. */
  intraday: number[];
};

function Sparkline({
  points,
  positive,
  className = "",
}: {
  points: number[];
  positive: boolean;
  className?: string;
}) {
  const path = useMemo(() => {
    if (points.length < 2) return null;

    const min = Math.min(...points);
    const max = Math.max(...points);
    const span = max - min || 1;

    // Drawn in a 100×32 box and stretched by the SVG, so the component does
    // not need to know how wide it will be rendered.
    const step = 100 / (points.length - 1);
    const line = points
      .map((value, i) => {
        const x = i * step;
        const y = 30 - ((value - min) / span) * 28;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

    return { line, area: `${line} L 100 32 L 0 32 Z` };
  }, [points]);

  if (!path) return null;

  const colour = positive ? "#1baf7a" : "#e24b4a";
  const id = `spark-${positive ? "up" : "down"}`;

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={colour} stopOpacity="0.28" />
          <stop offset="100%" stopColor={colour} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path.area} fill={`url(#${id})`} />
      <path
        d={path.line}
        fill="none"
        stroke={colour}
        strokeWidth="1.4"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function FeedBadge({
  feed,
  market,
  lastTickAt,
  tickCount,
}: {
  feed: string;
  market: { state: string; label: string };
  lastTickAt: Date | null;
  tickCount: number;
}) {
  const open = market.state === "open";
  const streaming = feed === "live";

  // Four states, said plainly. A still number is only alarming when the page
  // will not say which of these it is.
  const text = !open
    ? market.label
    : streaming && tickCount > 0
      ? "זרם חי"
      : streaming
        ? "מחובר — ממתין לעסקה"
        : "רענון מחזורי";

  return (
    <span className="flex items-center gap-2 text-[11px]">
      <span
        className={`inline-block h-1.5 w-1.5 rounded-full ${
          open && streaming ? "bg-up live-dot" : open ? "bg-gold" : "bg-ink-faint"
        }`}
        aria-hidden="true"
      />
      <span className={open && streaming ? "text-up" : "text-ink-muted"}>
        {text}
      </span>
      {lastTickAt && (
        <span className="num text-ink-faint">· {fmtTime(lastTickAt)}</span>
      )}
    </span>
  );
}

export function MarketDeck({
  indices,
  watchlist,
  initial,
}: {
  indices: IndexCard[];
  watchlist: string[];
  initial: Record<string, LiveQuote>;
}) {
  const symbols = useMemo(
    () => [...new Set([...indices.map((i) => i.symbol), ...watchlist])],
    [indices, watchlist],
  );

  const { quotes, flash, market, feed, lastTickAt, tickCount } = useLiveTicks(
    symbols,
    initial,
  );

  /** Live prices appended to each index card's session, so the sparkline
   *  keeps drawing after the last five-minute bar closed. */
  const [tails, setTails] = useState<Record<string, number[]>>({});
  const tailRef = useRef<Record<string, number[]>>({});

  useEffect(() => {
    let changed = false;
    const next = { ...tailRef.current };

    for (const card of indices) {
      const price = quotes[card.symbol]?.price;
      if (price == null) continue;
      const tail = next[card.symbol] ?? [];
      if (tail[tail.length - 1] === price) continue;
      // Capped: the sparkline is 100 units wide, and more points than that
      // is detail nobody can see costing memory that grows all session.
      next[card.symbol] = [...tail, price].slice(-60);
      changed = true;
    }

    if (changed) {
      tailRef.current = next;
      setTails(next);
    }
  }, [quotes, indices]);

  /* ---- The market's mood, published to the page ---- */
  useEffect(() => {
    const measured = watchlist
      .map((symbol) => quotes[symbol]?.changePercent)
      .filter((v): v is number => typeof v === "number");

    if (measured.length === 0) return;

    const green = measured.filter((v) => v > 0).length / measured.length;
    // Mapped through a dead zone around even, so a market that is genuinely
    // mixed reads as neutral rather than flickering between two colours.
    const pulse =
      green > 0.6
        ? `rgba(27, 175, 122, ${(0.28 + (green - 0.6) * 0.8).toFixed(2)})`
        : green < 0.4
          ? `rgba(226, 75, 74, ${(0.28 + (0.4 - green) * 0.8).toFixed(2)})`
          : "rgba(147, 154, 166, 0.34)";

    document.documentElement.style.setProperty("--pulse", pulse);
  }, [quotes, watchlist]);

  return (
    <div className="space-y-8">
      {/* ---- Indices ---- */}
      <section aria-labelledby="indices">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 id="indices" className="text-sm text-ink-muted">
            מדדים מובילים
          </h2>
          <FeedBadge
            feed={feed}
            market={market}
            lastTickAt={lastTickAt}
            tickCount={tickCount}
          />
        </div>

        <div className="stagger grid grid-cols-2 gap-3 lg:grid-cols-4">
          {indices.map((card) => {
            const quote = quotes[card.symbol];
            const up = (quote?.changePercent ?? 0) >= 0;
            const points = [...card.intraday, ...(tails[card.symbol] ?? [])];
            const direction = flash[card.symbol];

            return (
              <div
                key={card.symbol}
                className={`panel relative overflow-hidden ${
                  direction === "up"
                    ? "flash-up"
                    : direction === "down"
                      ? "flash-down"
                      : ""
                }`}
              >
                {/* The session's shape sits in its own band under the
                    figures rather than behind them. Behind, the line crosses
                    the change percentage at exactly the moment the reader
                    wants to read it. */}
                <div className="relative z-10 px-4 pb-2 pt-4">
                  <div className="flex items-baseline justify-between">
                    <span className="text-[11px] tracking-wide text-ink-muted">
                      {card.label}
                    </span>
                    <span className="num text-[10px] text-ink-faint">
                      {card.note}
                    </span>
                  </div>

                  <div
                    className={`num mt-2 text-3xl leading-none ${
                      direction
                        ? direction === "up"
                          ? "tick-up"
                          : "tick-down"
                        : ""
                    }`}
                  >
                    {fmtPrice(quote?.price)}
                  </div>

                  <div
                    className={`num mt-1 text-xs ${directionClass(quote?.changePercent)}`}
                  >
                    {fmtPercent(quote?.changePercent)}
                  </div>
                </div>

                <Sparkline
                  points={points}
                  positive={up}
                  className="block h-11 w-full"
                />
              </div>
            );
          })}
        </div>

        <p className="mt-2 text-[10px] text-ink-faint">
          המדדים מוצגים דרך קרנות הסל שעוקבות אחריהם. הגרף הוא מהלך היום
          בפועל, בחלוקה לחמש דקות.
        </p>
      </section>

      {/* ---- Watchlist ---- */}
      <section aria-labelledby="watchlist">
        <h2 id="watchlist" className="mb-3 text-sm text-ink-muted">
          רשימת מעקב
        </h2>

        <div className="panel overflow-hidden">
          <table className="w-full text-sm">
            <caption className="sr-only">
              מחירים חיים לרשימת המעקב. מתעדכן בכל עסקה שמתבצעת בבורסה.
            </caption>
            <thead>
              <tr className="border-b border-line text-[11px] text-ink-muted">
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
              {watchlist.map((symbol) => {
                const quote = quotes[symbol];
                const identity = identityFor(symbol);
                const direction = flash[symbol];
                const range =
                  quote?.high != null &&
                  quote?.low != null &&
                  quote.high > quote.low
                    ? ((quote.price ?? 0) - quote.low) / (quote.high - quote.low)
                    : null;

                return (
                  <tr
                    key={symbol}
                    className={`border-b border-line last:border-0 ${
                      direction === "up"
                        ? "flash-up"
                        : direction === "down"
                          ? "flash-down"
                          : ""
                    }`}
                  >
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/company/${symbol}`}
                        className="num inline-flex items-center gap-2 font-medium transition-opacity hover:opacity-75"
                        style={{ color: identity.accent }}
                      >
                        <span
                          className="inline-block h-3.5 w-0.5 rounded-full"
                          style={{ background: identity.accent }}
                          aria-hidden="true"
                        />
                        {symbol}
                      </Link>
                    </td>

                    <td
                      className={`num px-4 py-3 text-right text-[15px] ${
                        direction
                          ? direction === "up"
                            ? "tick-up"
                            : "tick-down"
                          : ""
                      }`}
                    >
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
                          {/* Where the price sits inside today's range,
                              which a pair of numbers alone does not show. */}
                          <span className="relative h-1 w-16 rounded-full bg-line-strong">
                            <span
                              className="absolute top-1/2 h-2.5 w-0.5 -translate-y-1/2 rounded-full transition-[inset-inline-start] duration-300"
                              style={{
                                insetInlineStart: `${range * 100}%`,
                                background: identity.accent,
                              }}
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
      </section>
    </div>
  );
}
