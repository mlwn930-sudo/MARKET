"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

/** Animate the arriving surface without delaying navigation or remounting data. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Existing flagship owns its choreography. All financial routes share this vocabulary.
    if (pathname.startsWith("/launch/")) return;
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      const context = gsap.context(() => {
        gsap.utils.toArray<HTMLElement>(".title, .compact-heading h2").forEach(heading => {
          gsap.fromTo(heading, { x: 18 }, { x: 0, ease: "none", scrollTrigger: { trigger: heading, start: "top 95%", end: "top 65%", scrub: .35 } });
        });
        gsap.utils.toArray<HTMLElement>(".research-picks, .macro-pocket").forEach((panel, index) => {
          gsap.fromTo(panel, { y: 28 + index * 20, rotateX: 3, transformPerspective: 1000 }, { y: 0, rotateX: 0, ease: "none", scrollTrigger: { trigger: panel, start: "top 95%", end: "top 55%", scrub: .5 } });
        });
      }, root);
      return () => context.revert();
    });
    return () => media.revert();
  }, [pathname]);
  return <div ref={root} className="route-surface min-h-[60vh]" data-route={pathname}>
    <div key={pathname} className="route-arrival" aria-hidden="true" />
    {children}
  </div>;
}
