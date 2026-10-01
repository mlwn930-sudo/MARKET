/**
 * The money the bird is sitting on.
 *
 * Stylised notes, deliberately. Real banknotes are not a free image —
 * most central banks restrict reproducing their currency, and the US
 * Treasury has its own rules about size and colour for images of dollars.
 * None of that applies to a green rectangle with a mark on it, which is
 * also the version that reads at a glance. A photograph of real hundreds
 * would be both a legal question and a worse illustration.
 *
 * Built as one wide field rather than as scattered elements so the whole
 * pile can be placed, scaled and faded as a single thing, and so the note
 * positions are fixed rather than random — a layout that reshuffles on
 * every render looks broken on the second visit.
 */

type Note = { x: number; y: number; rotate: number; tone: string; width: number };

/* Hand-placed, back to front. The pile reads because the notes behind are
   darker and smaller, not because there are many of them. */
const NOTES: Note[] = [
  { x: 96, y: 196, rotate: -14, tone: "#2F5B3C", width: 118 },
  { x: 300, y: 190, rotate: 11, tone: "#2F5B3C", width: 112 },
  { x: 36, y: 214, rotate: 6, tone: "#3A6B47", width: 128 },
  { x: 356, y: 212, rotate: -8, tone: "#3A6B47", width: 124 },
  { x: 128, y: 224, rotate: 4, tone: "#447C52", width: 142 },
  { x: 268, y: 228, rotate: -6, tone: "#447C52", width: 138 },
  { x: 186, y: 240, rotate: -2, tone: "#4E8C5C", width: 152 },
];

const COINS: { x: number; y: number; r: number }[] = [
  { x: 72, y: 268, r: 13 },
  { x: 104, y: 276, r: 10 },
  { x: 392, y: 266, r: 12 },
  { x: 360, y: 277, r: 9 },
  { x: 232, y: 282, r: 11 },
];

export function MoneyField({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 480 300"
      className={className}
      role="presentation"
      aria-hidden="true"
      focusable="false"
    >
      {NOTES.map((note) => {
        const height = note.width * 0.42;
        return (
          <g
            key={`${note.x}-${note.y}`}
            transform={`rotate(${note.rotate} ${note.x + note.width / 2} ${note.y + height / 2})`}
          >
            <rect
              x={note.x}
              y={note.y}
              width={note.width}
              height={height}
              rx="4"
              fill={note.tone}
            />
            {/* The band and the mark, which is all a note needs to be one. */}
            <rect
              x={note.x + 7}
              y={note.y + 6}
              width={note.width - 14}
              height={height - 12}
              rx="2.5"
              fill="none"
              stroke="#7FB48C"
              strokeWidth="1.2"
              opacity="0.55"
            />
            <text
              x={note.x + note.width / 2}
              y={note.y + height / 2 + 6}
              textAnchor="middle"
              fontFamily="var(--font-mono), ui-monospace, monospace"
              fontSize={height * 0.42}
              fontWeight="700"
              fill="#9FD0AC"
              opacity="0.75"
            >
              $
            </text>
          </g>
        );
      })}

      {COINS.map((coin) => (
        <g key={`${coin.x}-${coin.y}`}>
          <circle cx={coin.x} cy={coin.y} r={coin.r} fill="#C89B33" />
          <circle cx={coin.x} cy={coin.y - 1.5} r={coin.r * 0.78} fill="#E3B84E" />
        </g>
      ))}
    </svg>
  );
}
