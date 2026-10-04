"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * The photograph drifts; the band does not.
 *
 * Every page on the site opens on the same object — a full-bleed dark band
 * with a photograph sunk into it — and that band was the one fixed thing
 * on a site that is otherwise alive. This gives it depth without giving it
 * anything to read: the picture travels a little slower than the page, so
 * the band reads as a window rather than as a printed panel.
 *
 * WHAT MOVES AND WHAT DOES NOT. Only the photograph. The two washes over
 * it and the headline set on it stay exactly where they are, because the
 * washes are what hold the text at contrast and a gradient that slides
 * under type is a gradient that stops doing its job halfway down.
 *
 * WHY THE IMAGE IS OVERSIZED. A translated element reveals its own edge.
 * The picture is laid out larger than the band in both directions, so the
 * travel happens inside the overflow and the band is never short of
 * photograph at either end.
 *
 * TRANSFORM ONLY. The whole effect is one `translate3d` on one element,
 * written once per frame and only while the band is on screen, so it
 * stays on the compositor and never asks the page to lay out again. There
 * is no scroll handler doing arithmetic on the main thread per event —
 * the rAF loop reads `scrollY` and nothing else.
 *
 * `prefers-reduced-motion` gets the photograph, still. That is the rule in
 * this project and it is the right way round here: the picture is the
 * information, the drift is the decoration.
 */

/** Fraction of the band's travel through the viewport that the picture
 *  lags by. Small on purpose: the effect should be noticed on the second
 *  look, not the first. Above about 0.12 it stops reading as depth and
 *  starts reading as the image sliding. */
const LAG = 0.07;

export function HeroParallax({ children }: { children: ReactNode }) {
  const root = useRef<HTMLDivElement>(null);
  const [still, setStill] = useState(true);

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
    if (!node) return;

    /* A scroll listener rather than an observer plus a free-running loop,
     * because parallax only has something to say when the page moves.
     * `FilmBand` runs a frame every frame it is visible and has to — its
     * film advances on its own. This writes one transform derived from
     * scroll position, so a frame scheduled by anything other than a
     * scroll or a resize would compute the number it already wrote.
     *
     * A frame is scheduled by a scroll or a resize and the chain ends
     * there, so a page nobody is touching costs nothing at all. The rect
     * read gives the on-screen test for free, which is why there is no
     * observer: it would be a second mechanism answering a question this
     * one already answers. */
    let frame = 0;
    let last = Number.NaN;

    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    function tick() {
      frame = 0;
      const el = root.current;
      if (!el) return;

      const box = el.getBoundingClientRect();
      /* Off screen: leave the transform where it is. The next scroll that
         brings it back schedules a frame and corrects it before paint. */
      if (box.bottom < 0 || box.top > window.innerHeight) return;

      /* How far the band's centre is from the viewport's, as a signed
         fraction of a screen. Zero when the band is centred, so the
         picture sits where it was composed at the moment a reader is
         actually looking at it. */
      const offset =
        (box.top + box.height / 2 - window.innerHeight / 2) /
        window.innerHeight;
      const y = Math.round(offset * box.height * LAG * 10) / 10;

      /* Writing an identical transform is a wasted style invalidation on
         a page that may already be busy with GSAP. */
      if (y !== last) {
        el.style.transform = `translate3d(0, ${y}px, 0)`;
        last = y;
      }
    }

    /* Once on mount, so a band the reader lands halfway down is already
       in the right place rather than jumping on their first scroll. */
    schedule();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });

    return () => {
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      cancelAnimationFrame(frame);
      node.style.transform = "";
    };
  }, [still]);

  return (
    <div
      ref={root}
      /* Oversized in both directions so the travel never runs out of
         picture, and promoted to its own layer so the transform is a
         composite and not a paint. */
      className="absolute inset-0 [transform:translate3d(0,0,0)] will-change-transform"
      style={{ scale: "1.14" }}
    >
      {children}
    </div>
  );
}
