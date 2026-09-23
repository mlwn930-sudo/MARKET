"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pulls the news page in again when the stories behind it have changed.
 *
 * It polls a few bytes — a signature of the current article list — and only
 * re-fetches the page when that signature moves. The feed itself is rebuilt
 * on a timer whether or not anything arrived, so watching a timestamp would
 * mean refreshing every couple of minutes over an unchanged list and
 * announcing it each time.
 *
 * Three behaviours are deliberate.
 *
 * It stops while the tab is hidden and checks once on return. A page left
 * open overnight would otherwise make a few hundred requests to learn
 * nothing.
 *
 * It refreshes without moving anything. `router.refresh()` replaces the
 * server-rendered content in place and keeps scroll position and open
 * sections, so a reader halfway through an article's analysis stays exactly
 * where they were. A page that reshuffles under someone reading it is worse
 * than one that is a minute out of date.
 *
 * It does not announce the first change it sees after mounting if nothing
 * actually differs from what was rendered — the badge is reserved for a
 * genuine arrival, so that it keeps meaning something.
 */

/** The feed behind this rebuilds every two minutes, so checking a little
 *  more often than that catches a story without the polling becoming a load
 *  in its own right. */
const CHECK_MS = 60_000;
const BADGE_MS = 5000;

type Status = {
  signature: string;
  analysed: number;
  total: number;
};

export function NewsAutoRefresh({
  signature,
  analysedCount,
}: {
  /** The signature of the list as this render saw it. */
  signature: string;
  analysedCount: number;
}) {
  const router = useRouter();
  const [updated, setUpdated] = useState(false);

  // Held in a ref so the polling effect can compare against the latest
  // render without re-subscribing every time the page re-renders.
  const known = useRef({ signature, analysed: analysedCount });

  useEffect(() => {
    known.current = { signature, analysed: analysedCount };
  }, [signature, analysedCount]);

  useEffect(() => {
    let cancelled = false;
    let badgeTimer: ReturnType<typeof setTimeout> | undefined;

    async function check() {
      if (document.visibilityState === "hidden") return;

      try {
        const res = await fetch("/api/news-status", { cache: "no-store" });
        if (!res.ok) return;

        const status: Status = await res.json();
        if (cancelled) return;

        const changed =
          status.signature !== known.current.signature ||
          status.analysed !== known.current.analysed;

        if (!changed) return;

        known.current = {
          signature: status.signature,
          analysed: status.analysed,
        };
        router.refresh();
        setUpdated(true);
        badgeTimer = setTimeout(() => {
          if (!cancelled) setUpdated(false);
        }, BADGE_MS);
      } catch {
        // A failed check is not worth surfacing. What is on screen is still
        // what was correct a minute ago.
      }
    }

    const interval = setInterval(check, CHECK_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") check();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearTimeout(badgeTimer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [router]);

  if (!updated) return null;

  return (
    <span
      className="accent-chip enter rounded-full px-2.5 py-1 text-[11px]"
      role="status"
    >
      כתבות חדשות נטענו
    </span>
  );
}
