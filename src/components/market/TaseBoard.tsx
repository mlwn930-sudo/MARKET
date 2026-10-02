import Link from "next/link";
import { Sparkline } from "@/components/Sparkline";
import { directionClass, fmtCompact, fmtPercent } from "@/lib/format";
import { rangePosition, type LocalName, type SectorRead } from "@/lib/analysis/tel-aviv";

/**
 * The fourteen names, grouped by sector, each group carrying its figure.
 *
 * What was here before was a list of prices under seven separate section
 * headings — one heading for a group of five banks, one for a group of a
 * single airline — and no figure anywhere describing a group. A reader who
 * wanted to know where the day happened had to average five rows in their
 * head, which is a thing no reader does.
 *
 * So the sector heading became a reading. It carries how many names are in
 * the group, how many of them rose, the group's equal-weight move today
 * with a bar to make the sign scannable, and how many of its companies also
 * file in New York — which on this page is the difference between a row
 * that links to a full analysis and a row that is a price and nothing more.
 *
 * The row itself gained three things, and each one answers a question the
 * old row raised and left open.
 *
 * A month of closes, drawn. "+1.2%" and "+1.2% after three weeks of
 * falling" are different facts, and the second is the one an investor
 * holding for quarters came for.
 *
 * Turnover against its own month. A volume of 1.2M on its own is the
 * figure rule 5 of this project forbids; at 2.4× its own average it is a
 * sentence about whether anyone was actually there today.
 *
 * And the 52-week rail now measures from the same side the figures under it
 * read from. It was positioned with `inset-inline-start`, which on this RTL
 * page starts at the right — while the low–high label beneath it sits in
 * `.num`, is isolated LTR, and therefore reads low on the left. A stock at
 * its yearly low drew its marker hard against the figure for its yearly
 * high. The rail is physical now, and deliberately so: it is a chart, and
 * it has to agree with the axis printed under it.
 */

/** A diverging bar for a group's move. Zero is the middle. */
function MoveBar({ value, scale }: { value: number | null; scale: number }) {
  if (value === null || !Number.isFinite(value) || scale <= 0) return null;

  const width = Math.min(Math.abs(value) / scale, 1) * 50;

  return (
    <span className="tase-bar" aria-hidden="true">
      <i
        data-dir={value >= 0 ? "up" : "down"}
        style={{ width: `${width}%` }}
      />
    </span>
  );
}

