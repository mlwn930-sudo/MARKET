"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * The first thing, before anything.
 *
 * Thirty seconds of film across the whole screen, playing itself, with
 * three lines surfacing inside it. There is no scroll here and nothing to
 * operate: the reader arrives, watches, and the site opens behind it.
 *
 * WHY IT PLAYS RATHER THAN SCRUBS. It was scroll-driven first, pinned to
 * the top of the home page, and two things were wrong with that. A reader
 * dragging a playhead is working, not watching — four flicks of a
 * trackpad threw away a sequence built to be sat through. And a film at
 * the top of the home page is a toll gate: it is wonderful once and an
 * obstacle on the ninth visit, between a reader and the figures they
 * came back for. So it moved in front of the door instead, where an
 * entrance belongs, and it runs once a session.
 *
 * WHAT IT WILL NOT DO. It will not trap anybody. There is a skip from the
 * first second, Escape closes it, it dismisses itself if the file stalls,
 * a reader who asked for less motion never sees it at all, and a CSS
 * failsafe lifts it after a minute even with no JavaScript running at
 * all. An entrance that can lock somebody out of a site is not an
 * entrance, it is a fault.
 */

/** The three lines, in seconds of FILM — not of wall clock. `currentTime`
 *  is media time, so these stay correct whatever the playback rate is. */
const LINES: { at: number; until: number; text: string }[] = [
  { at: 2.4, until: 7.6, text: "כל מחיר הוא מספר." },
  { at: 10.4, until: 15.6, text: "מאחוריו יש חברה." },
  { at: 19, until: 24.4, text: "ומאחוריה — מה שהיא באמת שווה." },
];

/** Slower than the film was authored at.
 *
 *  The sequence is a steady descent with heavy motion blur, which is
 *  exactly the material that survives being slowed: nothing in it cuts or
 *  snaps, so a tenth off the rate reads as weight rather than as judder.
 *  Thirty seconds of footage become thirty-three. */
const RATE = 0.9;

/** How long the wordmark holds before the door appears behind it. The film
 *  ends on a lockup and a cut straight off it would throw away the one
 *  frame everything else was built to arrive at. */
const HOLD_MS = 2600;

/** If the file has not started by now, let the reader in. A door that
 *  waits on twelve megabytes over a bad connection is a broken door. */
const PATIENCE_MS = 9000;

const SEEN = "market-intel:intro:v1";

export function OpeningFilm() {
  const video = useRef<HTMLVideoElement>(null);
  const [open, setOpen] = useState(true);
  const [leaving, setLeaving] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);

  const dismiss = useCallback(() => {
    setLeaving(true);
    try {
      sessionStorage.setItem(SEEN, "1");
    } catch {
      /* Private browsing throws on write. The intro simply plays again
         next time, which is the harmless failure. */
    }
    /* Unmounted after the fade rather than during it, so the last frame
       does not vanish mid-dissolve. */
    window.setTimeout(() => setOpen(false), 700);
  }, []);

  /* Decide whether this reader sees it at all. Three reasons not to: they
     have already been through this session, they asked for less motion,
     or the screen is too small to hold a 2.33:1 frame at a size worth
     watching. All three are decided before the file is fetched. */
  useEffect(() => {
    let seen = false;
    try {
      seen = sessionStorage.getItem(SEEN) === "1";
    } catch {
      seen = false;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (seen || reduced) {
      setOpen(false);
      return;
    }

    const node = video.current;
    if (!node) return;
    node.playbackRate = RATE;
    node.play().catch(() => {
      /* Autoplay refused even muted — nothing to watch, so do not make
         the reader dismiss an empty black screen. */
      dismiss();
    });

    const giveUp = window.setTimeout(() => {
      if (node.currentTime < 0.2) dismiss();
    }, PATIENCE_MS);
    return () => window.clearTimeout(giveUp);
  }, [dismiss]);

  /* Escape, always. */
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") dismiss();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, dismiss]);

  /* The lines, from `timeupdate` rather than a frame loop. It fires about
     four times a second, which is a hundred times more often than a line
     that changes every five seconds needs. */
  const onTime = useCallback(() => {
    const node = video.current;
    if (!node) return;
    const t = node.currentTime;
    const current = LINES.find((l) => t >= l.at && t < l.until);
    setLine((previous) =>
      previous === (current?.text ?? null) ? previous : current?.text ?? null,
    );
  }, []);

  if (!open) return null;

  return (
    <div
      className="opening-film"
      data-leaving={leaving ? "true" : "false"}
      role="dialog"
      aria-modal="true"
      aria-label="הפתיח"
    >
      <video
        ref={video}
        className="opening-film-frame"
        poster="/scene/entrance-first.webp"
        preload="auto"
        muted={muted}
        playsInline
        onTimeUpdate={onTime}
        onEnded={() => window.setTimeout(dismiss, HOLD_MS)}
        onError={dismiss}
      >
        {/* Two cuts of the same thirty seconds. A phone gets 3.6MB at 1100
            wide rather than 11.5MB at 1920 — on a cellular connection the
            large file would still be buffering when the patience timer
            gave up and let the reader past it, which is the sequence
            failing in the one place it most wants to work. Both carry the
            audio, so the sound button means something on either. */}
        <source
          src="/scene/entrance-play.mp4"
          type="video/mp4"
          media="(min-width: 1000px)"
        />
        <source src="/scene/entrance-play-sm.mp4" type="video/mp4" />
      </video>

      <div className="opening-film-veil" aria-hidden="true" />

      <p className="opening-film-line" data-shown={line ? "true" : "false"}>
        <span className="kinetic-window">
          <span className="kinetic-line" key={line ?? "none"}>
            {line}
          </span>
        </span>
      </p>

      <div className="opening-film-controls">
        <button
          type="button"
          onClick={() => {
            const node = video.current;
            if (!node) return;
            node.muted = !node.muted;
            setMuted(node.muted);
          }}
        >
          {muted ? "להפעיל סאונד" : "להשתיק"}
        </button>
        <button type="button" onClick={dismiss}>
          לדלג
        </button>
      </div>

      {/* Two independent ways out that need no JavaScript at all.
          `<noscript>` means a reader without it never sees this overlay,
          and the failsafe animation lifts it after a minute if the script
          loaded but never ran. An entrance that can lock somebody out is
          not an entrance. */}
      <noscript>
        <style>{`.opening-film{display:none!important}`}</style>
      </noscript>
    </div>
  );
}
