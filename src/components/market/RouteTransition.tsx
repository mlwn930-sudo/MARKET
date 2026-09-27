"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/** Animate the arriving surface without delaying navigation or remounting data. */
export function RouteTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return <div className="route-surface min-h-[60vh]" data-route={pathname}>
    <div key={pathname} className="route-arrival" aria-hidden="true" />
    {children}
  </div>;
}
