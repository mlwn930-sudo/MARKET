import type { ReactNode } from "react";

/** Reveal the actual figure; never interpolate fabricated prices. */
export function MetricReveal({value}:{value:string}) {
  return <span className="metric-window"><span key={value} className="metric-reveal">{value}</span></span>;
}

/** Normalized SVG path length keeps timing independent of the number of data points. */
export function ChartReveal({path,identity}:{path:string;identity:string}) {
  return <path key={identity} className="signal-line" pathLength={1} d={path} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>;
}

export function KineticHeading({children}:{children:ReactNode}) {
  return <span className="kinetic-window"><span className="kinetic-line">{children}</span></span>;
}
