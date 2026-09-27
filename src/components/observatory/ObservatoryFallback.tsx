/**
 * The observatory, drawn.
 *
 * This is what the hero shows before the 3D scene loads, instead of it when
 * WebGL is missing or the device is small, and permanently if Spline fails.
 * It is therefore not a placeholder: it is the guaranteed visual, and the
 * 3D scene is the enhancement layered over it.
 *
 * Drawn as inline SVG rather than shipped as an image for three reasons: it
 * costs no second request and no decode, it stays sharp at every size the
 * hero takes, and it reads the design tokens — so it changes colour with
 * the rest of the site instead of drifting away from it as a baked PNG
 * would.
 *
 * Every coordinate below is computed from one deterministic loop. Nothing
 * random: a server render and a client render must produce byte-identical
 * markup or React replaces the whole tree on hydration.
 */

const R = 210;
const CX = 320;
const CY = 320;

/** The globe's tilt, matching the 3D scene's axial tilt. */
const TILT = (14 * Math.PI) / 180;

/** Longitude of the point facing the viewer. Chosen so the dot field is
 *  densest where the light falls, which is what gives the disc its volume. */
const YAW = (-28 * Math.PI) / 180;

type Dot = { x: number; y: number; r: number; o: number };

/**
 * A graticule of dots on the visible hemisphere.
 *
 * Deliberately a regular grid and not a map: an abstract data globe is
 * honest about being decoration, where an invented coastline would be a
 * geographic claim this component has no business making.
 */
function buildDots(): Dot[] {
  const dots: Dot[] = [];
  for (let lat = -72; lat <= 72; lat += 9) {
    const phi = (lat * Math.PI) / 180;
    /* Fewer dots per ring toward the poles keeps their spacing even on the
       sphere instead of bunching them into a crown. */
    const steps = Math.max(6, Math.round(34 * Math.cos(phi)));
    for (let i = 0; i < steps; i++) {
      const lon = (i / steps) * Math.PI * 2 + YAW;
      const x0 = Math.cos(phi) * Math.sin(lon);
      const y0 = Math.sin(phi);
      const z0 = Math.cos(phi) * Math.cos(lon);

      // Tilt the sphere toward the viewer's right, as the scene does.
      const y1 = y0 * Math.cos(TILT) - x0 * Math.sin(TILT);
      const x1 = y0 * Math.sin(TILT) + x0 * Math.cos(TILT);

      if (z0 <= 0.06) continue; // back hemisphere

      const depth = z0; // 0 at the limb, 1 facing the viewer
      dots.push({
        x: CX + x1 * R,
        y: CY - y1 * R,
        r: Number((0.9 + depth * 1.6).toFixed(2)),
        o: Number((0.18 + depth * 0.5).toFixed(2)),
      });
    }
  }
  return dots;
}

/** The gold measurement bezel: sixty ticks, every fifth one long. */
function buildTicks() {
  const ticks: { x1: number; y1: number; x2: number; y2: number; w: number }[] = [];
  const rx = 296;
  const ry = 104;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * Math.PI * 2;
    const long = i % 5 === 0;
    const inner = long ? 0.9 : 0.945;
    const outer = long ? 1.06 : 1.03;
    ticks.push({
      x1: Number((CX + Math.cos(a) * rx * inner).toFixed(1)),
      y1: Number((CY + Math.sin(a) * ry * inner).toFixed(1)),
      x2: Number((CX + Math.cos(a) * rx * outer).toFixed(1)),
      y2: Number((CY + Math.sin(a) * ry * outer).toFixed(1)),
      w: long ? 1.5 : 1,
    });
  }
  return ticks;
}

const DOTS = buildDots();
const TICKS = buildTicks();

/** Four markers on the visible face, and the arcs between two pairs. */
const NODES = [
  { x: 243, y: 214, r: 4.5, primary: true },
  { x: 341, y: 186, r: 4.5, primary: true },
  { x: 402, y: 286, r: 3.2, primary: false },
  { x: 286, y: 372, r: 3.2, primary: false },
];

export function ObservatoryFallback({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 640 640"
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id="mi-body" cx="38%" cy="30%" r="78%">
          <stop offset="0%" stopColor="#3163B4" />
          <stop offset="55%" stopColor="#1B3568" />
          <stop offset="100%" stopColor="#0E1B35" />
        </radialGradient>
        <radialGradient id="mi-ambient" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#2855F5" stopOpacity="0.20" />
          <stop offset="60%" stopColor="#2855F5" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#2855F5" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="mi-rim" x1="0%" y1="100%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00B8E6" stopOpacity="0.85" />
          <stop offset="50%" stopColor="#3B82F6" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#00B8E6" stopOpacity="0.7" />
        </linearGradient>
      </defs>

      {/* Ambient light behind the object */}
      <circle cx={CX} cy={CY} r={300} fill="url(#mi-ambient)" />

      {/* Orbital system: three ellipses at different inclinations */}
      <g fill="none">
        <ellipse
          cx={CX}
          cy={CY}
          rx={296}
          ry={104}
          stroke="#3B82F6"
          strokeOpacity="0.5"
          strokeWidth="1.4"
          transform={`rotate(-12 ${CX} ${CY})`}
        />
        <ellipse
          cx={CX}
          cy={CY}
          rx={268}
          ry={252}
          stroke="#6757E8"
          strokeOpacity="0.28"
          strokeWidth="1.2"
          transform={`rotate(24 ${CX} ${CY})`}
        />
        <ellipse
          cx={CX}
          cy={CY}
          rx={310}
          ry={168}
          stroke="#43639F"
          strokeOpacity="0.22"
          strokeWidth="1"
          transform={`rotate(58 ${CX} ${CY})`}
        />
      </g>

      {/* The gold bezel — the only warm colour in the composition */}
      <g stroke="#D6A84A" strokeOpacity="0.55" transform={`rotate(-12 ${CX} ${CY})`}>
        {TICKS.map((t, i) => (
          <line
            key={i}
            x1={t.x1}
            y1={t.y1}
            x2={t.x2}
            y2={t.y2}
            strokeWidth={t.w}
          />
        ))}
      </g>

      {/* The body */}
      <circle cx={CX} cy={CY} r={R} fill="url(#mi-body)" />
      <circle
        cx={CX}
        cy={CY}
        r={R}
        fill="none"
        stroke="url(#mi-rim)"
        strokeWidth="2.5"
      />

      {/* The dot field */}
      <g fill="#BBD7FF">
        {DOTS.map((d, i) => (
          <circle key={i} cx={d.x.toFixed(1)} cy={d.y.toFixed(1)} r={d.r} opacity={d.o} />
        ))}
      </g>

      {/* Two connection arcs */}
      <g fill="none" stroke="#7FB4FF" strokeOpacity="0.75" strokeWidth="1.4">
        <path d="M243 214 Q 296 150 341 186" />
        <path d="M341 186 Q 400 214 402 286" />
      </g>

      {/* Market nodes */}
      <g>
        {NODES.map((n, i) => (
          <g key={i}>
            {n.primary && (
              <circle
                cx={n.x}
                cy={n.y}
                r={13}
                fill="none"
                stroke="#7FE0FF"
                strokeOpacity="0.5"
                strokeWidth="1.1"
              />
            )}
            <circle cx={n.x} cy={n.y} r={n.r} fill="#EAF9FF" />
          </g>
        ))}
      </g>
    </svg>
  );
}