function Row({ row }: { row: LocalName }) {
  const position = rangePosition(row.price, row.yearLow, row.yearHigh);

  const ratio =
    row.volume !== null && row.averageVolume !== null && row.averageVolume > 0
      ? row.volume / row.averageVolume
      : null;

  const month = row.windowChangePercent;

  const shekel = (value: number | null) =>
    value === null || !Number.isFinite(value)
      ? "—"
      : `₪${value.toLocaleString("en-US", {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`;

  return (
    <div className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[minmax(0,1.4fr)_auto_96px_auto_124px]">
      <span className="min-w-0">
        <span className="flex flex-wrap items-center gap-2">
          <span className="text-[13px] font-medium text-ink">{row.name}</span>
          {/* The badge that matters most on this page: it is the difference
              between a price and a full analysis. */}
          {row.usTicker ? (
            <Link
              href={`/company/${row.usTicker}`}
              className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
              title={`${row.name} נסחרת גם בניו יורק ומגישה ל-SEC — יש לה ניתוח מלא באתר`}
            >
              {row.usTicker}
            </Link>
          ) : (
            /* Said rather than left as an absence. A reader who sees a
               ticker chip on eight rows and nothing on six concludes the
               data is missing; the real reason is that these six file
               nowhere this site can read, and that is a fact about the
               company, not a gap in the page. */
            <span
              className="badge"
              title="נסחרת רק בתל אביב ואינה מגישה ל-SEC, ולכן אין לה כאן מבחן ליבה, תזה או חציון סקטור"
            >
              מחיר בלבד
            </span>
          )}
        </span>
        <span className="num block text-[11px] text-ink-faint" dir="ltr">
          {row.symbol.replace(".TA", "")} · {row.sector}
        </span>
      </span>

      <span className="text-end">
        <span className="num block text-[14px] text-ink">{shekel(row.price)}</span>
        <span
          className={`num block text-[11px] ${directionClass(row.changePercent)}`}
        >
          {fmtPercent(row.changePercent)}
        </span>
        {/* On a phone the sparkline column is gone, and the month is the
            figure this audience actually holds for — so it comes with the
            price rather than disappearing alongside the drawing of it. */}
        <span className="block text-[10px] text-ink-ghost sm:hidden">
          <span className={`num ${directionClass(month)}`}>
            {fmtPercent(month)}
          </span>{" "}
          בחודש
        </span>
      </span>

      {/* The shape of the month, and the number it adds up to. */}
      <span className="hidden self-center sm:block">
        {row.closes.length < 2 ? (
          <span className="text-[11px] text-ink-ghost">—</span>
        ) : (
          <>
            <Sparkline
              points={row.closes}
              direction={
                month === null || Math.abs(month) < 0.05
                  ? "flat"
                  : month > 0
                    ? "up"
                    : "down"
              }
              className="h-6 w-full"
            />
            <span className={`num mt-1 block text-[10px] ${directionClass(month)}`}>
              {fmtPercent(month)}
            </span>
          </>
        )}
      </span>

      {/* Turnover, always against its own baseline. */}
      <span className="hidden text-end lg:block">
        <span className="block text-[10px] text-ink-ghost">מחזור</span>
        <span className="num block text-[12px] text-ink-muted">
          {row.volume === null ? "—" : fmtCompact(row.volume)}
        </span>
        <span className="num block text-[10px] text-ink-ghost">
          {ratio === null ? "ללא בסיס" : `×${ratio.toFixed(2)} מהממוצע`}
        </span>
      </span>

      {/* Where it sits in its own year. The single most useful piece of
          context a price can carry, and the cheapest to compute. */}
      <span className="hidden self-center sm:block">
        {position === null ? (
          <span className="text-[11px] text-ink-ghost">—</span>
        ) : (
          <>
            <span className="tase-range" role="img" aria-label={`${Math.round(position * 100)}% מטווח 52 השבועות`}>
              <i style={{ left: `${position * 100}%` }} />
            </span>
            <span className="num mt-1 block text-[10px] text-ink-ghost">
              {shekel(row.yearLow)} – {shekel(row.yearHigh)}
            </span>
          </>
        )}
      </span>
    </div>
  );
}

export function TaseBoard({ sectors }: { sectors: SectorRead[] }) {
  /* One scale for every bar in the table, taken from the largest absolute
     move on it. Scaling each group to itself would draw the quietest sector
     exactly as wide as the loudest, which is the single most common way a
     bar chart lies. */
  const scale = Math.max(
    ...sectors.map((sector) => Math.abs(sector.averageMove ?? 0)),
    0.5,
  );

  return (
    <div className="tase-board surface overflow-hidden">
      {sectors.map((sector) => (
        <div key={sector.sector}>
          <div className="tase-group">
            <span className="text-[13px] font-semibold text-ink">
              {sector.sector}
            </span>
            <span className="badge">
              {sector.names.length === 1
                ? "חברה אחת"
                : `${sector.names.length} חברות`}
            </span>
            {sector.dualListed > 0 && (
              <span
                className="badge"
                title="החברות בסקטור שמגישות גם ל-SEC, ולכן יש להן ניתוח מלא באתר"
              >
                {sector.dualListed} ברישום כפול
              </span>
            )}
            <span className="num text-[11px] text-ink-ghost">
              {sector.quoted === 0
                ? "ללא ציטוט"
                : `${sector.advancing}/${sector.quoted} בעלייה`}
            </span>

            <span className="ms-auto flex items-center gap-3">
              <span className="hidden w-24 sm:block">
                <MoveBar value={sector.averageMove} scale={scale} />
              </span>
              <span className="text-end">
                <span
                  className={`num block text-[13px] ${directionClass(sector.averageMove)}`}
                >
                  {fmtPercent(sector.averageMove)}
                </span>
                <span className="num block text-[10px] text-ink-ghost">
                  {sector.windowAverage === null
                    ? "—"
                    : `${fmtPercent(sector.windowAverage)} בחודש`}
                </span>
              </span>
            </span>
          </div>

          {sector.names.map((row) => (
            <Row key={row.symbol} row={row} />
          ))}
        </div>
      ))}
    </div>
  );
}
