"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Watch the film again."
 *
 * The door in front of this page remembers that you came through, which is
 * right — nobody wants to sit through the same reel on every visit. But it
 * remembered with no way to undo, and the first thing that happens then is
 * that the page looks like the film was deleted. It was reported exactly
 * that way: "you broke the GTA VI video." Nothing was broken; the door had
 * simply already been opened and had no handle on the inside.
 *
 * So this is the handle. It drops the session key and reloads, which is the
 * same path a first visit takes rather than a second way of starting the
 * reel — one code path means the film cannot work on arrival and fail here.
 *
 * It renders only once mounted, because whether the film has been seen is a
 * fact about this browser session and the server cannot know it. Offering
 * "watch again" to someone who has not watched it yet would be a control
 * that does nothing visible.
 */

const KEY = "market-intel:ttwo-gate:v1";

export function ReplayFilm() {
  const [seen, setSeen] = useState(false);

  useEffect(() => {
    try {
      setSeen(window.sessionStorage.getItem(KEY) === "1");
    } catch {
      /* Private browsing refuses the read. Nothing was remembered, so the
         film will play on its own next time and the control is not needed. */
    }
  }, []);

  const replay = useCallback(() => {
    try {
      window.sessionStorage.removeItem(KEY);
    } catch {
      /* If the key could not be removed it was never set, and the reload
         below shows the film regardless. */
    }
    window.location.reload();
  }, []);

  if (!seen) return null;

  return (
    <button type="button" className="gta-replay" onClick={replay}>
      <span aria-hidden="true">▶</span>
      לצפות בסרטון שוב
    </button>
  );
}
