"use client";

import { useEffect, useState } from "react";
import { WATCHLIST_EVENT, isWatched, toggleWatch } from "@/lib/watchlist";

/**
 * Follow a company.
 *
 * Renders as "not followed" on the server and corrects itself on mount,
 * because the answer lives in localStorage and the server has no way to
 * know it. The alternative — rendering nothing until mounted — makes the
 * button appear a moment after the rest of the page, which on a sticky
 * header reads as a layout bug.
 *
 * No colour change when active. A filled star on a dark panel is enough,
 * and the accent belongs to the page rather than to a control's state.
 */
export function WatchButton({
  ticker,
  size = "md",
}: {
  ticker: string;
  size?: "sm" | "md";
}) {
  const [watched, setWatched] = useState(false);

  useEffect(() => {
    const sync = () => setWatched(isWatched(ticker));
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, [ticker]);

  return (
    <button
      type="button"
      onClick={() => setWatched(toggleWatch(ticker))}
      aria-pressed={watched}
      title={watched ? "הסר מהמעקב" : "הוסף למעקב"}
      className={`btn btn-ghost gap-1.5 ${size === "sm" ? "px-2 py-1 text-[11px]" : "px-2.5 py-1.5 text-[12px]"}`}
    >
      <svg
        width={size === "sm" ? 11 : 13}
        height={size === "sm" ? 11 : 13}
        viewBox="0 0 16 16"
        aria-hidden="true"
      >
        <path
          d="M8 1.6l1.9 3.9 4.3.6-3.1 3 .7 4.3L8 11.4l-3.8 2 .7-4.3-3.1-3 4.3-.6z"
          fill={watched ? "currentColor" : "none"}
          stroke="currentColor"
          strokeWidth="1.2"
          strokeLinejoin="round"
        />
      </svg>
      {watched ? "במעקב" : "מעקב"}
    </button>
  );
}
