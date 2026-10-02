"use client";

import { useEffect, useState } from "react";
import { fmtRelative } from "@/lib/format";

/**
 * When something was read, measured against the clock of whoever is reading.
 *
 * The server cannot answer this. `fmtRelative` compares a moment to
 * `Date.now()`, and on the server both are the render — so a timestamp taken
 * during that render always formatted as "הרגע", and a page with
 * `revalidate = 600` then served that word out of the cache for up to ten
 * minutes. The figure was wrong in proportion to how much it mattered: the
 * staler the page, the more confidently it claimed to be new.
 *
 * So the ISO string travels to the browser and is formatted there, and it is
 * re-formatted on a timer, because a tab left open for an hour is exactly the
 * case the figure exists for.
 *
 * Nothing renders before the first effect. A value computed during hydration
 * would differ from the HTML the server sent, and an empty first paint costs
 * less than a mismatch.
 */

/** Twice per minute — the label's smallest unit is a minute, so it is never
 *  visibly behind, and the work is one subtraction. */
const TICK_MS = 30_000;

export function ReadAt({
  at,
  /** The word before the figure. A bare "לפני 4 דק׳" does not say of what. */
  label = "נקרא",
  /** What the figure should be read against — the window of the source
   *  behind it, usually. Rule 5 applies to a timestamp as much as to a
   *  multiple. */
  title,
}: {
  at: string;
  label?: string;
  title?: string;
}) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const moment = new Date(at).getTime();
    if (!Number.isFinite(moment)) return;

    const show = () => setText(fmtRelative(new Date(moment)));
    show();

    const timer = setInterval(show, TICK_MS);
    return () => clearInterval(timer);
  }, [at]);

  if (!text) return null;

  return (
    <span title={title}>
      {label} {text}
    </span>
  );
}
