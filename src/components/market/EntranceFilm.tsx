"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/**
 * The door.
 *
 * Thirty seconds of film, and the reader's own hand is the clock. The
 * scroll wheel does not move the page past the film — it moves the film.
 * Scroll down and the camera descends; scroll back up and it climbs. The
 * sequence ends on the wordmark, on the same near-black the site is built
 * on, so the page does not begin after the film: it begins *inside* the
 * last frame.
 *
 * WHY SCRUB RATHER THAN PLAY. A film that plays on its own has a pace the
 * reader cannot argue with, and a reader who arrives mid-sequence has
 * missed something. Scrubbing makes the sequence a place rather than an
 * event — it is always exactly where you left it, and leaving is one
 * flick away.
 *
 * THREE THINGS THAT MAKE THIS SMOOTH RATHER THAN SICKENING, and all three
 * are load-bearing:
 *
 *  - The scroll position is never written to `currentTime` directly. It
 *    sets a TARGET, and a rAF loop eases the real playhead toward it. A
 *    direct write lands on whatever frame the decoder can reach, which on
 *    a trackpad flick is a stutter; the easing turns the same input into
 *    a camera with mass.
 *  - Every frame is a keyframe in the encode (`-g 1`). Seeking to an
 *    arbitrary time in a normally-encoded file makes the decoder walk
 *    back to the previous keyframe and replay forward, which is the
 *    single most common reason a scrubbed video judders.
 *  - The pin is bounded by matchMedia. A pinned full-screen section on a
 *    short window is a scroll trap, and this project has already paid for
 *    that once.
 *
 * WHAT IT WILL NOT DO. It does not intercept the wheel, it does not hold
 * the reader anywhere they cannot leave by scrolling, it carries no
 * autoplaying sound, and it never blocks the data — everything below it
 * renders and is reachable whether or not the film ever loads.
 */

/** The film's own beats, in seconds, matched to where the camera is.
 *
 *  Three lines across thirty seconds, each on screen for about four of
 *  them. The site's whole argument is that a figure alone is a datum, so
 *  the door states it before the first figure appears — and then stops
 *  talking, because the last ten seconds are the part that earns it. */
const CAPTIONS: { at: number; until: number; text: string }[] = [
  { at: 2.5, until: 7.5, text: "כל מחיר הוא מספר." },
  { at: 11, until: 16, text: "מאחוריו יש חברה." },
  { at: 19.5, until: 24.5, text: "ומאחוריה — מה שהיא באמת שווה." },
];

/** How much scrolling the thirty seconds are worth.
 *
 *  Stated in pixels rather than viewport heights on purpose: a runway
 *  measured in vh recomputes when a phone's address bar collapses or when
 *  data loads below, and the film jumps mid-scroll. 3600px is roughly
 *  four unhurried wheel throws — enough that the descent has weight,
 *  short enough that nobody feels trapped. */
const RUNWAY = 3600;

