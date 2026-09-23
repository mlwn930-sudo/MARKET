import {
  TREND_LABELS,
  lastCross,
  readTrend,
  rsi,
  sma,
  volatility,
  type PriceHistory,
} from "@/lib/sources/prices";
import { fmtCompact, fmtPrice } from "@/lib/format";

/**
 * Daily candlesticks with moving averages, volume, and a technical read.
 *
 * Indicators are computed over the full two-year series but only the last
 * `VISIBLE` sessions are drawn. Candles need room to be readable — five
 * hundred of them across a chart is a smear — while a 150-day average
 * computed on a 120-day window would simply be absent.
 *
 * Server-rendered SVG. The chart is static once drawn, and shipping a
 * charting library to place rectangles would cost more than it returns.
 */

const UP = "#1baf7a";
const DOWN = "#e24b4a";
const MUTED = "#8a8f98";
const FAINT = "#5e636b";
const GRID = "rgba(255,255,255,0.07)";
const MONO = "var(--font-plex-mono), monospace";

const VISIBLE = 120;
const SHORT_PERIOD = 50;
const LONG_PERIOD = 150;

function agoLabel(sessions: number): string {
  if (sessions < 5) return "לפני ימים ספורים";
  if (sessions < 22) return `לפני כ-${Math.round(sessions / 5)} שבועות`;
  return `לפני כ-${Math.round(sessions / 21)} חודשים`;
}

