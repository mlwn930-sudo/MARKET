"use client";

import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { directionClass } from "@/lib/format";

/**
 * The door.
 *
 * Thirty seconds of film, and the reader's own hand is the clock. The
 * scroll wheel does not move the page past the film — it moves the film.
 *
 * WHY SCRUB RATHER THAN PLAY. A film that plays on its own has a pace the
 * reader cannot argue with, and a reader who arrives mid-sequence has
 * missed something. Scrubbing makes the sequence a place rather than an
 * event: it is always exactly where you left it, and leaving is one flick
 * away.
 *
 * THE PAGE IS NOT A WINDOW ONTO THE FILM, IT IS PART OF IT. A scrub on
 * its own is a slideshow with a slow handle — the footage does all the
 * work and the page does none. Five things happen here instead:
 *
 *  1. THE FRAME OPENS. The first seconds are letterboxed into a narrow
 *     band and the aperture widens to full bleed as the camera descends.
 *     It is a clip-path, so it costs no layout.
 *  2. THE ACTS BREATHE. Scroll maps to film time through a timeline with
 *     one tween per act rather than through a straight multiplication, so
 *     the teardown — the part worth looking at — gets nearly twice the
 *     scroll per second that the opening does. A constant rate is what
 *     made it feel mechanical.
 *  3. THERE IS AN ALTIMETER. A hairline rail down the edge fills as the
 *     camera descends, with a tick at each act boundary. The reader is
 *     holding a thirty-second object and is entitled to know where in it
 *     they are.
 *  4. THE LINES ARRIVE RATHER THAN FADE, through the project's own
 *     `.kinetic-window` mask — the same primitive the scroll scenes use.
 *  5. THE FILM HANDS OVER. It ends on the wordmark, and out of that last
 *     frame the live index price rises. That is the whole argument of the
 *     site in one cut: the sequence is the story, the figure is the point,
 *     and the figure is real.
 *
 * THREE FAILURES THIS PROJECT ALREADY PAID FOR, avoided by construction:
 *
 *  - Every frame in the encode is a keyframe (`-g 1`). Seeking to an
 *    arbitrary time in a normally-encoded file makes the decoder walk back
 *    to the previous keyframe and replay forward, which is the single most
 *    common reason a scrubbed video judders.
 *  - GSAP's own `scrub` is the smoothing. A hand-rolled rAF easing loop
 *    was tried and removed: it duplicated what scrub already does and
 *    fought it for the same playhead.
 *  - The pin is bounded by matchMedia. A pinned full-screen section on a
 *    short window is a scroll trap.
 *
 * WHAT IT WILL NOT DO. It does not intercept the wheel, it does not hold
 * the reader anywhere they cannot leave by scrolling, it carries no
 * autoplaying sound, and it never blocks the data — everything below it
 * renders and is reachable whether or not the film ever loads.
 */

/** The film's four movements, in seconds of footage.
 *
 *  `weight` is the share of the scroll runway each one gets. They are not
 *  proportional to their length on purpose: the third movement is where
 *  the products come apart, and giving it four units for its eleven
 *  seconds while the opening gets two for its eight is the difference
 *  between a sequence that is paced and one that is merely played. */
const ACTS = [
  { at: 0, until: 8.6, name: "העולם מתעורר", weight: 2.2 },
  { at: 8.6, until: 17.2, name: "הירידה", weight: 2.4 },
  { at: 17.2, until: 27.6, name: "ממה עשוי האור", weight: 4.2 },
  { at: 27.6, until: 99, name: "", weight: 1.6 },
] as const;

const TOTAL_WEIGHT = ACTS.reduce((sum, act) => sum + act.weight, 0);

/** Where the film hands the page its first real number. */
const ARRIVAL_AT = 27.9;

/** Three lines across thirty seconds, one per movement, each on screen for
 *  about five of them. The site's whole argument is that a figure alone is
 *  a datum, so the door states it before the first figure appears — and
 *  then stops talking, because the last six seconds are the part that
 *  earns it. */
const CAPTIONS: { at: number; until: number; text: string }[] = [
  { at: 2.4, until: 7.4, text: "כל מחיר הוא מספר." },
  { at: 10.4, until: 15.4, text: "מאחוריו יש חברה." },
  { at: 19, until: 24, text: "ומאחוריה — מה שהיא באמת שווה." },
];

/** How much scrolling the thirty seconds are worth.
 *
 *  Stated in pixels rather than viewport heights on purpose: a runway
 *  measured in vh recomputes when a phone's address bar collapses or when
 *  data loads below, and the film jumps mid-scroll. */
const RUNWAY = 4200;

