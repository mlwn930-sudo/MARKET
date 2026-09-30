/**
 * The house mark: a dollar sign with depth.
 *
 * Drawn rather than photographed, and drawn rather than traced from a
 * photograph. The reference for this was a stock photograph of banded
 * hundreds, watermarked — putting that on the site would be republishing
 * someone's licensed image. This is built from type and gradients instead,
 * which also means it is a few hundred bytes, scales to any size without
 * softening, and is already in the brand's two colours rather than in a
 * photographer's lighting.
 *
 * The depth is six stacked copies of the glyph, each offset a little
 * further and darker, with the lit face on top. That is how an extrusion
 * actually reads — a bevel filter gives you a shiny letter, a stack gives
 * you a solid object seen slightly from the side.
 *
 * Where it is allowed to appear is a design rule, not a preference. This
 * site puts gradients and glow in the dark opener only; a panel carrying a
 * figure gets a shadow, not light. So the motif lives in dark bands, at an
 * opacity that leaves it as material rather than as an illustration, and
 * it never sits behind a number — a reader should never have to decide
 * whether a shape behind a figure is part of the figure.
 */

const DEPTH = 6;

export function DollarMotif({
  size = 320,
  className,
  opacity = 0.14,
}: {
  size?: number;
  className?: string;
  /** Held low by default. Above about 0.2 it stops being material and
   *  starts being a picture of a dollar sign. */
  opacity?: number;
}) {
  const id = "dollar-motif";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      role="presentation"
      aria-hidden="true"
      focusable="false"
      className={className}
      style={{ opacity }}
    >
      <defs>
        <linearGradient id={`${id}-face`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#5B7FFF" />
          <stop offset="45%" stopColor="#2855F5" />
          <stop offset="100%" stopColor="#00B8E6" />
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#1B3AA8" />
          <stop offset="100%" stopColor="#06506B" />
        </linearGradient>
        {/* The specular pass: a soft diagonal band across the upper left,
            clipped to the glyph, which is what stops the face reading as
            flat fill. */}
        <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0.6" y2="1">
          <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="38%" stopColor="#FFFFFF" stopOpacity="0.08" />
          <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
        </linearGradient>
      </defs>

      <g
        fontFamily="var(--font-mono), ui-monospace, monospace"
        fontSize="148"
        fontWeight="700"
        textAnchor="middle"
        dominantBaseline="central"
      >
        {/* The extrusion, back to front. */}
        {Array.from({ length: DEPTH }, (_, i) => DEPTH - i).map((step) => (
          <text
            key={step}
            x={100 - step * 1.5}
            y={100 + step * 1.5}
            fill={`url(#${id}-edge)`}
          >
            $
          </text>
        ))}

        <text x="100" y="100" fill={`url(#${id}-face)`}>
          $
        </text>
        <text x="100" y="100" fill={`url(#${id}-sheen)`}>
          $
        </text>
      </g>
    </svg>
  );
}
