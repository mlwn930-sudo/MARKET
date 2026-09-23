import {
  TREND_LABELS,
  readTrend,
  sma,
  type PriceHistory,
} from "@/lib/sources/prices";
import { fmtPrice } from "@/lib/format";

/**
 * Two years of daily closes with two moving averages.
 *
 * Server-rendered SVG: the chart is static once drawn, and shipping a
 * charting library to draw three polylines would cost more than it returns.
 *
 * The 150-day average is drawn heavier than the 50-day because it is the
 * one the trend label is read from. Showing both at equal weight invites
 * reading whichever crossed most recently as the more important line.
 */

const MUTED = "#8a8f98";
const FAINT = "#5e636b";
const GRID = "rgba(255,255,255,0.07)";
const MONO = "var(--font-plex-mono), monospace";

const SHORT_PERIOD = 50;
const LONG_PERIOD = 150;

export function PriceChart({
  history,
  accent = "#c9a227",
}: {
  history: PriceHistory;
  accent?: string;
}) {
  const { candles } = history;
  if (candles.length < 40) return null;

  const shortAverage = sma(candles, SHORT_PERIOD);
  const longAverage = sma(candles, LONG_PERIOD);
  const trend = readTrend(candles, longAverage);

  const width = 900;
  const height = 320;
  const padLeft = 8;
  const padRight = 54;
  const padTop = 14;
  const padBottom = 26;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const values = candles.map((c) => c.close);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A little headroom so the line never touches the frame.
  const pad = (rawMax - rawMin) * 0.08 || 1;
  const min = Math.max(0, rawMin - pad);
  const max = rawMax + pad;

  const x = (i: number) => padLeft + (i / (candles.length - 1)) * plotW;
  const y = (value: number) =>
    padTop + plotH - ((value - min) / (max - min)) * plotH;

  const path = (series: (number | null)[]) => {
    const parts: string[] = [];
    let drawing = false;
    series.forEach((value, i) => {
      if (value === null) {
        drawing = false;
        return;
      }
      parts.push(`${drawing ? "L" : "M"}${x(i).toFixed(1)} ${y(value).toFixed(1)}`);
      drawing = true;
    });
    return parts.join(" ");
  };

  const pricePath = path(values);
  const shortPath = path(shortAverage);
  const longPath = path(longAverage);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);

  // A year label roughly every quarter, taken from the actual candle dates.
  const dateTicks = [0, 0.25, 0.5, 0.75, 1].map((t) => {
    const i = Math.round(t * (candles.length - 1));
    return { i, label: candles[i].date.slice(0, 7) };
  });

  const verdict = trend.verdict;
  const lastClose = values[values.length - 1];

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4"
              style={{ background: accent }}
            />
            <span className="text-ink-muted">מחיר סגירה</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 bg-[#8a8f98]" />
            <span className="text-ink-muted">
              ממוצע <span className="num">{LONG_PERIOD}</span> ימים
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block h-px w-4"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(to right, #5e636b 0 4px, transparent 4px 7px)",
                height: 1,
              }}
            />
            <span className="text-ink-faint">
              ממוצע <span className="num">{SHORT_PERIOD}</span> ימים
            </span>
          </span>
        </div>

        {verdict && (
          <span
            className="rounded-full border px-2.5 py-0.5 text-[11px]"
            style={{ borderColor: `${accent}55`, color: accent }}
            title={TREND_LABELS[verdict].note}
          >
            {TREND_LABELS[verdict].he}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`גרף מחיר של ${history.symbol} לשנתיים האחרונות, עם ממוצעים נעים של ${SHORT_PERIOD} ו-${LONG_PERIOD} ימים`}
        className="block"
      >
        {ticks.map((value) => (
          <g key={value}>
            <line
              x1={padLeft}
              x2={padLeft + plotW}
              y1={y(value)}
              y2={y(value)}
              stroke={GRID}
              strokeWidth="1"
            />
            <text
              x={padLeft + plotW + 8}
              y={y(value) + 4}
              fill={MUTED}
              fontSize="10"
              fontFamily={MONO}
              direction="ltr"
            >
              {fmtPrice(value)}
            </text>
          </g>
        ))}

        {dateTicks.map((tick) => (
          <text
            key={tick.i}
            x={x(tick.i)}
            y={height - 8}
            textAnchor={tick.i === 0 ? "start" : "middle"}
            fill={FAINT}
            fontSize="10"
            fontFamily={MONO}
            direction="ltr"
          >
            {tick.label}
          </text>
        ))}

        <path
          d={longPath}
          fill="none"
          stroke={MUTED}
          strokeWidth="1.75"
          strokeLinejoin="round"
        />
        <path
          d={shortPath}
          fill="none"
          stroke={FAINT}
          strokeWidth="1"
          strokeDasharray="4 3"
          strokeLinejoin="round"
        />
        <path
          d={pricePath}
          fill="none"
          stroke={accent}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle
          cx={x(candles.length - 1)}
          cy={y(lastClose)}
          r="4"
          fill={accent}
          stroke="#14181e"
          strokeWidth="2"
        />
      </svg>

      <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-line pt-3 text-[11px] sm:grid-cols-4">
        <div>
          <dt className="text-ink-faint">מול ממוצע 150</dt>
          <dd className="num mt-0.5 text-ink">
            {trend.vsAveragePercent === null
              ? "—"
              : `${trend.vsAveragePercent > 0 ? "▲" : "▼"}${Math.abs(trend.vsAveragePercent).toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-faint">שיא 52 שבועות</dt>
          <dd className="num mt-0.5 text-ink">{fmtPrice(trend.high52)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">שפל 52 שבועות</dt>
          <dd className="num mt-0.5 text-ink">{fmtPrice(trend.low52)}</dd>
        </div>
        <div>
          <dt className="text-ink-faint">מרחק מהשיא</dt>
          <dd className="num mt-0.5 text-ink">
            {trend.fromHighPercent === null
              ? "—"
              : `${trend.fromHighPercent.toFixed(1)}%`}
          </dd>
        </div>
      </dl>

      {verdict && (
        <p className="mt-3 text-[11px] leading-relaxed text-ink-muted">
          {TREND_LABELS[verdict].note}. קריאת מגמה מתארת מה קרה עד כה ואינה
          תחזית — ממוצע נע מגיב לעבר, לא לעתיד.
        </p>
      )}
    </figure>
  );
}
