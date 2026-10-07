"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import { directionClass } from "@/lib/format";

/**
 * The opening.
 *
 * The site's argument is that a figure on its own is a datum and a figure
 * in context is knowledge. The opening does not illustrate that with
 * decoration — it performs it with the real number: one live index price
 * at the size of the screen, then the camera pulls back until that same
 * number is one entry on a tape, and the board it belongs to is underneath.
 *
 * ONE object, continuous. The figure never cross-fades into a different
 * element; it is the same node, the same mono face, moving and shrinking.
 * That continuity is the whole effect, and it is why this is a scrubbed
 * timeline rather than a sequence of fades.
 *
 * WHAT IT WILL NOT DO. It does not intercept the wheel, it does not hold
 * the reader anywhere they cannot leave by scrolling, and it never blocks
 * the data: the number on screen during the entire sequence is the live
 * price, so even the first frame is information.
 *
 * THREE FAILURES THIS PROJECT ALREADY PAID FOR, avoided by construction:
 *
 *  - `animation-timeline: view()` is not used. A section taller than the
 *    viewport never completes its own entry range, sticks on its opening
 *    frame, and the figures inside it never appear. Tried twice, removed
 *    twice; this is a scrubbed ScrollTrigger instead.
 *  - Pinning is bounded by matchMedia and only on a screen tall enough to
 *    hold the scene. A pin on a short window is a scroll trap.
 *  - The pin-spacer is excluded from the site's entrance cascade in
 *    globals.css. A transform on it re-parents fixed positioning and
 *    silently breaks the pin — which is exactly how the launch story
 *    became two thousand pixels of nothing.
 */

export function OpeningScene({
  symbol,
  label,
  seed,
}: {
  symbol: string;
  label: string;
  seed: Record<string, LiveQuote>;
}) {
  const root = useRef<HTMLElement>(null);
  const { quotes, flash } = useLiveTicks([symbol], seed);
  const quote = quotes[symbol];

  useEffect(() => {
    const node = root.current;
    if (!node) return;

    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();

    /* Desktop, and only on a window tall enough that a pinned scene is a
       scene rather than a trap. The same gate the project's other scroll
       component uses, for the same reason. */
    media.add(
      "(min-width: 1000px) and (min-height: 820px) and (prefers-reduced-motion: no-preference)",
      () => {
        const timeline = gsap.timeline({
          scrollTrigger: {
            trigger: node,
            start: "top top",
            /* The runway is stated in pixels rather than in viewport
               heights. A percentage runway on a page whose height changes
               as data loads recomputes mid-scroll, and the scene jumps. */
            end: "+=900",
            scrub: 0.6,
            pin: true,
            pinSpacing: true,
            anticipatePin: 1,
          },
        });

        /* The pull-back. The figure shrinks and rises; the backdrop
           recedes slightly faster, which is what reads as distance. Both
           are transforms, so neither costs a layout. */
        timeline
          .to(".opening-figure", { scale: 0.26, y: "-38vh", ease: "none" }, 0)
          .to(".opening-art", { scale: 1.12, opacity: 0.25, ease: "none" }, 0)
          .to(".opening-lede", { opacity: 0, y: -30, ease: "none" }, 0)
          .to(".opening-rule", { scaleX: 1, ease: "none" }, 0.1)
          .to(".opening-handoff", { opacity: 1, y: 0, ease: "none" }, 0.45);
      },
    );

    /* A phone gets its own choreography rather than a scaled-down version
       of the desktop one. No pin — a pinned scene on a short screen is the
       reader fighting the page — just the figure arriving with weight. */
    media.add(
      "(max-width: 999px) and (prefers-reduced-motion: no-preference)",
      () => {
        gsap.from(".opening-figure", {
          scale: 1.18,
          opacity: 0,
          duration: 1.1,
          ease: "power3.out",
        });
        gsap.from(".opening-lede", {
          y: 24,
          opacity: 0,
          duration: 0.9,
          delay: 0.25,
          ease: "power2.out",
        });
      },
    );

    return () => media.revert();
  }, []);

  const price = quote?.price;
  const change = quote?.changePercent;

  return (
    <section ref={root} className="opening" aria-label={`${label} עכשיו`}>
      {/* Generated for this site and owned by it. Everything else this
          project tried to open a page with belonged to somebody else. */}
      <div className="opening-art" aria-hidden="true">
        <Image
          src="/scene/opening.webp"
          alt=""
          fill
          priority
          sizes="100vw"
          style={{ objectFit: "cover" }}
        />
      </div>
      <div className="opening-veil" aria-hidden="true" />

      <div className="opening-stage">
        <span className="opening-eyebrow">{label}</span>

        {/* The one node that survives the whole sequence. */}
        <div
          className={`opening-figure num ${
            flash[symbol] === "up"
              ? "settle-up"
              : flash[symbol] === "down"
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
          {change != null && (
            <span className={`opening-change num ${directionClass(change)}`}>
              {change > 0 ? "+" : ""}
              {change.toFixed(2)}%
            </span>
          )}
        </div>

        <p className="opening-lede">
          זה מספר. הוא לא אומר אם החברה שווה את זה, מי עוד קונה אותה, או מה
          קורה בעולם שישפיע עליה.
        </p>

        <i className="opening-rule" aria-hidden="true" />

        <p className="opening-handoff">
          שלוש השאלות האלה הן כל מה שיש כאן למטה.
        </p>
      </div>
    </section>
  );
}
