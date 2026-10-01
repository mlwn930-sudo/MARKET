"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/**
 * Sections arrive as you reach them.
 *
 * One observer for the whole site rather than a prop on every page: the
 * pages are written from the same handful of primitives, so `section` is
 * already the unit a reader perceives as "the next thing". A section rises
 * and fades in, and its immediate children follow in a short cascade — the
 * words and the numbers land a beat after the panel they sit in.
 *
 * Three things this deliberately is not:
 *
 * `animation-timeline: view()` was tried on this site and removed. A
 * section taller than the viewport never completes its own entry range, so
 * it sticks on its opening frame and the numbers inside it simply never
 * appear. This drives the state from one threshold crossing instead, so a
 * section's height cannot strand it.
 *
 * It does not hide anything until it is running. The CSS that hides an
 * unrevealed section is behind a class this component puts on <html> at
 * mount, so a visitor whose JavaScript never arrives gets a plain page
 * rather than an empty one.
 *
 * And it does not animate what is already on screen. A page that fades
 * itself in after it has painted reads as a page that loaded twice.
 *
 * It also cleans up after itself on every navigation, which is not
 * housekeeping — it is correctness. These marks are attributes on elements
 * React owns, and React compares the DOM it is given against what it just
 * rendered. On a client-side navigation it reuses the nodes from the page
 * before, finds a data-revealed it never produced, and reports a hydration
 * mismatch it will not repair. Clearing the marks before re-arming means
 * React is always handed the markup it expects.
 */

/** Anything pinned, or inside something pinned. A transform on an ancestor
 *  re-parents fixed positioning, which is exactly how a pinned scroll scene
 *  comes apart. The launch story owns its own choreography; it is left to
 *  it. */
const SKIP = ".story-track, .gta-cover, .take-two-story, [data-no-reveal]";

const MARKS = ["revealed", "revealedOnLoad", "revealSkip"] as const;

export function ScrollReveal() {
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const root = document.documentElement;
    root.classList.add("reveal-armed");

    /* Whatever the previous page left behind. Also the reason this effect
       re-runs per route: a soft navigation swaps the sections without
       remounting this, so without it the new page is never armed at all. */
    for (const element of document.querySelectorAll<HTMLElement>("main section")) {
      for (const mark of MARKS) delete element.dataset[mark];
    }

    const known = new WeakSet<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          (entry.target as HTMLElement).dataset.revealed = "true";
          observer.unobserve(entry.target);
        }
      },
      /* A little past the bottom edge, so a section has started to rise by
         the time it is properly in the reading area rather than arriving
         late behind the fold. */
      { rootMargin: "0px 0px -6% 0px", threshold: 0.06 },
    );

    let queued = 0;
    /* The safety net. An observer only fires for an element that actually
       crosses the viewport, and a section can fail to do that for reasons
       that have nothing to do with the reader: a tab that was never
       brought to the front, a panel revealed inside a container that does
       not scroll, a browser that throttles a background page to a
       standstill. Hidden content that waits for an event that never comes
       is worse than no animation at all, so anything still hidden after
       this is shown regardless. */
    const rescue = window.setTimeout(() => {
      for (const element of document.querySelectorAll<HTMLElement>("main section")) {
        if (element.dataset.revealSkip) continue;
        if (!element.dataset.revealed) element.dataset.revealed = "true";
      }
    }, 4000);

    const arm = () => {
      for (const element of document.querySelectorAll<HTMLElement>("main section")) {
        if (known.has(element)) continue;
        known.add(element);
        if (element.closest(SKIP)) {
          /* Marked, not just skipped. The CSS below hides an unrevealed
             section, and skipping one here used to leave it hidden until
             the rescue timer found it — and, worse, let the cascade run an
             entrance animation over whatever was inside it. */
          element.dataset.revealSkip = "true";
          continue;
        }
        if (element.getBoundingClientRect().top < window.innerHeight) {
          element.dataset.revealed = "true";
          element.dataset.revealedOnLoad = "true";
          continue;
        }
        observer.observe(element);
      }
      queued = 0;
    };

    arm();

    /* Pages stream in and panels mount after their data resolves, so the
       set of sections is not fixed at mount. Coalesced on a timer rather
       than a frame: a dashboard that re-renders on every tick would
       otherwise re-run the query on every tick, and a frame never arrives
       at all in a page the browser is not drawing. */
    const mutations = new MutationObserver(() => {
      if (queued) return;
      queued = window.setTimeout(arm, 80);
    });
    mutations.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(rescue);
      if (queued) window.clearTimeout(queued);
      mutations.disconnect();
      observer.disconnect();
      root.classList.remove("reveal-armed");
      for (const element of document.querySelectorAll<HTMLElement>("main section")) {
        for (const mark of MARKS) delete element.dataset[mark];
      }
    };
  }, [pathname]);

  return null;
}
