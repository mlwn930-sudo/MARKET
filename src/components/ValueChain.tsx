"use client";

import Link from "next/link";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { identityFor } from "@/lib/company-identity";
import { directionClass, fmtPercent, fmtPrice } from "@/lib/format";

export type ChainLink = {
  symbol: string;
  role: string;
  /** How this company is actually exposed. Never "benefits from gaming" —
   *  the mechanism, or the entry does not belong on the page. */
  mechanism: string;
  /** Honest about how much of the company the exposure represents. */
  exposure: "ישירה" | "חלקית" | "שולית";
};

const EXPOSURE_NOTE: Record<ChainLink["exposure"], string> = {
  ישירה: "הכנסה ישירה מהכותר",
  חלקית: "רכיב מזוהה בתוך עסק גדול בהרבה",
  שולית: "השפעה אמיתית אך קטנה ביחס לחברה",
};

/**
 * The companies around a launch, with live prices and the reason each one
 * is on the list.
 *
 * The exposure label is the point of the component. A release of this size
 * gets written about as though it moves every company that touches games,
 * and for most of them the effect is real but immaterial — a rounding error
 * inside a trillion-dollar business. Saying which is which is the
 * difference between a value chain and a list of tickers.
 */
export function ValueChain({
  links,
  initial,
}: {
  links: ChainLink[];
  initial: Record<string, LiveQuote>;
}) {
  const symbols = links.map((link) => link.symbol);
  const { quotes, flash } = useLiveTicks(symbols, initial);

  return (
    <div className="stagger grid gap-3 sm:grid-cols-2">
      {links.map((link) => {
        const quote = quotes[link.symbol];
        const identity = identityFor(link.symbol);
        const direction = flash[link.symbol];

        return (
          <Link
            key={link.symbol}
            href={`/company/${link.symbol}`}
            className="surface interactive p-4"
          >
            <div className="flex items-baseline justify-between gap-3">
              <div>
                <span
                  className="num text-sm font-medium"
                  style={{ color: identity.accent }}
                >
                  {link.symbol}
                </span>
                <span className="mr-2 text-[11px] text-ink-muted">{link.role}</span>
              </div>

              <div className="text-left">
                <div className="num text-sm">{fmtPrice(quote?.price)}</div>
                <div
                  className={`num text-[11px] ${directionClass(quote?.changePercent)}`}
                >
                  {fmtPercent(quote?.changePercent)}
                </div>
              </div>
            </div>

            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              {link.mechanism}
            </p>

            <p className="mt-2 text-[10px] text-ink-faint">
              חשיפה {link.exposure} · {EXPOSURE_NOTE[link.exposure]}
            </p>
          </Link>
        );
      })}
    </div>
  );
}
