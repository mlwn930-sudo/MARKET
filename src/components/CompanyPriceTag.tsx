"use client";

import { useMemo } from "react";
import { LiveBadge } from "./ui";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { describeStatus } from "@/lib/market-hours";
import { directionClass, fmtChange, fmtPrice } from "@/lib/format";
import type { ExtendedHours } from "@/lib/sources/extended-hours";

/**
 * The price, where someone arriving at a company page actually looks.
 *
 * The page had a live price and put it in chapter two. Everything above it
 * — market cap, P/E, three-year growth, the date of the last filing — is
 * the long answer to a question nobody asks before the short one: what does
 * it cost right now. A research page can argue that a multiple matters more
 * than a quote; it cannot argue that the quote belongs below the fold.
 *
 * Same hook, same formatters and the same seed as the chart in chapter two,
 * so the two cannot print different numbers. `useLiveTicks` deduplicates the
 * subscription, so two readers of one symbol is one stream.
 *
 * The change is the only coloured thing here. Green and red on this site
 * mean price direction and nothing else, which is exactly what this is.
 */
/** What a session is called beside a figure. "Regular" gets no label:
 *  a price during the session is just the price, and labelling it would
 *  make the two extended labels look like decoration rather than warning. */
const SESSION_LABEL: Record<"pre" | "post", string> = {
  pre: "PRE MARKET",
  post: "AFTER HOURS",
};

export function CompanyPriceTag({
  symbol,
  initial,
  extended,
}: {
  symbol: string;
  initial: LiveQuote | null;
  /** The pre/post tape. Finnhub's quote covers the regular session only, so
   *  without this the masthead shows yesterday's close and yesterday's move
   *  for the whole of a pre-market morning — a number that has not been
   *  true since the previous afternoon, with nothing saying so. */
  extended: ExtendedHours | null;
}) {
  // Stable identities, or the hook resubscribes on every parent render.
  const watch = useMemo(() => [symbol], [symbol]);
  const seed = useMemo(
    () => (initial ? { [symbol]: initial } : {}),
    [initial, symbol],
  );

  const { quotes, flash, market, feed, tickCount } = useLiveTicks(watch, seed);

  const quote = quotes[symbol];
  const moved = flash[symbol];
  const open = market.state === "open";
  const streaming = feed === "live";
  const state = open && streaming ? "live" : open ? "waiting" : "idle";

  /* The same three sentences the chart's badge uses, for the same reason:
     a still price has three innocent explanations — the market is shut, it
     is open and nobody traded this minute, or the stream is down and the
     slower poll is covering. A price that stops moving without saying which
     reads as broken. */
  const status = !open
    ? describeStatus(market)
    : streaming && tickCount > 0
      ? "זרם חי"
      : streaming
        ? "מחובר, ממתין לעסקה"
        : "רענון מחזורי";

  /* No quote at all is a real state and gets said, not hidden. A header
     that silently drops its price when the provider rate-limits reads as a
     page with no price rather than a page whose price did not arrive. */
  if (!quote || quote.price == null) {
    return (
      <div className="price-tag">
        <span className="price-tag-figure num text-ink-ghost">—</span>
        <span className="price-tag-note">הציטוט לא התקבל. הגרף למטה מציג את הסגירה האחרונה שידועה.</span>
      </div>
    );
  }

  /* The site's own direction classes, not a pair invented here.

     `.is-up` was tried first and came out white: the night theme defines
     .text-up / .text-down under `body:not(:has(.gta-cover))`, which
     outranks a plain two-class selector, so a local rule loses to the theme
     and the chip renders in body colour. Using directionClass() is both the
     fix and the rule — one source of truth for what a rising price looks
     like, which is also why the tint below is derived from currentColor
     rather than from a second copy of the palette. */
  /* Which tape the headline figure comes from.

     Outside the session the extended print is the live price and the
     regular close is history; inside it, the reverse. So the headline
     follows the clock rather than the source, and whichever one is not
     the headline is printed underneath as its own fact — a reader in
     pre-market needs both "it closed at 330.32" and "it is 332.75 now",
     and either alone is misleading. */
  const session =
    extended && extended.phase === "pre" && extended.pre
      ? { tape: extended.pre, label: SESSION_LABEL.pre }
      : extended && extended.phase === "post" && extended.post
        ? { tape: extended.post, label: SESSION_LABEL.post }
        : null;

  const shownPrice = session ? session.tape.price : quote.price;
  const shownPercent = session ? session.tape.changePercent : quote.changePercent;
  const shownChange = session ? session.tape.change : quote.change ?? null;
  const dir = directionClass(shownPercent);

  const regularClose = extended?.regularPrice ?? null;

  return (
    <div className="price-tag">
      <div className="price-tag-row">
        <span
          className={`price-tag-figure num ${
            moved === "up" ? "settle-up" : moved === "down" ? "settle-down" : ""
          }`}
          dir="ltr"
        >
          {fmtPrice(shownPrice)}
        </span>
        {shownPercent != null && (
          <span className={`price-tag-change num ${dir}`} dir="ltr">
            {shownPercent > 0 ? "+" : ""}
            {shownPercent.toFixed(2)}%
            {shownChange != null && <i>{fmtChange(shownChange)}</i>}
          </span>
        )}
        {session && <span className="session-tag">{session.label}</span>}
      </div>

      {/* The other tape, named. Without it an extended figure reads as the
          session price and a reader has no way to see the gap. */}
      {session && regularClose != null && (
        <div className="price-tag-close">
          סגירה אחרונה{" "}
          <span className="num" dir="ltr">
            {fmtPrice(regularClose)}
          </span>
          {extended?.previousClose != null &&
            extended.previousClose > 0 &&
            regularClose > 0 && (
              <>
                {" · "}
                <span className="num" dir="ltr">
                  {(((regularClose - extended.previousClose) /
                    extended.previousClose) *
                    100).toFixed(2)}
                  %
                </span>{" "}
                במסחר הרגיל
              </>
            )}
        </div>
      )}

      <div className="price-tag-foot">
        <LiveBadge state={state} label={status} />
      </div>
    </div>
  );
}
