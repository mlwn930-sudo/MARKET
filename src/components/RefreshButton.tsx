"use client";

import { usePathname, useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Fetch it again, for real.
 *
 * A browser reload re-renders the page from the server's cache and hands
 * back the same numbers, which is indistinguishable from a market that did
 * not move. This drops the cache first and then re-renders, so what comes
 * back was fetched after the click.
 *
 * It asks for the scope the current page actually uses. Dropping the SEC
 * filings cache from the news page would cost a multi-megabyte download on
 * the next company view and change nothing on screen.
 */
function scopeFor(pathname: string): { scope: string; ticker?: string } {
  if (pathname.startsWith("/company/")) {
    return {
      scope: "company",
      ticker: decodeURIComponent(pathname.split("/")[2] ?? "").toUpperCase(),
    };
  }
  if (pathname.startsWith("/news")) return { scope: "news" };
  if (pathname.startsWith("/brief")) return { scope: "brief" };
  if (pathname.startsWith("/launch")) return { scope: "company", ticker: "TTWO" };
  if (
    pathname.startsWith("/israel") ||
    pathname.startsWith("/heatmap") ||
    pathname.startsWith("/watchlist") ||
    pathname.startsWith("/compare") ||
    pathname === "/"
  ) {
    return { scope: "quotes" };
  }
  return { scope: "all" };
}

export function RefreshButton() {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    if (busy || pending) return;
    setBusy(true);
    setDone(false);

    try {
      await fetch("/api/revalidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(scopeFor(pathname)),
      });
      startTransition(() => router.refresh());
      setDone(true);
      // The tick is an acknowledgement, not a state. It goes away.
      setTimeout(() => setDone(false), 2_500);
    } catch {
      /* A failed refresh leaves the page exactly as it was, which is the
         correct outcome — there is nothing to tell the reader. */
    } finally {
      setBusy(false);
    }
  }

  const working = busy || pending;

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={working}
      title="מושך נתונים חדשים מהמקור, לא רק מרענן את העמוד"
      aria-label="רענון נתונים"
      className="btn btn-ghost px-2 py-1.5 text-[12px]"
    >
      <svg
        width="13"
        height="13"
        viewBox="0 0 16 16"
        aria-hidden="true"
        className={working ? "animate-spin" : undefined}
      >
        <path
          d="M13.5 8a5.5 5.5 0 1 1-1.6-3.9M13.5 2v3h-3"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="hidden sm:inline">
        {working ? "מושך…" : done ? "עודכן" : "רענן"}
      </span>
    </button>
  );
}
