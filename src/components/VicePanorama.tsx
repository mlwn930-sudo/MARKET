/**
 * Original hero artwork for the Take-Two launch page.
 *
 * A Miami skyline at sunset, drawn here from primitives: sun, skyline,
 * palms, water and a scanline wash. It evokes the aesthetic the page is
 * about without reproducing anyone's marketing art, which is copyrighted
 * and not ours to publish.
 *
 * Deliberately not a photograph: this is the one panel on the site where
 * gradients are allowed, because it carries mood rather than data.
 */

const PINK = "#ff2e88";
const ORANGE = "#ff9f1c";
const PURPLE = "#8b5cf6";
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
};

function skyline(count: number, seedOffset: number): Building[] {
  const buildings: Building[] = [];
  let x = 0;

  for (let i = 0; i < count; i++) {
    const width = 26 + pseudoRandom(i + seedOffset) * 34;
    const height = 60 + pseudoRandom(i * 3 + seedOffset) * 150;

    const windows: { x: number; y: number }[] = [];
    const cols = Math.max(1, Math.floor(width / 11));
    const rows = Math.max(1, Math.floor(height / 16));
    for (let c = 0; c < cols; c++) {
      for (let r = 0; r < rows; r++) {
        // Only some windows are lit, so the towers read as inhabited.
        if (pseudoRandom(i * 97 + c * 13 + r * 7 + seedOffset) > 0.62) {
          windows.push({ x: x + 5 + c * 11, y: 260 - height + 9 + r * 16 });
        }
      }
    }

    buildings.push({ x, width, height, windows });
    x += width + 5 + pseudoRandom(i * 5 + seedOffset) * 9;
  }

  return buildings;
}

export function VicePanorama() {
  const towers = skyline(26, 1);
  const behind = skyline(20, 57);

  return (
    <svg
      viewBox="0 0 900 340"
      className="absolute inset-0 h-full w-full"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="vp-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={PURPLE} />
          <stop offset="45%" stopColor={PINK} />
          <stop offset="78%" stopColor={ORANGE} />
          <stop offset="100%" stopColor="#ffd28a" />
        </linearGradient>

        <radialGradient id="vp-sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0%" stopColor="#fff2c4" />
          <stop offset="55%" stopColor={ORANGE} />
          <stop offset="100%" stopColor={PINK} stopOpacity="0.1" />
        </radialGradient>

        <linearGradient id="vp-water" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={ORANGE} stopOpacity="0.5" />
          <stop offset="55%" stopColor={PINK} stopOpacity="0.22" />
          <stop offset="100%" stopColor={DEEP} stopOpacity="0.9" />
        </linearGradient>

        <linearGradient id="vp-fade" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={INK} stopOpacity="0" />
          <stop offset="70%" stopColor={INK} stopOpacity="0.72" />
          <stop offset="100%" stopColor={INK} stopOpacity="0.95" />
        </linearGradient>

        <clipPath id="vp-sun-clip">
          <rect x="0" y="0" width="900" height="262" />
        </clipPath>
      </defs>

      <rect width="900" height="262" fill="url(#vp-sky)" />

      <g clipPath="url(#vp-sun-clip)">
        <circle cx="648" cy="236" r="128" fill="url(#vp-sun)" />
        {/* The banded sun is the signature of the era this borrows from. */}
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <rect
            key={i}
            x="512"
            y={186 + i * 13}
            width="272"
            height={4 + i * 0.8}
            fill={DEEP}
            opacity={0.18 + i * 0.07}
          />
        ))}
      </g>

      {/* Far skyline, hazier and lower-contrast to sit behind. */}
      <g opacity="0.45">
        {behind.map((building, i) => (
          <rect
            key={`b${i}`}
            x={building.x * 1.1 + 40}
            y={272 - building.height * 0.78}
            width={building.width}
            height={building.height * 0.78}
            fill={DEEP}
          />
        ))}
      </g>

      <g>
        {towers.map((building, i) => (
          <g key={`t${i}`}>
            <rect
              x={building.x}
              y={262 - building.height}
              width={building.width}
              height={building.height + 2}
              fill={INK}
              opacity="0.92"
            />
            {building.windows.map((w, j) => (
              <rect
                key={j}
                x={w.x}
                y={w.y}
                width="4"
                height="6"
                fill={ORANGE}
                opacity={0.35 + pseudoRandom(i * 11 + j) * 0.45}
              />
            ))}
          </g>
        ))}
      </g>

      {/* Water, with the sun's column broken into ripples. */}
      <rect x="0" y="262" width="900" height="78" fill="url(#vp-water)" />
      {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
        <rect
          key={`r${i}`}
          x={608 - i * 5}
          y={268 + i * 9}
          width={80 + i * 11}
          height="3"
          rx="1.5"
          fill={ORANGE}
          opacity={0.45 - i * 0.045}
        />
      ))}

      {/* Palms in the foreground, the closest one largest. */}
      <g fill={INK}>
        <rect x="86" y="150" width="7" height="190" />
        <path d="M90 152 C 58 126, 30 128, 16 144 C 42 136, 68 141, 90 158 Z" />
        <path d="M90 152 C 122 126, 150 128, 164 144 C 138 136, 112 141, 90 158 Z" />
        <path d="M90 152 C 74 120, 80 100, 96 90 C 88 108, 88 130, 92 156 Z" />
        <circle cx="90" cy="153" r="7" />

        <rect x="812" y="186" width="5" height="154" />
        <path d="M815 188 C 792 168, 770 170, 758 182 C 778 175, 798 179, 815 193 Z" />
        <path d="M815 188 C 838 168, 860 170, 872 182 C 852 175, 832 179, 815 193 Z" />
        <circle cx="814" cy="189" r="5" />
      </g>

      <rect x="0" y="0" width="900" height="340" fill="url(#vp-fade)" />
    </svg>
  );
}
