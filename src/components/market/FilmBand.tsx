"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A horizon that moves at the speed you read it.
 *
 * A full-bleed strip of film laid between two sections, carrying one line
 * and nothing else. It is the site's ground, not its content: no figure
 * ever sits on it, because a number over moving footage is a number
 * somebody has to wait for.
 *
 * WHY VELOCITY RATHER THAN POSITION. The obvious build is to scrub the
 * film against scroll position, and this project has already paid for that
 * lesson twice over: a scrubbed timeline makes the reader the projectionist,
 * and `OpeningFilm` says plainly why the entrance stopped being scroll-driven
 * — a reader dragging a playhead is working, not watching. Scrubbing also
 * demands a file encoded with a keyframe on every frame, which is three or
 * four times the bytes for footage that is decoration.
 *
 * So the film always plays, and only its RATE is yours. Scrolling drives it
 * forward; stopping lets it fall back to a drift. The effect is that the
 * page has weather — it reacts to you without ever waiting for you, and a
 * reader who never scrolls still sees a moving picture rather than a frozen
 * frame.
 *
 * WHAT IT WILL NOT DO.
 *
 *  - It never decodes off-screen. The element is paused until it intersects
 *    and paused again when it leaves, because a 720p loop running behind
 *    three screens of content is a battery bill for something nobody sees.
 *  - It is silent and has no controls. There is nothing here to operate.
 *  - `prefers-reduced-motion` gets the poster frame and the line, and the
 *    video is never loaded at all. The information survives the motion
 *    being removed, which is the rule — not the other way round.
 *  - If the file never arrives, the poster stays and the band still reads.
 *    A band that collapses to a black hole on a bad connection is a fault.
 */

/** Where the rate settles when nobody is scrolling. Low enough to read as
 *  drift rather than playback, high enough that the frame is never still. */
const DRIFT = 0.18;

/** The ceiling. Kling renders seven seconds; let a fast flick run it at
 *  speed, but never so fast that the footage turns to strobe. */
const MAX_RATE = 2.6;

/** Pixels of scroll per second that map to 1x. Tuned against a trackpad
 *  flick rather than a mouse wheel, because the wheel arrives in big
 *  discrete jumps and would peg the rate on a single notch. */
const PX_PER_SECOND_AT_1X = 900;

/** How fast the rate falls back to DRIFT once the scrolling stops. One
 *  step per frame, so it is frame-rate shaped rather than timer shaped. */
const DECAY = 0.86;

export function FilmBand({
  src,
  poster,
  eyebrow,
  line,
  height = "56vh",
}: {
  src: string;
  poster: string;
  eyebrow: string;
  line: string;
  /** Any CSS length. The band is a horizon, so it wants to be wide and
   *  short — tall enough to feel like a shot, never tall enough to be a
   *  section the reader has to get past. */
  height?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [still, setStill] = useState(false);
  /**
   * Whether the file has been asked for yet.
   *
   * `preload="metadata"` on a `src` that is present from the first render
   * sounds modest and is not: it is a request per band on every page load,
   * before anybody has scrolled, for a file most readers on most visits
   * never reach. The poster is twenty-eight kilobytes and carries the
   * band on its own, so the video is attached only once the observer says
   * the band is approaching — which on a page where the reader stops at
   * the first screen means two megabytes that are never fetched at all.
   */
  const [armed, setArmed] = useState(false);

  /* Decided on the client, because the server has no media queries. Until
     it resolves the markup carries the poster and no <video>, which is
     also exactly what a reader who asked for less motion keeps. */
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const apply = () => setStill(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);

  useEffect(() => {
    if (still) return;
    const node = root.current;
    const film = video.current;
    if (!node || !film) return;

    let visible = false;
    let rate = DRIFT;
    let lastY = window.scrollY;
    let lastT = performance.now();
    let frame = 0;

    const observer = new IntersectionObserver(
      ([entry]) => {
        visible = entry.isIntersecting;
        if (visible) {
          /* The first approach is what buys the file. Once armed it stays
             armed: re-fetching a clip the reader has already scrolled past
             once would be worse than keeping it. */
          setArmed(true);
          /* Autoplay can still be refused — a muted inline video is
             normally allowed, but a refusal here just means the poster
             stays, which is a correct picture rather than a broken one. */
          film.play().catch(() => {});
          /* Back to a drift on every arrival. The rate is a closure that
             outlives the band leaving the screen, so without this a reader
             who flicked past it once finds it already at speed the next
             time it appears — which reads as a glitch, not as weather. */
          rate = DRIFT;
          lastY = window.scrollY;
          lastT = performance.now();
          if (!frame) frame = requestAnimationFrame(tick);
        } else {
          film.pause();
          cancelAnimationFrame(frame);
          frame = 0;
        }
      },
      /* A little before it arrives, so the first frame is already moving
         by the time the band is under the reader's eye. */
      { rootMargin: "25% 0px" },
    );
    observer.observe(node);

    function tick(now: number) {
      frame = requestAnimationFrame(tick);
      const film = video.current;
      if (!film) return;

      /* The loop is also what starts the film, and it has to be.
         Arming attaches the src on the NEXT render, so the `play()` the
         observer fires happens while the element still has no source and
         is rejected. Starting it from here instead means the attempt is
         repeated against whatever state the element is actually in, which
         also quietly covers a decode that failed and a tab that was
         backgrounded mid-clip. `play()` on an already-playing element is
         a no-op, so this costs a branch. */
      if (film.paused && film.currentSrc) film.play().catch(() => {});

      const dt = Math.max(now - lastT, 1) / 1000;
      const dy = Math.abs(window.scrollY - lastY);
      lastY = window.scrollY;
      lastT = now;

      /* The rate the current scroll speed asks for. It only ever raises
         the rate; letting it lower the rate too would make the film stutter
         between two wheel notches rather than coast through them. */
      const wanted = dy / dt / PX_PER_SECOND_AT_1X;
      rate = Math.max(wanted, rate * DECAY, DRIFT);
      if (rate > MAX_RATE) rate = MAX_RATE;

      /* Browsers clamp playbackRate to their own range and some mute the
         audio outside 0.5–4; the track is silent, so only the clamp
         matters and assigning out of range is harmless. */
      film.playbackRate = rate;
    }

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [still]);

  return (
    <div
      ref={root}
      className="film-band on-dark"
      style={{ ["--film-band-h" as string]: height }}
      /* It is scenery with one line of type in it; the line is in the DOM
         and reads fine, so nothing here needs announcing as a region. */
      aria-hidden={false}
    >
      <div className="film-band-stage">
        {still ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="film-band-media" />
        ) : (
          <video
            ref={video}
            className="film-band-media"
            /* Absent until the band is approaching. A `<video>` with no
               src paints its poster and costs nothing. */
            src={armed ? src : undefined}
            poster={poster}
            muted
            loop
            playsInline
            preload="none"
            tabIndex={-1}
            disablePictureInPicture
            /* Nothing here is castable and nothing here is a video the
               reader chose to watch; the controls those attributes invite
               would be offering to full-screen the wallpaper. */
            disableRemotePlayback
          />
        )}
      </div>

      <div className="film-band-copy">
        <span className="micro-label">{eyebrow}</span>
        <p>{line}</p>
      </div>
    </div>
  );
}