export function CandleChart({
  history,
  accent = "#c9a227",
}: {
  history: PriceHistory;
  accent?: string;
}) {
  const all = history.candles;
  if (all.length < 40) return null;

  const shortMa = sma(all, SHORT_PERIOD);
  const longMa = sma(all, LONG_PERIOD);
  const rsiSeries = rsi(all);
  const trend = readTrend(all, longMa);
  const cross = lastCross(all, shortMa, longMa);
  const vol = volatility(all);

  const startIndex = Math.max(0, all.length - VISIBLE);
  const candles = all.slice(startIndex);
  const shortWindow = shortMa.slice(startIndex);
  const longWindow = longMa.slice(startIndex);
  const lastRsi = rsiSeries[rsiSeries.length - 1];

  const width = 920;
  const priceH = 300;
  const volumeH = 58;
  const gap = 10;
  const height = priceH + gap + volumeH + 24;
  const padRight = 56;
  const plotW = width - padRight - 4;

  const highs = candles.map((c) => c.high);
  const lows = candles.map((c) => c.low);
  const mas = [...shortWindow, ...longWindow].filter(
    (v): v is number => v !== null,
  );
  const rawMax = Math.max(...highs, ...mas);
  const rawMin = Math.min(...lows, ...mas);
  const pad = (rawMax - rawMin) * 0.06 || 1;
  const max = rawMax + pad;
  const min = Math.max(0, rawMin - pad);

  const slot = plotW / candles.length;
  const bodyW = Math.max(1.5, Math.min(9, slot * 0.62));

  const x = (i: number) => 4 + i * slot + slot / 2;
  const y = (v: number) => 6 + (priceH - 12) - ((v - min) / (max - min)) * (priceH - 12);

  const maxVolume = Math.max(...candles.map((c) => c.volume), 1);
  const volY = (v: number) =>
    priceH + gap + volumeH - (v / maxVolume) * volumeH;

  const line = (series: (number | null)[]) => {
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

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => min + (max - min) * t);
  const dateTicks = [0, 0.33, 0.66, 1].map((t) => {
    const i = Math.round(t * (candles.length - 1));
    return { i, label: candles[i].date.slice(5) };
  });

  const verdict = trend.verdict;

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-4 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-1.5 rounded-[1px] bg-up" />
            <span className="inline-block h-3 w-1.5 rounded-[1px] bg-down" />
            <span className="text-ink-muted">
              נרות יומיים · <span className="num">{VISIBLE}</span> מסחרים
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4" style={{ background: accent }} />
            <span className="text-ink-muted">
              ממוצע <span className="num">{LONG_PERIOD}</span>
            </span>
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="inline-block w-4"
              style={{
                height: 1,
                backgroundImage:
                  "repeating-linear-gradient(to right, #8a8f98 0 4px, transparent 4px 7px)",
              }}
            />
            <span className="text-ink-faint">
              ממוצע <span className="num">{SHORT_PERIOD}</span>
            </span>
          </span>
        </div>

        {verdict && (
          <span
            className="rounded-full border px-2.5 py-0.5 text-[11px]"
            style={{ borderColor: `${accent}55`, color: accent }}
          >
            {TREND_LABELS[verdict].he}
          </span>
        )}
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`גרף נרות יומי של ${history.symbol} עם ממוצעים נעים ונפח מסחר`}
        className="block"
      >
        {ticks.map((value) => (
          <g key={value}>
            <line x1="4" x2={4 + plotW} y1={y(value)} y2={y(value)} stroke={GRID} />
            <text
              x={4 + plotW + 8}
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

        {candles.map((candle, i) => {
          const rising = candle.close >= candle.open;
          const colour = rising ? UP : DOWN;
          const bodyTop = y(Math.max(candle.open, candle.close));
          const bodyBottom = y(Math.min(candle.open, candle.close));
          return (
            <g key={candle.date}>
              <line
                x1={x(i)}
                x2={x(i)}
                y1={y(candle.high)}
                y2={y(candle.low)}
                stroke={colour}
                strokeWidth="1"
                opacity="0.75"
              />
              <rect
                x={x(i) - bodyW / 2}
                y={bodyTop}
                width={bodyW}
                // A doji closes where it opened; without a floor it vanishes.
                height={Math.max(1, bodyBottom - bodyTop)}
                fill={colour}
                opacity="0.9"
              >
                <title>
                  {`${candle.date} · פתיחה ${fmtPrice(candle.open)} · גבוה ${fmtPrice(candle.high)} · נמוך ${fmtPrice(candle.low)} · סגירה ${fmtPrice(candle.close)}`}
                </title>
              </rect>
            </g>
          );
        })}

        <path d={line(longWindow)} fill="none" stroke={accent} strokeWidth="1.75" />
        <path
          d={line(shortWindow)}
          fill="none"
          stroke={MUTED}
          strokeWidth="1"
          strokeDasharray="4 3"
        />

        <line
          x1="4"
          x2={4 + plotW}
          y1={priceH + gap - 2}
          y2={priceH + gap - 2}
          stroke={GRID}
        />
        {candles.map((candle, i) => {
          const rising = candle.close >= candle.open;
          return (
            <rect
              key={`v${candle.date}`}
              x={x(i) - bodyW / 2}
              y={volY(candle.volume)}
              width={bodyW}
              height={Math.max(1, priceH + gap + volumeH - volY(candle.volume))}
              fill={rising ? UP : DOWN}
              opacity="0.32"
            />
          );
        })}
        <text
          x={4 + plotW + 8}
          y={priceH + gap + 12}
          fill={FAINT}
          fontSize="9"
          fontFamily={MONO}
          direction="ltr"
        >
          נפח
        </text>

        {dateTicks.map((tick) => (
          <text
            key={tick.i}
            x={x(tick.i)}
            y={height - 6}
            textAnchor={tick.i === 0 ? "start" : "middle"}
            fill={FAINT}
            fontSize="10"
            fontFamily={MONO}
            direction="ltr"
          >
            {tick.label}
          </text>
        ))}
      </svg>

      <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-3 text-[11px] sm:grid-cols-3 lg:grid-cols-6">
        <div>
          <dt className="text-ink-faint">מול ממוצע 150</dt>
          <dd className="num mt-0.5 text-ink">
            {trend.vsAveragePercent === null
              ? "—"
              : `${trend.vsAveragePercent > 0 ? "▲" : "▼"}${Math.abs(trend.vsAveragePercent).toFixed(1)}%`}
          </dd>
        </div>
        <div>
          <dt className="text-ink-faint">RSI 14</dt>
          <dd className="num mt-0.5 text-ink">
            {lastRsi === null ? "—" : lastRsi.toFixed(0)}
          </dd>
        </div>
        <div>
          <dt className="text-ink-faint">תנודתיות שנתית</dt>
          <dd className="num mt-0.5 text-ink">
            {vol === null ? "—" : `${vol.toFixed(0)}%`}
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
          <dt className="text-ink-faint">נפח ממוצע</dt>
          <dd className="num mt-0.5 text-ink">
            {fmtCompact(
              candles.reduce((s, c) => s + c.volume, 0) / candles.length,
            )}
          </dd>
        </div>
      </dl>

      <div className="mt-4 space-y-2 border-t border-line pt-3 text-[12px] leading-relaxed text-ink-muted">
        {verdict && (
          <p>
            <span style={{ color: accent }}>מגמה: </span>
            {TREND_LABELS[verdict].note}.
            {trend.fromHighPercent !== null &&
              ` המחיר ${Math.abs(trend.fromHighPercent).toFixed(1)}% ${trend.fromHighPercent < 0 ? "מתחת" : "מעל"} לשיא השנתי.`}
          </p>
        )}

        {cross && (
          <p>
            <span style={{ color: accent }}>חציית ממוצעים: </span>
            {cross.kind === "golden"
              ? "ממוצע 50 חצה מעלה את ממוצע 150"
              : "ממוצע 50 חצה מטה את ממוצע 150"}
            , {agoLabel(cross.ago)}.
            {cross.ago > 60 &&
              " חצייה ישנה כבר אינה אירוע — היא פשוט תיאור של המצב הנוכחי."}
          </p>
        )}

        {lastRsi !== null && (
          <p>
            <span style={{ color: accent }}>RSI: </span>
            {lastRsi.toFixed(0)}.{" "}
            {lastRsi > 70
              ? "מעל 70. הפרשנות המקובלת היא קניית יתר, אבל מניה במגמה חזקה יכולה להחזיק שם חודשים — זו לא סיבה בפני עצמה."
              : lastRsi < 30
                ? "מתחת ל-30. הפרשנות המקובלת היא מכירת יתר, אבל מניה שיורדת מסיבה אמיתית יכולה להישאר שם זמן רב."
                : "באזור הנייטרלי, בלי אות קיצוני לכיוון כלשהו."}
          </p>
        )}

        <p className="text-ink-faint">
          כל המדדים כאן מחושבים מהעבר ומתארים מה כבר קרה. הם אינם תחזית, ואף
          אחד מהם אינו מספיק להחלטה בפני עצמו.
        </p>
      </div>
    </figure>
  );
}
