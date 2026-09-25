"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Sparkline } from "./Sparkline";
import { LiveBadge, Stat } from "./ui";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { describeStatus } from "@/lib/market-hours";
import { identityFor } from "@/lib/company-identity";
import {
  directionClass,
  fmtChange,
  fmtCompact,
  fmtPercent,
  fmtPrice,
  fmtTime,
} from "@/lib/format";

/**
 * The live surface of the market page: the index strip and the stock table,
 * fed by one stream.
 *
 * One hook for the whole deck rather than one per component. The upstream
 * feed accepts a single socket, and components each opening their own would
 * tick out of step — the same symbol showing two prices half a second apart
 * on one screen, which looks like a bug because it is one.
 */

export type IndexCard = {
  symbol: string;
  label: string;
  note: string;
  /** Closing prices through today's session, oldest first. */
  intraday: number[];
};

export type RowSeed = {
  symbol: string;
  name: string;
  /** Recent daily closes, for the row's sparkline. */
  trail: number[];
};

const directionOf = (change: number | null | undefined) =>
  change == null || change === 0 ? "flat" : change > 0 ? "up" : "down";

/* ------------------------------------------------------------------ */
/* Index strip                                                         */
/* ------------------------------------------------------------------ */

function IndexStrip({
  cards,
  quotes,
  tails,
}: {
  cards: IndexCard[];
  quotes: Record<string, LiveQuote>;
  tails: Record<string, number[]>;
}) {
  return (
    <div className="surface grid grid-cols-2 lg:grid-cols-4">
      {cards.map((card, i) => {
        const quote = quotes[card.symbol];
        const change = quote?.changePercent ?? null;
        const points = [...card.intraday, ...(tails[card.symbol] ?? [])];

        return (
          <div
            key={card.symbol}
            className={`relative overflow-hidden px-5 py-4 ${
              i % 2 === 1 ? "border-s border-line" : ""
            } ${i >= 2 ? "border-t border-line lg:border-t-0" : ""} ${
              i === 2 ? "lg:border-s lg:border-line" : ""
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span className="text-[12px] text-ink-muted">{card.label}</span>
              <span className="num text-[10px] text-ink-ghost">
                {card.note}
              </span>
            </div>

            <div className="num mt-2 text-[26px] leading-none tracking-tight">
              {fmtPrice(quote?.price)}
            </div>

            <div className={`num mt-1.5 text-[13px] ${directionClass(change)}`}>
              {fmtPercent(change)}
            </div>

            {/* The session's shape, in its own band under the figures. */}
            <Sparkline
              points={points}
              direction={directionOf(change)}
              area
              className="mt-3 h-8 w-full"
            />
          </div>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Stock table                                                         */
/* ------------------------------------------------------------------ */

type SortKey = "symbol" | "price" | "change";

function StockTable({
  rows,
  quotes,
  flash,
}: {
  rows: RowSeed[];
  quotes: Record<string, LiveQuote>;
  flash: Record<string, "up" | "down" | undefined>;
}) {
  const [sort, setSort] = useState<{ key: SortKey; desc: boolean }>({
    key: "change",
    desc: true,
  });

  const ordered = useMemo(() => {
    const value = (row: RowSeed) => {
      const quote = quotes[row.symbol];
      if (sort.key === "symbol") return row.symbol;
      if (sort.key === "price") return quote?.price ?? -Infinity;
      return quote?.changePercent ?? -Infinity;
    };

    return [...rows].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      const compared =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      return sort.desc ? -compared : compared;
    });
  }, [rows, quotes, sort]);

  const header = (key: SortKey, label: string, align = "text-end") => (
    <th scope="col" className={`px-4 py-2.5 font-normal ${align}`}>
      <button
        type="button"
        onClick={() =>
          setSort((current) =>
            current.key === key
              ? { key, desc: !current.desc }
              : { key, desc: true },
          )
        }
        className="inline-flex items-center gap-1 transition-colors hover:text-ink"
        aria-label={`מיין לפי ${label}`}
      >
        {label}
        <span
          className={`text-[9px] ${sort.key === key ? "text-accent" : "text-ink-ghost"}`}
          aria-hidden="true"
        >
          {sort.key === key ? (sort.desc ? "▼" : "▲") : "▼"}
        </span>
      </button>
    </th>
  );

  return (
    <div className="surface overflow-hidden">
      {/* Horizontal scroll on a phone rather than a stacked card per row:
          the columns are the comparison, and stacking destroys it. */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">
          <caption className="sr-only">
            מחירים חיים. מתעדכן בכל עסקה שמתבצעת בבורסה. ניתן למיין לפי כל
            עמודה.
          </caption>
          <thead>
            <tr className="border-b border-line text-[11px] text-ink-faint">
              {header("symbol", "חברה", "text-start")}
              {header("price", "מחיר")}
              {header("change", "שינוי")}
              <th scope="col" className="px-4 py-2.5 text-end font-normal">
                מגמה
              </th>
              <th scope="col" className="px-4 py-2.5 text-end font-normal">
                טווח היום
              </th>
            </tr>
          </thead>
          <tbody>
            {ordered.map((row) => {
              const quote = quotes[row.symbol];
              const identity = identityFor(row.symbol);
              const moved = flash[row.symbol];
              const change = quote?.changePercent ?? null;

              const range =
                quote?.high != null &&
                quote?.low != null &&
                quote.high > quote.low
                  ? ((quote.price ?? quote.low) - quote.low) /
                    (quote.high - quote.low)
                  : null;

              return (
                <tr
                  key={row.symbol}
                  className="group border-b border-line transition-colors last:border-0 hover:bg-raised"
                >
                  <td className="px-4 py-3">
                    <Link
                      href={`/company/${row.symbol}`}
                      className="flex items-center gap-3"
                    >
                      <span
                        className="h-7 w-[3px] shrink-0 rounded-full"
                        style={{ background: identity.accent }}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span className="num block text-[13px] font-medium text-ink">
                          {row.symbol}
                        </span>
                        <span className="block truncate text-[11px] text-ink-faint">
                          {row.name}
                        </span>
                      </span>
                    </Link>
                  </td>

                  <td
                    className={`num px-4 py-3 text-end text-[15px] ${
                      moved === "up"
                        ? "settle-up"
                        : moved === "down"
                          ? "settle-down"
                          : ""
                    }`}
                  >
                    {fmtPrice(quote?.price)}
                  </td>

                  <td className="px-4 py-3 text-end">
                    <span className={`num text-[13px] ${directionClass(change)}`}>
                      {fmtPercent(change)}
                    </span>
                    <span className="num block text-[10px] text-ink-ghost">
                      {fmtChange(quote?.change)}
                    </span>
                  </td>

                  <td className="px-4 py-3">
                    <Sparkline
                      points={row.trail}
                      direction={directionOf(change)}
                      className="ms-auto h-7 w-24"
                    />
                  </td>

                  <td className="px-4 py-3">
                    {range === null ? (
                      <span className="num block text-end text-ink-ghost">—</span>
                    ) : (
                      <div className="flex items-center justify-end gap-2">
                        <span className="num text-[10px] text-ink-ghost">
                          {fmtPrice(quote?.low)}
                        </span>
                        <span className="relative h-[3px] w-20 rounded-full bg-overlay">
                          <span
                            className="absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-ink transition-[inset-inline-start] duration-500"
                            style={{ insetInlineStart: `${range * 100}%` }}
                          />
                        </span>
                        <span className="num text-[10px] text-ink-ghost">
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
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Deck                                                                */
/* ------------------------------------------------------------------ */

export function MarketDeck({
  indices,
  rows,
  initial,
}: {
  indices: IndexCard[];
  rows: RowSeed[];
  initial: Record<string, LiveQuote>;
}) {
  const symbols = useMemo(
    () => [...new Set([...indices.map((i) => i.symbol), ...rows.map((r) => r.symbol)])],
    [indices, rows],
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
    const measured = rows
      .map((row) => quotes[row.symbol]?.changePercent)
      .filter((value): value is number => typeof value === "number");

    if (measured.length === 0) return;
    const green = measured.filter((value) => value > 0).length / measured.length;

    // A dead zone around even, so a genuinely mixed market reads as neutral
    // rather than flickering between two colours.
    document.documentElement.style.setProperty(
      "--tint",
      green > 0.62 ? "#22c55e" : green < 0.38 ? "#ef4444" : "#94a3b8",
    );
  }, [quotes, rows]);

  const open = market.state === "open";
  const streaming = feed === "live";
  const state = open && streaming ? "live" : open ? "waiting" : "idle";
  const label = !open
    ? describeStatus(market)
    : streaming && tickCount > 0
      ? "זרם חי"
      : streaming
        ? "מחובר, ממתין לעסקה"
        : "רענון מחזורי";

  const advancing = rows.filter(
    (row) => (quotes[row.symbol]?.changePercent ?? 0) > 0,
  ).length;

  return (
    <>
      {/* ---- Indices ---- */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="section-mark" aria-hidden="true" />
          <span className="eyebrow">מדדים מובילים</span>
        </div>
        <div className="flex items-center gap-4">
          <LiveBadge state={state} label={label} />
          {lastTickAt && (
            <span className="num text-[11px] text-ink-ghost">
              {fmtTime(lastTickAt)}
            </span>
          )}
        </div>
      </div>

      <IndexStrip cards={indices} quotes={quotes} tails={tails} />

      <p className="mt-2 text-[11px] text-ink-ghost">
        המדדים מוצגים דרך קרנות הסל שעוקבות אחריהם. הגרף הוא מהלך היום
        בפועל, בחלוקה לחמש דקות.
      </p>

      {/* ---- Breadth ---- */}
      <div className="mt-10 flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="section-mark" aria-hidden="true" />
          <span className="eyebrow">רשימת מעקב</span>
        </div>
        <Stat
          label="עולות מתוך הרשימה"
          value={
            <>
              {advancing}
              <span className="text-ink-ghost">/{rows.length}</span>
            </>
          }
          size="sm"
        />
      </div>

      <div className="mt-4">
        <StockTable rows={rows} quotes={quotes} flash={flash} />
      </div>
    </>
  );
}
