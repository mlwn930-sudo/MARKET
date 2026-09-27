"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWatchlist, WATCHLIST_EVENT } from "@/lib/watchlist";
import { Delta, ErrorState, Skeleton } from "./ui";
import { fmtPrice } from "@/lib/format";

/**
 * The watchlist, compressed to a strip.
 *
 * The homepage already answers "what is the market doing" four different
 * ways before this point. The question this answers is the other one, and
 * it is the only thing on the page that differs per reader: what did the
 * companies *I* follow do.
 *
 * Deliberately not PersonalIntel, which is on /intel and /watchlist and
 * shows signals. Signals here would be a third telling of what
 * IntelligenceReadout and WhatMattersToday have already said above. Prices
 * for the names the reader chose are not said anywhere else on the page.
 *
 * The list lives in localStorage and is never sent anywhere except to this
 * site's own quote route, which needs the symbols to answer. There are no
 * accounts here and no server that knows what anyone follows.
 *
 * Three states rather than two, because "not read yet" and "nothing
 * followed" are different and rendering them the same way is how an empty
 * invitation flashes at a reader who follows twelve companies. `null` is
 * the unread state and gets the skeleton; an empty array is a real answer
 * and gets one quiet line.
 */

type Row = {
  ticker: string;
  name: string | null;
  price: number | null;
  changePercent: number | null;
};

/** Six fills the grid twice over at desktop. Past that the strip stops
 *  being a strip, and the full board is one link away. */
const SHOWN = 6;

export function WatchlistStrip() {
  const [watched, setWatched] = useState<string[] | null>(null);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [failed, setFailed] = useState(false);

  /* Read on mount, and again whenever a WatchButton anywhere on the page
     changes the list — otherwise following a company from the screener
     above leaves this strip showing the list from before the click. */
  useEffect(() => {
    const read = () => setWatched(getWatchlist());
    read();
    window.addEventListener(WATCHLIST_EVENT, read);
    return () => window.removeEventListener(WATCHLIST_EVENT, read);
  }, []);

  useEffect(() => {
    if (watched === null || watched.length === 0) {
      setRows(null);
      return;
    }

    let cancelled = false;
    setFailed(false);

    fetch("/api/watchlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers: watched.slice(0, SHOWN) }),
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error("bad status"))))
      .then((data: { rows?: Row[] }) => {
        if (!cancelled) setRows(data.rows ?? []);
      })
      .catch(() => {
        /* The message a reader gets is written below, not forwarded from
           here. Nothing about the response reaches the screen. */
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [watched]);

  if (watched === null) {
    return (
      <div className="surface grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }, (_, i) => (
          <Skeleton key={i} />
        ))}
      </div>
    );
  }

  if (watched.length === 0) {
    return (
      <p className="surface px-5 py-4 text-[13px] leading-relaxed text-ink-muted">
        אינך עוקב אחרי חברות עדיין. כפתור המעקב מופיע בכל עמוד חברה, והרשימה
        נשמרת בדפדפן שלך בלבד —{" "}
        <Link href="/opportunities" className="underline underline-offset-2">
          רדאר ההזדמנויות
        </Link>{" "}
        הוא מקום סביר להתחיל בו.
      </p>
    );
  }

  if (failed) {
    return (
      <ErrorState
        compact
        title="לא הצלחנו למשוך את הציטוטים לרשימה שלך"
        detail="הרשימה עצמה שמורה ולא נפגעה. שאר המספרים בעמוד אינם תלויים בקריאה הזו."
        source="Finnhub"
        links={[{ href: "/watchlist", label: "ללוח המעקב" }]}
      />
    );
  }

  if (rows === null) {
    return (
      <div className="surface grid gap-3 px-5 py-4 sm:grid-cols-2 lg:grid-cols-3">
        {watched.slice(0, SHOWN).map((ticker) => (
          <Skeleton key={ticker} />
        ))}
      </div>
    );
  }

  const hidden = watched.length - rows.length;

  return (
    <div className="surface divide-y divide-line overflow-hidden sm:grid sm:grid-cols-2 sm:divide-y-0 lg:grid-cols-3">
      {rows.map((row) => (
        <Link
          key={row.ticker}
          href={`/company/${row.ticker}`}
          className="flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-element"
        >
          <span className="min-w-0">
            <span className="num block text-[13px] font-medium text-ink">
              {row.ticker}
            </span>
            {row.name && (
              <span className="block truncate text-[11px] text-ink-faint">
                {row.name}
              </span>
            )}
          </span>
          <span className="shrink-0 text-end">
            <span className="num block text-[13px] text-ink">
              {fmtPrice(row.price)}
            </span>
            <Delta value={row.changePercent} size="sm" />
          </span>
        </Link>
      ))}

      {hidden > 0 && (
        <Link
          href="/watchlist"
          className="flex items-center px-5 py-3.5 text-[12px] text-ink-muted transition-colors hover:bg-element"
        >
          ועוד <span className="num mx-1">{hidden}</span> ברשימה ←
        </Link>
      )}
    </div>
  );
}
