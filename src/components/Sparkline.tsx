/**
 * A price line, small enough to sit inside a table row.
 *
 * Deliberately stripped: no axes, no grid, no labels, no tooltip. The
 * question it answers is "which way, and how smoothly" — a reader who
 * wants a value opens the chart. Adding a single label here would double
 * the ink for information the row already carries in its own columns.
 *
 * Drawn in a fixed 100×32 box and stretched by the SVG, so it does not
 * need to know how wide it will be rendered. `vector-effect` keeps the
 * stroke one pixel however far it is stretched — without it, a line in a
 * wide column renders thicker than the same line in a narrow one.
 */
export function Sparkline({
  points,
  direction,
  className = "",
  /** Fills under the line. Off inside a dense row, on in a card. */
  area = false,
}: {
  points: number[];
  direction: "up" | "down" | "flat";
  className?: string;
  area?: boolean;
}) {
  if (points.length < 2) {
    return (
      <div className={className} aria-hidden="true">
        <div className="h-px w-full bg-line" />
      </div>
    );
  }

  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = 100 / (points.length - 1);

  const line = points
    .map((value, i) => {
      const x = i * step;
      const y = 30 - ((value - min) / span) * 28;
      return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(" ");

  const colour =
    direction === "up"
      ? "var(--color-up)"
      : direction === "down"
        ? "var(--color-down)"
        : "var(--color-ink-faint)";

  // Gradient ids have to be unique per direction, or two sparklines on one
  // page share a definition and the second renders with the first's colour.
  const gradientId = `spark-${direction}`;

  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={className}
      aria-hidden="true"
    >
      {area && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={colour} stopOpacity="0.22" />
              <stop offset="100%" stopColor={colour} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L 100 32 L 0 32 Z`} fill={`url(#${gradientId})`} />
        </>
      )}
      <path
        d={line}
        fill="none"
        stroke={colour}
        strokeWidth="1.25"
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