export function EntranceFilm({
  status,
  detail,
}: {
  /** What the tape is doing right now — "שוק פתוח", "מסחר מוקדם". It sits
   *  in the corner of the film rather than in a heading above it, because
   *  the heading it used to sit in was the thing this replaced, and a live
   *  status is the one piece of the old opening worth keeping: it is the
   *  only sentence on the screen that is different every time. */
  status: string;
  detail: string | null;
}) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [sound, setSound] = useState(false);
  /** Set the first time the film actually moves. The word "גלול" is an
   *  instruction, and an instruction that stays on screen after it has
   *  been followed is clutter. */
  const [started, setStarted] = useState(false);

  /* Decode the first frames before the scroll can ask for them. iOS will
     not seek a video it has never played, so it is played muted for a
     tick and immediately paused — after which `currentTime` is writable. */
  useEffect(() => {
    const node = video.current;
    if (!node) return;

    const arm = () => {
      node
        .play()
        .then(() => {
          node.pause();
          node.currentTime = 0;
          setReady(true);
        })
        .catch(() => setReady(true));
    };

    if (node.readyState >= 2) arm();
    else node.addEventListener("loadeddata", arm, { once: true });
    return () => node.removeEventListener("loadeddata", arm);
  }, []);

  /* Pull the film up under the header so it is the whole screen rather
     than the screen minus a navigation bar.
     *
     * The offset is measured rather than written down. The header is two
     * rows — the primary bar and the context row beneath it — and the
     * second row's height depends on which page it is describing, so any
     * figure hard-coded here is wrong on some route the day somebody adds
     * a link. Measuring once, before the margin is applied, costs one
     * layout read on mount and is correct by construction.
     *
     * The header is `position: sticky` over a ground tinted to 82%, so it
     * reads as a scrim across the top of the film rather than as a bar
     * sitting on a picture — which is the only reason this is allowed to
     * overlap it at all. */
  useEffect(() => {
    const node = root.current;
    if (!node) return;
    const offset = node.getBoundingClientRect().top + window.scrollY;
    if (offset > 0) node.style.setProperty("--film-offset", `${offset}px`);
  }, []);

  useEffect(() => {
    const node = root.current;
    const film = video.current;
    if (!node || !film) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    media.add(
      "(min-width: 1000px) and (min-height: 700px) and (prefers-reduced-motion: no-preference)",
      () => {
        /* A timeline with a scrollTrigger, inside a gsap.context — the
           same shape the project's other pinned scene uses, and not an
           aesthetic choice. A bare `ScrollTrigger.create({pin, scrub})`
           built the pin spacing here and then never fired `onUpdate`: the
           section grew by its runway and the stage scrolled straight past
           it. Driving an actual tween is what gives ScrollTrigger
           something to scrub. */
        const context = gsap.context(() => {
          /* The playhead is tweened as a plain number and written to the
             video on each tick. GSAP's own `scrub` is the smoothing — it
             eases the value toward the scroll position over 0.8s rather
             than snapping to it, which is the difference between a camera
             with mass and a slideshow being flicked. */
          const playhead = { t: 0 };
          let last = -1;

          gsap
            .timeline({
              scrollTrigger: {
                trigger: node,
                pin: node.querySelector<HTMLElement>(".film-stage"),
                start: "top top",
                /* A function, so a refresh after the data below finishes
                   loading recomputes it rather than holding a stale
                   pixel figure. */
                end: () => "+=" + RUNWAY,
                scrub: 0.8,
                invalidateOnRefresh: true,
                anticipatePin: 1,
              },
            })
            .to(playhead, {
              /* Stop a hair short of the end: a video parked exactly on
                 its duration reports `ended` in some browsers and blanks
                 the last frame — the one frame of this film that has to
                 survive, because the page continues out of it. */
              t: () => Math.max(0, (film.duration || 30) - 0.05),
              ease: "none",
              onUpdate: () => {
                if (!Number.isFinite(film.duration)) return;
                /* Below a frame's worth of difference there is nothing
                   new to show, and writing `currentTime` anyway makes the
                   decoder work for an identical picture. */
                if (Math.abs(playhead.t - last) > 1 / 48) {
                  film.currentTime = playhead.t;
                  last = playhead.t;
                }
                if (playhead.t > 0.4) setStarted(true);
                const line = CAPTIONS.find(
                  (c) => playhead.t >= c.at && playhead.t < c.until,
                );
                setCaption((current) =>
                  current === (line?.text ?? null)
                    ? current
                    : (line?.text ?? null),
                );
              },
            });
        }, node);

        return () => context.revert();
      },
    );

    return () => media.revert();
  }, []);

  return (
    <section ref={root} className="film" aria-label="הפתיח">
      <div className="film-stage">
        <video
          ref={video}
          className="film-frame"
          poster="/scene/entrance-first.webp"
          preload="auto"
          muted
          playsInline
          /* Not `loop`, not `autoPlay`: the playhead belongs to the
             scroll. On a phone, where there is no pin, the CSS below
             hands the reader the poster instead. */
          aria-hidden="true"
        >
          {/* One source, gated by the same width the pin is gated by. A
              phone never scrubs this — the CSS below replaces the element
              with its opening frame — so offering it a fallback file only
              buys a download nobody watches. With no matching source the
              element stays empty and costs nothing. */}
          <source
            src="/scene/entrance.mp4"
            type="video/mp4"
            media="(min-width: 1000px)"
          />
        </video>

        {/* The edges of the frame dissolved into the page's own ground, so
            the film has no border and the letterbox above and below a
            2.33:1 frame on a 16:9 screen is not a letterbox at all. */}
        <div className="film-veil" aria-hidden="true" />

        <p className="film-caption" data-shown={caption ? "true" : "false"}>
          {caption}
        </p>

        <button
          type="button"
          className="film-sound"
          onClick={() => setSound(true)}
        >
          לצפות עם סאונד
        </button>

        <span
          className="film-hint"
          data-shown={ready && !started ? "true" : "false"}
        >
          גלול
        </span>

        <div className="film-status">
          <span dir="ltr">MARKET / FINANCIAL INTELLIGENCE</span>
          <strong>{status}</strong>
          {detail && <small>{detail}</small>}
        </div>
      </div>

      {/* The sound is a separate viewing rather than a toggle on the
          scrubbed film: a soundtrack attached to a playhead the reader is
          dragging is noise, and no browser will start it unmuted without
          a click anyway. This is that click. */}
      {sound && (
        <div
          className="film-theatre"
          role="dialog"
          aria-modal="true"
          aria-label="הפתיח עם סאונד"
          onClick={() => setSound(false)}
        >
          <video
            src="/scene/entrance-sound.mp4"
            controls
            autoPlay
            playsInline
            onClick={(event) => event.stopPropagation()}
          />
          <button type="button" onClick={() => setSound(false)}>
            סגירה
          </button>
        </div>
      )}
    </section>
  );
}
