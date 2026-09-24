/**
 * A dial, in the manner of a mechanical instrument.
 *
 * A progress bar answers "how full"; these metrics ask "where does this sit
 * against the range where it stops being fine". A swept dial with a marked
 * band answers that at a glance, which a bar cannot: on a bar, "18%" and a
 * threshold of 12% are two lengths a reader has to compare, and on a dial
 * the needle is either past the mark or it is not.
 *
 * Rendered as SVG on the server with no client JavaScript. The needle sweeps
 * in from zero on load through a CSS animation, the tooltip is a CSS hover
 * state, and neither needs a hydrated component — which keeps a page that
 * carries six of these from shipping six widgets' worth of script.
 *
 * The practical reading is required, not optional. A dial showing "42" and a
 * dial showing "42 — every dollar invested returns more than it costs" are
 * different products, and the second one is this project's whole point.
 */

const SWEEP = 250; // degrees of travel, centred at the top
const START = 180 + (180 - SWEEP) / 2;
const RADIUS = 52;
const CENTRE = 64;

type Band = {
  /** Where this band starts and ends, in the gauge's own units. */
  from: number;
  to: number;
  color: string;
};

function polar(angleDegrees: number, radius: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: CENTRE + radius * Math.cos(radians),
    y: CENTRE + radius * Math.sin(radians),
  };
}

function arcPath(fromFraction: number, toFraction: number, radius: number) {
  const a1 = START + SWEEP * fromFraction;
  const a2 = START + SWEEP * toFraction;
  const start = polar(a1, radius);
  const end = polar(a2, radius);
  const large = a2 - a1 > 180 ? 1 : 0;
  return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${large} 1 ${end.x} ${end.y}`;
}

export function Gauge({
  value,
  min,
  max,
  label,
  display,
  bands = [],
  meaning,
  accent = "var(--accent)",
  /** Drawn as a second, thinner needle — the level the value is judged
   *  against, such as WACC beneath ROIC. */
  reference,
  referenceLabel,
}: {
  value: number | null;
  min: number;
  max: number;
  label: string;
  /** The formatted figure in the middle. Formatting stays with the caller,
   *  which owns the unit. */
  display: string;
  bands?: Band[];
  meaning: string;
  accent?: string;
  reference?: number | null;
  referenceLabel?: string;
}) {
  const clamp = (n: number) => Math.min(Math.max((n - min) / (max - min), 0), 1);
  const fraction = value === null ? null : clamp(value);
  const referenceFraction =
    reference === null || reference === undefined ? null : clamp(reference);

  const needleAngle = START + SWEEP * (fraction ?? 0);

  return (
    <div className="surface interactive group relative p-4">
      <div className="flex items-start justify-between gap-2">
        <span className="text-[11px] text-ink-muted">{label}</span>
        <span
          className="num text-[10px] text-ink-faint"
          aria-hidden="true"
          title="טווח הסקאלה"
        >
          {min}–{max}
        </span>
      </div>

      <div className="mt-1 flex items-center justify-center">
        <svg
          viewBox="0 0 128 104"
          className="w-full max-w-[168px]"
          role="img"
          aria-label={`${label}: ${display}. ${meaning}`}
        >
          <defs>
            {/* Brushed metal for the dial face — two stops, because a
                gradient with more than that stops reading as metal and
                starts reading as a gradient. */}
            <linearGradient id={`face-${label}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="rgba(255,255,255,0.08)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.01)" />
            </linearGradient>
            <radialGradient id={`hub-${label}`}>
              <stop offset="0%" stopColor="rgba(255,255,255,0.5)" />
              <stop offset="100%" stopColor="rgba(255,255,255,0.08)" />
            </radialGradient>
          </defs>

          <circle
            cx={CENTRE}
            cy={CENTRE}
            r={RADIUS + 9}
            fill={`url(#face-${label})`}
            stroke="rgba(255,255,255,0.07)"
          />

          {/* The track. */}
          <path
            d={arcPath(0, 1, RADIUS)}
            fill="none"
            stroke="rgba(255,255,255,0.09)"
            strokeWidth="7"
            strokeLinecap="round"
          />

          {/* Meaning bands, drawn under the needle. */}
          {bands.map((band) => (
            <path
              key={`${band.from}-${band.to}`}
              d={arcPath(clamp(band.from), clamp(band.to), RADIUS)}
              fill="none"
              stroke={band.color}
              strokeWidth="7"
              strokeLinecap="butt"
              opacity="0.5"
            />
          ))}

          {/* Minor ticks. Eleven of them: enough to read a position off the
              dial, few enough not to turn the face into a hatch. */}
          {Array.from({ length: 11 }, (_, i) => {
            const at = i / 10;
            const outer = polar(START + SWEEP * at, RADIUS + 5);
            const inner = polar(START + SWEEP * at, RADIUS + (i % 5 === 0 ? -2 : 1));
            return (
              <line
                key={i}
                x1={inner.x}
                y1={inner.y}
                x2={outer.x}
                y2={outer.y}
                stroke="rgba(255,255,255,0.22)"
                strokeWidth={i % 5 === 0 ? 1.4 : 0.7}
              />
            );
          })}

          {/* The reference needle, when the metric is judged against a
              second number rather than against a fixed scale. */}
          {referenceFraction !== null && (
            <line
              x1={CENTRE}
              y1={CENTRE}
              x2={polar(START + SWEEP * referenceFraction, RADIUS - 4).x}
              y2={polar(START + SWEEP * referenceFraction, RADIUS - 4).y}
              stroke="rgba(236,234,229,0.55)"
              strokeWidth="1.5"
              strokeDasharray="3 2"
            />
          )}

          {fraction !== null && (
            <g
              style={{
                transformOrigin: `${CENTRE}px ${CENTRE}px`,
                animation: "gauge-sweep 1.1s cubic-bezier(.22,1,.36,1) both",
                // Consumed by the keyframes below, so each dial sweeps to
                // its own angle from a single shared animation.
                ["--needle" as string]: `${needleAngle - START}deg`,
                ["--needle-start" as string]: `0deg`,
              }}
            >
              <line
                x1={CENTRE}
                y1={CENTRE}
                x2={polar(START, RADIUS - 8).x}
                y2={polar(START, RADIUS - 8).y}
                stroke={accent}
                strokeWidth="2.4"
                strokeLinecap="round"
              />
            </g>
          )}

          <circle cx={CENTRE} cy={CENTRE} r="5" fill={`url(#hub-${label})`} />
          <circle cx={CENTRE} cy={CENTRE} r="2" fill={accent} />

          <text
            x={CENTRE}
            y={CENTRE + 30}
            textAnchor="middle"
            className="num"
            fontSize="15"
            fill="#eceae5"
            fontFamily="var(--font-plex-mono), monospace"
          >
            {display}
          </text>

          {referenceLabel && (
            <text
              x={CENTRE}
              y={CENTRE + 42}
              textAnchor="middle"
              fontSize="8"
              fill="#666d79"
              fontFamily="var(--font-plex-mono), monospace"
            >
              {referenceLabel}
            </text>
          )}
        </svg>
      </div>

      {/* The practical reading. Visible on hover and on keyboard focus, so
          it is reachable without a pointer. */}
      <p className="mt-1 text-center text-[11px] leading-relaxed text-ink-muted">
        {meaning}
      </p>
    </div>
  );
}