export function EntranceFilm({
  status,
  detail,
  index,
  seed,
}: {
  /** What the tape is doing right now — "שוק פתוח", "מסחר מוקדם". It sits
   *  in the corner of the film rather than in a heading above it, because
   *  the heading it used to sit in was the thing this replaced, and a live
   *  status is the one piece of the old opening worth keeping: it is the
   *  only sentence on the screen that is different every time. */
  status: string;
  detail: string | null;
  /** The figure the film hands over to.
   *
   * `note` is not optional and it is not decoration. The free tier carries
   * no index symbols, so this is the ETF that tracks the index — and a
   * screen that prints an ETF's price under the index's name is telling
   * the reader the fund IS the benchmark. It is not: one of these trades
   * near 769 and the other near 6,800. The ticker is printed beside the
   * name everywhere else on this site for exactly that reason, and the
   * largest figure on the whole site is the last place to drop it. */
  index: { symbol: string; label: string; note: string };
  seed: Record<string, LiveQuote>;
}) {
  const root = useRef<HTMLElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  const [caption, setCaption] = useState<string | null>(null);
  const [act, setAct] = useState<string>("");
  /** True once the camera has reached the wordmark. */
  const [arrived, setArrived] = useState(false);
  const [sound, setSound] = useState(false);
  /** Set the first time the film actually moves. The word "גלול" is an
   *  instruction, and an instruction that stays on screen after it has
   *  been followed is clutter. */
  const [started, setStarted] = useState(false);

  const { quotes, flash } = useLiveTicks([index.symbol], seed);
  const quote = quotes[index.symbol];

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

  /* How far down the header pushes the film.
   *
   * This used to be a NEGATIVE margin that pulled the film up behind the
   * sticky header, on the theory that a full-bleed opening should be the
   * whole screen. It was wrong: the header is opaque enough to read as a
   * bar, so the top of every frame simply disappeared under it — the
   * camera descended behind a navigation menu.
   *
   * So the film sits below the header instead, and the pin is started at
   * the same offset rather than at zero, which keeps it there for the
   * whole descent instead of jumping under the bar the moment it sticks.
   *
   * The figure is measured rather than written down. The header is two
   * rows — the primary bar and the context row beneath it — and the
   * second row's height depends on which page it is describing, so any
   * number hard-coded here is wrong on some route the day somebody adds
   * a link. */
  const headerOffset = useRef(0);
  useEffect(() => {
    const node = root.current;
    const header = document.querySelector<HTMLElement>(".studio-header");
    if (!node || !header) return;

    /* Observed rather than measured once.
     *
     * A single read on mount is one sample of a number that is not stable
     * yet: web fonts have not swapped, the context row may still be
     * deciding how many links it holds, and a first read can legitimately
     * come back zero — which silently leaves the stage overflowing the
     * viewport by exactly the height of the header, with the bottom row of
     * the film below the fold. Watching the element instead means the
     * layout corrects itself whenever the header settles or the window
     * changes, and a zero simply means "not yet".
     *
     * ScrollTrigger is refreshed on a real change only. Refreshing on
     * every observer callback would recompute every trigger on the page
     * during a window drag. */
    const apply = () => {
      const height = Math.round(header.getBoundingClientRect().height);
      if (height <= 0 || height === headerOffset.current) return;
      headerOffset.current = height;
      node.style.setProperty("--film-offset", `${height}px`);
      ScrollTrigger.refresh();
    };

    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(header);
    return () => observer.disconnect();
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
           built the pin spacing here and then never fired `onUpdate`. */
        const context = gsap.context(() => {
          const playhead = { t: 0 };
          let last = -1;

          /* One write per tick, from one place. Everything the page shows
             is derived from where the playhead is rather than from where
             the scroll is, so the two can never disagree. */
          const render = () => {
            if (!Number.isFinite(film.duration)) return;
            const t = playhead.t;

            /* Below a frame's worth of difference there is nothing new to
               show, and writing `currentTime` anyway makes the decoder
               work for an identical picture. */
            if (Math.abs(t - last) > 1 / 48) {
              film.currentTime = t;
              last = t;
            }

            if (t > 0.4) setStarted(true);

            const line = CAPTIONS.find((c) => t >= c.at && t < c.until);
            setCaption((current) =>
              current === (line?.text ?? null) ? current : (line?.text ?? null),
            );

            const movement = ACTS.find((a) => t >= a.at && t < a.until);
            setAct((current) =>
              current === (movement?.name ?? "") ? current : movement?.name ?? "",
            );

            const landed = t >= ARRIVAL_AT;
            setArrived((current) => (current === landed ? current : landed));
          };

          const timeline = gsap.timeline({
            scrollTrigger: {
              trigger: node,
              pin: node.querySelector<HTMLElement>(".film-stage"),
              /* Pinned BELOW the header, not at the top of the viewport.
                 Pinning at zero slides the frame under an opaque bar for
                 the entire descent. */
              start: () => "top " + headerOffset.current + "px",
              /* A function, so a refresh after the data below finishes
                 loading recomputes it rather than holding a stale pixel
                 figure. */
              end: () => "+=" + RUNWAY,
              scrub: 0.8,
              invalidateOnRefresh: true,
              anticipatePin: 1,
            },
            onUpdate: render,
          });

          /* One tween per movement. The timeline's own duration is in
             arbitrary units and ScrollTrigger stretches the whole thing
             across the runway, so these weights are a share of the scroll
             rather than a number of seconds. */
          ACTS.forEach((movement, position) => {
            timeline.to(playhead, {
              t:
                position === ACTS.length - 1
                  ? () => Math.max(0, (film.duration || 30) - 0.05)
                  : movement.until,
              ease: "none",
              duration: movement.weight,
            });
          });

          /* The aperture. Opens from a narrow band to full bleed over the
             first movement — the screen widening around the reader as the
             camera leaves orbit. A clip-path, so it is a paint and not a
             layout. */
          timeline.fromTo(
            ".film-aperture",
            { clipPath: "inset(15% 0% 15% 0%)" },
            {
              clipPath: "inset(0% 0% 0% 0%)",
              ease: "none",
              duration: ACTS[0].weight,
            },
            0,
          );

          /* The altimeter fills across the whole descent. scaleY rather
             than height, so it never touches layout. */
          timeline.fromTo(
            ".film-rail-fill",
            { scaleY: 0 },
            { scaleY: 1, ease: "none", duration: TOTAL_WEIGHT },
            0,
          );
        }, node);

        return () => context.revert();
      },
    );

    return () => media.revert();
  }, []);

  const price = quote?.price;
  const changePercent = quote?.changePercent;

  return (
    <section ref={root} className="film" aria-label="הפתיח">
      <div className="film-stage">
        <div className="film-aperture">
          <video
            ref={video}
            className="film-frame"
            poster="/scene/entrance-first.webp"
            preload="auto"
            muted
            playsInline
            /* Not `loop`, not `autoPlay`: the playhead belongs to the
               scroll. On a phone, where there is no pin, the CSS hands the
               reader the opening frame instead. */
            aria-hidden="true"
          >
            {/* One source, gated by the same width the pin is gated by. A
                phone never scrubs this, so offering it a fallback file
                only buys a download nobody watches. */}
            <source
              src="/scene/entrance.mp4"
              type="video/mp4"
              media="(min-width: 1000px)"
            />
          </video>
        </div>

        {/* The edges of the frame dissolved into the page's own ground, so
            the film has no border and the letterbox above and below a
            2.33:1 frame on a 16:9 screen is not a letterbox at all. */}
        <div className="film-veil" aria-hidden="true" />

        {/* The altimeter. Four ticks, one per movement, placed by weight
            rather than by footage length — so the mark sits where the
            reader's hand will actually be when the act turns over. */}
        <div className="film-rail" aria-hidden="true">
          <i className="film-rail-fill" />
          {ACTS.slice(1).map((movement, position) => {
            const above = ACTS.slice(0, position + 1).reduce(
              (sum, a) => sum + a.weight,
              0,
            );
            return (
              <i
                key={movement.at}
                className="film-rail-tick"
                style={{ top: `${(above / TOTAL_WEIGHT) * 100}%` }}
              />
            );
          })}
        </div>

        <span className="film-act" data-shown={act ? "true" : "false"}>
          {act}
        </span>

        {/* The project's own mask primitive rather than a fade. A line that
            rises out of a clipped window reads as something arriving; a
            line that fades reads as something being switched on. */}
        <p className="film-caption" data-shown={caption ? "true" : "false"}>
          <span className="kinetic-window">
            <span className="kinetic-line" key={caption ?? "none"}>
              {caption}
            </span>
          </span>
        </p>

        {/* The handover. The film ends on the wordmark and this rises out
            of the same frame — the first real figure on the site, arriving
            exactly where the sequence has been pointing for thirty
            seconds. */}
        <div className="film-arrival" data-shown={arrived ? "true" : "false"}>
          <span>
            {index.label} <i dir="ltr">· {index.note}</i>
          </span>
          <strong
            className={`num ${
              flash[index.symbol] === "up"
                ? "settle-up"
                : flash[index.symbol] === "down"
                  ? "settle-down"
                  : ""
            }`}
            dir="ltr"
          >
            {price != null
              ? price.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })
              : "—"}
          </strong>
          {changePercent != null && (
            <em className={`num ${directionClass(changePercent)}`} dir="ltr">
              {changePercent > 0 ? "+" : ""}
              {changePercent.toFixed(2)}%
            </em>
          )}
        </div>

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

        <button
          type="button"
          className="film-sound"
          onClick={() => setSound(true)}
        >
          לצפות עם סאונד
        </button>
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
