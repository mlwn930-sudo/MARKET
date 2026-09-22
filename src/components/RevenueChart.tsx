import { fmtCompact } from "@/lib/format";

/**
 * Annual series as bars. Rendered as inline SVG on the server: no client
 * JavaScript, no layout shift, and it reads correctly before hydration.
 *
 * One hue, no gridline clutter, bars capped at 24px — magnitude comparison
 * does not need more than that.
 */
export function RevenueChart({
  series,
  title,
  ariaLabel,
}: {
  series: { end: string; val: number }[];
  title: string;
  ariaLabel: string;
}) {
  if (series.length < 2) return null;

  const width = 640;
  const height = 180;
  const padBottom = 26;
  const padTop = 20;
  const max = Math.max(...series.map((s) => s.val));
  const min = Math.min(0, ...series.map((s) => s.val));
  const span = max - min || 1;
  const plot = height - padBottom - padTop;

  const slot = width / series.length;
  const barWidth = Math.min(24, slot * 0.5);
  const zeroY = padTop + plot * (max / span);

  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <h3 className="mb-1 text-sm text-ink-muted">{title}</h3>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label={ariaLabel}
        className="block"
      >
        <line
          x1="0"
          x2={width}
          y1={zeroY}
          y2={zeroY}
          stroke="rgba(255,255,255,0.16)"
          strokeWidth="1"
        />
        {series.map((point, i) => {
          const barHeight = (Math.abs(point.val) / span) * plot;
          const x = i * slot + (slot - barWidth) / 2;
          const y = point.val >= 0 ? zeroY - barHeight : zeroY;
          return (
            <g key={point.end}>
              <rect
                x={x}
                y={y}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx="3"
                fill="#1baf7a"
                opacity={i === series.length - 1 ? 1 : 0.55}
              />
              <text
                x={x + barWidth / 2}
                y={y - 6}
                textAnchor="middle"
                fill="#8a8f98"
                fontSize="11"
                fontFamily="var(--font-plex-mono), monospace"
                direction="ltr"
              >
                {fmtCompact(point.val)}
              </text>
              <text
                x={x + barWidth / 2}
                y={height - 8}
                textAnchor="middle"
                fill="#5e636b"
                fontSize="11"
                fontFamily="var(--font-plex-mono), monospace"
                direction="ltr"
              >
                {point.end.slice(0, 4)}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}
