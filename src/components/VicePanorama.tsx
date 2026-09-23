/**
 * Original hero artwork for the Take-Two launch page.
 *
 * A Miami skyline at sunset, drawn from primitives: sun, towers, causeway,
 * water and palms. It evokes the aesthetic the page is about without
 * reproducing anyone's marketing art, which is copyrighted and not ours to
 * publish — and which, being a photograph of someone else's work, would say
 * less about this site than something built for it.
 *
 * Deliberately not a photograph: this is the one panel on the site where
 * gradients are allowed, because it carries mood rather than data.
 *
 * Built as five separately positioned layers so they can move at different
 * rates as the page scrolls. Scroll-linked motion is used here and nowhere
 * else on the site, for one reason: these layers are artwork. The same
 * technique applied to a panel of figures can leave the figures invisible
 * when the panel is taller than the viewport, which is why the analysis
 * sections use time-based entrances instead.
 *
 * Every animation here moves or dims; none of them hides. A browser with no
 * support for scroll timelines shows the same scene, still.
 */

const PINK = "#ff2e88";
const ORANGE = "#ff9f1c";
const PURPLE = "#8b5cf6";
const CYAN = "#22d3ee";
const DEEP = "#1a0b2e";
const INK = "#0b0d10";

/** Deterministic pseudo-random so the skyline is identical on every render
 *  — a hero that reshuffles between server and client would flicker. */
function pseudoRandom(seed: number): number {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
}

type Building = {
  x: number;
  width: number;
  height: number;
  windows: { x: number; y: number }[];
  /** A few towers carry a lit crown, which is what makes a skyline read as
   *  a skyline rather than as a bar chart. */
  crown: boolean;
};

function skyline(
  count: number,
  seedOffset: number,
  baseline: number,
  scale = 1,
): Building[] {
  const buildings: Building[] = [];
  let x = -20;

  for (let i = 0; i < count; i++) {
    const width = (24 + pseudoRandom(i + seedOffset) * 36) * scale;
    // A low silhouette. The skyline is the frame here, not the subject: a
    // tall dense one hides the sun, and the sun is the entire image.
    const height = (40 + pseudoRandom(i * 3 + seedOffset) * 92) * scale;

    const windows: { x: number; y: number }[] = [];
    const cols = Math.max(1, Math.floor(width / 11));
    const rows = Math.max(1, Math.floor(height / 16));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Only some windows are lit, so the towers read as inhabited.
        if (pseudoRandom(i * 97 + c * 13 + r * 7 + seedOffset) > 0.62) {
          windows.push({
            x: x + 5 + c * 11,
            y: baseline - height + 9 + r * 16,
          });
        }
      }
    }

    buildings.push({
      x,
      width,
      height,
      windows,
      crown: height > 85 && pseudoRandom(i * 41 + seedOffset) > 0.5,
    });
    x += width + 4 + pseudoRandom(i * 5 + seedOffset) * 10;
  }

  return buildings;
}

const HORIZON = 262;

function Sky() {
  // Stars thin out toward the horizon, which is what sells the gradient as
  // a sky rather than as a colour ramp.
  const stars = Array.from({ length: 70 }, (_, i) => ({
    x: pseudoRandom(i * 7.7) * 900,
    y: pseudoRandom(i * 3.1) * 130,
    r: 0.5 + pseudoRandom(i * 11.3) * 0.9,
    o: 0.15 + pseudoRandom(i * 5.9) * 0.5,
  }));

  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#140a26" />
          <stop offset="22%" stopColor={PURPLE} />
          <stop offset="52%" stopColor={PINK} />
          <stop offset="80%" stopColor={ORANGE} />
          <stop offset="100%" stopColor="#ffd28a" />
        </linearGradient>

        {/* The halo. Ends in the sky's own pink so the glow dissolves
            instead of stopping at a visible ring. */}
        <radialGradient id="vp-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#ffdf9b" stopOpacity="0.95" />
          <stop offset="45%" stopColor={ORANGE} stopOpacity="0.55" />
          <stop offset="100%" stopColor={PINK} stopOpacity="0" />
        </radialGradient>

        {/* The disc itself, which needs a defined edge. Without one the sun
            reads as a bright patch of sky rather than as an object. */}
        <linearGradient id="vp-disc" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#fff6d8" />
          <stop offset="45%" stopColor="#ffd166" />
          <stop offset="100%" stopColor={ORANGE} />
        </linearGradient>

        <clipPath id="vp-sun-clip">
          <rect x="0" y="0" width="900" height={HORIZON} />
        </clipPath>
      </defs>

      <rect width="900" height={HORIZON} fill="url(#vp-sky)" />

      <g>
        {stars.map((star, i) => (
          <circle
            key={i}
            cx={star.x}
            cy={star.y}
            r={star.r}
            fill="#ffffff"
            opacity={star.o}
          />
        ))}
      </g>

      {/* The sun sits high enough that a clear arc of it stands above the
          tallest tower. Tucked behind the skyline it reads as a gradient
          rather than as a sun, which loses the one element the whole scene
          is built around. */}
      <g clipPath="url(#vp-sun-clip)">
        <g className="vice-sun">
          <circle cx="648" cy="176" r="150" fill="url(#vp-sun)" />
          <circle cx="648" cy="176" r="84" fill="url(#vp-disc)" />
        </g>

        {/* The banded sun is the signature of the era this borrows from.
            The bands sit only across the disc — carried into the halo they
            look like scanlines on the sky. */}
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <rect
            key={i}
            x="564"
            y={162 + i * 16}
            width="168"
            height={3 + i * 1.4}
            fill={DEEP}
            opacity={0.3 + i * 0.09}
          />
        ))}
      </g>
    </svg>
  );
}

