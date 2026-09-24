import { identityFor } from "@/lib/company-identity";

/**
 * A year of price, rebased so the lines can be compared.
 *
 * Every series starts at 100, which is the only honest way to put a $40
 * stock and a $900 stock on one axis. What it shows is relative return and
 * nothing else — it is not a valuation, and two lines crossing means one
 * company's price moved more than the other's, not that it became better.
 *
 * Drawn on the server as plain SVG. A charting library here would ship
 * kilobytes of JavaScript to draw four polylines that never need to react
 * to anything.
 *
 * X is the index within each series rather than a date. The companies share
 * an exchange calendar, so their bar counts differ by at most a day or two,
 * and mapping by index keeps every line spanning the full width instead of
 * ending short for no visible reason.
 */

export type RelativeSeries = { ticker: string; points: number[] };

const WIDTH = 100;
const HEIGHT = 40;

export function RelativeChart({ series }: { series: RelativeSeries[] }) {
  const usable = series.filter((item) => item.points.length > 3);
  if (usable.length === 0) return null;

  const all = usable.flatMap((item) => item.points);
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;

  const pathFor = (points: number[]) =>
    points
      .map((value, i) => {
        const x = (i / (points.length - 1)) * WIDTH;
        const y = HEIGHT - ((value - min) / span) * (HEIGHT - 2) - 1;
        return `${i === 0 ? "M" : "L"} ${x.toFixed(2)} ${y.toFixed(2)}`;
      })
      .join(" ");

  return (
    <div>
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="none"
        className="h-56 w-full"
        role="img"
        aria-label={`תשואה יחסית בשנה האחרונה: ${usable
          .map(
            (item) =>
              `${item.ticker} ${(item.points.at(-1) ?? 100).toFixed(0)}`,
          )
          .join(", ")}, כשכל סדרה מתחילה ב-100`}
      >
        {/* The baseline every series starts from. */}
        {min <= 100 && max >= 100 && (
          <line
            x1="0"
            x2={WIDTH}
            y1={HEIGHT - ((100 - min) / span) * (HEIGHT - 2) - 1}
            y2={HEIGHT - ((100 - min) / span) * (HEIGHT - 2) - 1}
            stroke="var(--color-line-strong)"
            strokeWidth="0.5"
            vectorEffect="non-scaling-stroke"
            strokeDasharray="2 3"
          />
        )}

        {usable.map((item) => (
          <path
            key={item.ticker}
            d={pathFor(item.points)}
            fill="none"
            stroke={identityFor(item.ticker).accent}
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2">
        {usable.map((item) => {
          const last = item.points.at(-1) ?? 100;
          return (
            <span key={item.ticker} className="flex items-center gap-2">
              <span
                className="inline-block h-[2px] w-5"
                style={{ background: identityFor(item.ticker).accent }}
                aria-hidden="true"
              />
              <span className="num text-[12px] text-ink">{item.ticker}</span>
              <span
                className={`num text-[12px] ${
                  last > 100 ? "text-up" : last < 100 ? "text-down" : "text-ink-muted"
                }`}
              >
                {last > 100 ? "+" : last < 100 ? "−" : ""}
                {Math.abs(last - 100).toFixed(1)}%
              </span>
            </span>
          );
        })}
        <span className="text-[11px] text-ink-ghost">
          שנה אחרונה, כל סדרה מתחילה ב-100. תשואה יחסית בלבד — לא תמחור.
        </span>
      </div>
    </div>
  );
}
