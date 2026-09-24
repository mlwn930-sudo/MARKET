import Link from "next/link";
import { fmtCompact, fmtPercent } from "@/lib/format";

/**
 * The market, as area and colour.
 *
 * Two encodings, each carrying exactly one thing. Area is market cap, so a
 * tile's size says how much of the index the company is; colour is the
 * day's move, which is the one place on this site where green and red are
 * allowed, because they mean price direction and nothing else.
 *
 * Area is proportional to the square root of the market cap rather than to
 * the cap itself. At full proportion NVIDIA and Apple crowd a row down to
 * a strip of slivers, and a map whose small tiles are unreadable has
 * stopped being a map.
 *
 * Colour saturates at ±4%. Beyond that the eye cannot compare shades
 * anyway, and the number is written on the tile for anyone who needs the
 * exact figure — which is why the shade only has to say "a lot" or "a
 * little", never "3.2 versus 3.6".
 */

export type HeatTile = {
  ticker: string;
  name: string | null;
  marketCap: number | null;
  changePercent: number | null;
};

export type HeatSector = {
  key: string;
  label: string;
  tiles: HeatTile[];
};

const SATURATION_AT = 4;

function background(change: number | null): string {
  if (change === null || !Number.isFinite(change) || change === 0) {
    return "rgba(255,255,255,0.04)";
  }
  const intensity = Math.min(Math.abs(change) / SATURATION_AT, 1);
  const weight = 10 + intensity * 46;
  const colour = change > 0 ? "var(--color-up)" : "var(--color-down)";
  return `color-mix(in oklab, ${colour} ${weight.toFixed(0)}%, transparent)`;
}

export function Heatmap({ sectors }: { sectors: HeatSector[] }) {
  return (
    <div className="space-y-6">
      {sectors.map((sector) => (
        <section key={sector.key}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <h3 className="text-[13px] text-ink">{sector.label}</h3>
            <span className="num text-[11px] text-ink-ghost">
              {sector.tiles.length} חברות
            </span>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {sector.tiles.map((tile) => {
              // Square root, floored: a company with no reported cap still
              // gets a readable tile rather than vanishing.
              const weight = Math.sqrt(Math.max(tile.marketCap ?? 0, 1e9)) / 1e5;

              return (
                <Link
                  key={tile.ticker}
                  href={`/company/${tile.ticker}`}
                  title={`${tile.name ?? tile.ticker} · שווי שוק ${tile.marketCap ? `$${fmtCompact(tile.marketCap)}` : "לא זמין"}`}
                  className="group flex min-w-[88px] flex-col justify-between rounded-[3px] border border-line px-2.5 py-2 transition-colors hover:border-line-bright"
                  style={{
                    background: background(tile.changePercent),
                    flexGrow: weight,
                    // The basis is clamped, and the clamp is what keeps the
                    // row readable: at true proportion the largest company
                    // in a sector claims a whole line to itself and the map
                    // turns into a list. Growth still carries the size
                    // difference; the basis only stops it from wrapping.
                    flexBasis: `${Math.min(240, Math.max(88, weight * 14))}px`,
                    minHeight: "66px",
                  }}
                >
                  <span className="num text-[12px] font-medium text-ink">
                    {tile.ticker}
                  </span>
                  <span className="num text-[12px] text-ink">
                    {fmtPercent(tile.changePercent)}
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

/** The key. A map without one is a decoration. */
export function HeatmapLegend() {
  return (
    <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-faint">
      <span className="flex items-center gap-2">
        <span className="flex">
          {[-4, -2, -0.5, 0, 0.5, 2, 4].map((step) => (
            <span
              key={step}
              className="h-3 w-5 border-s border-line first:border-s-0"
              style={{ background: background(step) }}
              aria-hidden="true"
            />
          ))}
        </span>
        <span>מ-4%- ומטה עד 4%+ ומעלה</span>
      </span>
      <span>גודל המשבצת — שווי שוק (בשורש, כדי שהקטנות יישארו קריאות)</span>
    </div>
  );
}