function FarSkyline() {
  const towers = skyline(24, 57, HORIZON + 10, 0.78);

  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g opacity="0.42">
        {towers.map((building, i) => (
          <rect
            key={i}
            x={building.x * 1.08 + 30}
            y={HORIZON + 10 - building.height}
            width={building.width}
            height={building.height}
            fill={DEEP}
          />
        ))}
      </g>
    </svg>
  );
}

function NearSkyline() {
  const towers = skyline(26, 1, HORIZON);

  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g>
        {towers.map((building, i) => (
          <g key={i}>
            <rect
              x={building.x}
              y={HORIZON - building.height}
              width={building.width}
              height={building.height + 2}
              fill={INK}
              opacity="0.93"
            />

            {building.crown && (
              <rect
                x={building.x + building.width / 2 - 1}
                y={HORIZON - building.height - 14}
                width="2"
                height="14"
                fill={CYAN}
                opacity="0.55"
              />
            )}

            <g className={i % 3 === 0 ? "vice-windows" : undefined}>
              {building.windows.map((w, j) => (
                <rect
                  key={j}
                  x={w.x}
                  y={w.y}
                  width="4"
                  height="6"
                  fill={j % 9 === 0 ? CYAN : ORANGE}
                  opacity={0.32 + pseudoRandom(i * 11 + j) * 0.48}
                />
              ))}
            </g>
          </g>
        ))}
      </g>
    </svg>
  );
}

function Water() {
  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vp-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.52" />
          <stop offset="50%" stopColor={PINK} stopOpacity="0.24" />
          <stop offset="100%" stopColor={DEEP} stopOpacity="0.92" />
        </linearGradient>
      </defs>

      <rect x="0" y={HORIZON} width="900" height={340 - HORIZON} fill="url(#vp-water)" />

      {/* The causeway: a thin lit road across the bay, which is what gives
          the scene a middle distance. */}
      <rect x="0" y={HORIZON + 8} width="900" height="2" fill={INK} opacity="0.7" />
      {Array.from({ length: 30 }, (_, i) => (
        <circle
          key={i}
          cx={12 + i * 31}
          cy={HORIZON + 7}
          r="1.1"
          fill={ORANGE}
          opacity="0.75"
        />
      ))}

      {/* The sun's column, broken into ripples. */}
      <g className="vice-ripples">
        {Array.from({ length: 9 }, (_, i) => (
          <rect
            key={i}
            x={606 - i * 6}
            y={HORIZON + 8 + i * 8}
            width={76 + i * 13}
            height="3"
            rx="1.5"
            fill={ORANGE}
            opacity={0.46 - i * 0.042}
          />
        ))}
      </g>
    </svg>
  );
}

function Palms() {
  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <g fill={INK}>
        <g className="vice-palm-near">
          <rect x="86" y="150" width="7" height="190" />
          <path d="M90 152 C 58 126, 30 128, 16 144 C 42 136, 68 141, 90 158 Z" />
          <path d="M90 152 C 122 126, 150 128, 164 144 C 138 136, 112 141, 90 158 Z" />
          <path d="M90 152 C 74 120, 80 100, 96 90 C 88 108, 88 130, 92 156 Z" />
          <path d="M90 152 C 52 148, 30 160, 22 178 C 44 162, 68 156, 90 158 Z" />
          <circle cx="90" cy="153" r="7" />
        </g>

        <g className="vice-palm-far">
          <rect x="812" y="186" width="5" height="154" />
          <path d="M815 188 C 792 168, 770 170, 758 182 C 778 175, 798 179, 815 193 Z" />
          <path d="M815 188 C 838 168, 860 170, 872 182 C 852 175, 832 179, 815 193 Z" />
          <path d="M815 188 C 806 166, 810 152, 822 145 C 815 158, 814 174, 817 191 Z" />
          <circle cx="814" cy="189" r="5" />
        </g>
      </g>
    </svg>
  );
}

/**
 * The scene, as layers the page can move independently.
 *
 * Rendered inside a `.vice-hero`, which owns the parallax rules — see
 * globals.css. The layer order here is the depth order: sky furthest,
 * palms nearest.
 */
export function VicePanorama() {
  return (
    <>
      <div className="vice-layer vice-layer-sky">
        <Sky />
      </div>
      <div className="vice-layer vice-layer-far">
        <FarSkyline />
      </div>
      <div className="vice-layer vice-layer-near">
        <NearSkyline />
      </div>
      <div className="vice-layer vice-layer-water">
        <Water />
      </div>
      <div className="vice-layer vice-layer-palms">
        <Palms />
      </div>

      {/* Darkens toward the bottom so the text below the artwork keeps its
          contrast ratio whatever the scene is doing behind it. */}
      <div className="vice-fade" aria-hidden="true" />
    </>
  );
}
