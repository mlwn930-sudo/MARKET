"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Pulls the news page in again when the feed behind it has changed.
 *
 * The refresh workflow runs every twenty minutes, so this checks a little
 * more often than that and does nothing at all on the cycles where nothing
 * arrived — which is most of them. What it polls is a few bytes saying when
 * the feed was last built; the page itself is only re-fetched once that
 * answer changes.
 *
 * Two behaviours are deliberate.
 *
 * It stops while the tab is hidden and checks once on return. A page left
 * open in a background tab overnight would otherwise make a few hundred
 * requests to learn nothing.
 *
 * It refreshes without scrolling or moving anything. `router.refresh()`
 * replaces the server-rendered content in place and keeps scroll position
 * and open sections, so a reader halfway through an article's analysis
 * stays exactly where they were. The badge is the only thing that appears —
 * a page that reshuffles itself under someone reading it is worse than a
 * page that is five minutes out of date.
 */

/** Slightly more often than the twenty-minute refresh cycle, so a new feed
 *  is picked up within a few minutes of landing without the polling itself
 *  becoming a load. */
const CHECK_MS = 4 * 60 * 1000;
const BADGE_MS = 6000;

type Status = { refreshedAt: string | null; analysed: number; total: number };

export function NewsAutoRefresh({
  refreshedAt,
  analysedCount,
}: {
  refreshedAt: string | null;
  analysedCount: number;
}) {
  const router = useRouter();
  const [updated, setUpdated] = useState(false);

  // Held in a ref rather than state: the effect must compare against the
  // latest known values without re-subscribing every time they change.
  const known = useRef({ refreshedAt, analysed: analysedCount });

  useEffect(() => {
    known.current = { refreshedAt, analysed: analysedCount };
  }, [refreshedAt, analysedCount]);

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
          status.refreshedAt !== known.current.refreshedAt ||
          status.analysed !== known.current.analysed;

        if (changed) {
          known.current = {
            refreshedAt: status.refreshedAt,
            analysed: status.analysed,
          };
          router.refresh();
          setUpdated(true);
          badgeTimer = setTimeout(() => {
            if (!cancelled) setUpdated(false);
          }, BADGE_MS);
        }
      } catch {
        // A failed check is not worth surfacing. The page on screen is
        // still the page that was correct a few minutes ago.
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
      הפיד התעדכן
    </span>
  );
}
