"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { getWatchlist, WATCHLIST_EVENT } from "@/lib/watchlist";
import type { Signal } from "@/lib/intel/signals";
import { SignalCard } from "./SignalCard";
import { Empty, Skeleton } from "./ui";

/**
 * The briefing, narrowed to what the reader actually holds.
 *
 * The filtering happens in the browser, and that is not an implementation
 * detail — the watchlist lives in `localStorage` and has never been sent
 * anywhere. There are no accounts on this site and no server that knows
 * what anyone follows, so the only place this filter *can* run is here.
 * The panel says so, because a reader who sees their own holdings on a
 * page is entitled to know whether a server saw them too.
 *
 * The consequence is a first paint with nothing in it. That is handled
 * with a skeleton rather than by rendering the unfiltered list and then
 * removing rows, which would flash the whole market at someone who asked
 * for three companies.
 *
 * What it will not do is manufacture relevance. A reader following three
 * companies on a day when none of them did anything sees a sentence
 * saying exactly that. Promoting the next-nearest signal to fill the
 * space is how a personalised feed becomes the same feed with a different
 * title.
 */
export function PersonalIntel({
  signals,
  risks,
}: {
  signals: Signal[];
  risks: Signal[];
}) {
  /** `null` means "not read yet" — distinct from an empty watchlist. */
  const [watched, setWatched] = useState<string[] | null>(null);

  useEffect(() => {
    const read = () => setWatched(getWatchlist());
    read();

    /* Another tab, or the watch button on a company page in this one. */
    window.addEventListener(WATCHLIST_EVENT, read);
    window.addEventListener("storage", read);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, read);
      window.removeEventListener("storage", read);
    };
  }, []);

  if (watched === null) {
    return (
      <div className="surface p-5" aria-busy="true">
        <span className="sr-only">קורא את רשימת המעקב מהדפדפן</span>
        <Skeleton className="h-3" width="220px" />
        <Skeleton className="mt-3 h-3" width="70%" />
        <Skeleton className="mt-3 h-3" width="45%" />
      </div>
    );
  }

  if (watched.length === 0) {
    return (
      <Empty
        title="רשימת המעקב ריקה"
        reason="ברגע שיהיו בה חברות, החלק הזה יציג רק את מה שנוגע להן — ורק את מה שחצה את סף המהותיות. הרשימה נשמרת בדפדפן הזה בלבד."
        links={[
          { href: "/watchlist", label: "לבניית הרשימה" },
          { href: "/opportunities", label: "מהסורק" },
          { href: "/heatmap", label: "מה זז היום" },
        ]}
      />
    );
  }

  const follow = new Set(watched.map((ticker) => ticker.toUpperCase()));

  const mine = signals.filter(
    (signal) => signal.ticker && follow.has(signal.ticker.toUpperCase()),
  );

  /* A sector-level risk counts when the reader holds something in that
     sector — the whole point of a breadth warning is that it is about the
     group and not about one name. */
  const sectorsHeld = new Set(
    signals
      .filter((signal) => signal.ticker && follow.has(signal.ticker.toUpperCase()))
      .map((signal) => signal.sector)
      .filter((sector): sector is string => Boolean(sector)),
  );

  const mineRisks = risks.filter(
    (risk) => !risk.sector || sectorsHeld.has(risk.sector),
  );

  if (mine.length === 0 && mineRisks.length === 0) {
    return (
      <div className="surface p-6">
        <p className="text-[14px] text-ink">
          אף אחת מ-{watched.length} החברות שאתה עוקב אחריהן לא הפיקה היום ממצא
          מהותי.
        </p>
        <p className="mt-2 max-w-2xl text-[12px] leading-relaxed text-ink-muted">
          זו התשובה, לא מקום ריק. הצגת הממצא הקרוב ביותר כדי למלא את השטח
          הייתה הופכת את החלק הזה לאותו פיד עם כותרת אחרת.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          {watched.slice(0, 10).map((ticker) => (
            <Link
              key={ticker}
              href={`/company/${ticker}`}
              className="pill hover:border-line-bright"
            >
              <span className="num">{ticker}</span>
            </Link>
          ))}
          {watched.length > 10 && (
            <Link href="/watchlist" className="pill hover:border-line-bright">
              ועוד {watched.length - 10}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-[12px] leading-relaxed text-ink-faint">
        {mine.length + mineRisks.length} ממצאים מתוך {signals.length + risks.length}{" "}
        נוגעים ל-{watched.length} החברות שברשימה שלך. הסינון נעשה בדפדפן —
        רשימת המעקב מעולם לא נשלחה לשרת.
      </p>

      <div className="grid gap-4 lg:grid-cols-2">
        {[...mine, ...mineRisks].map((signal) => (
          <SignalCard key={signal.id} signal={signal} />
        ))}
      </div>
    </div>
  );
}
