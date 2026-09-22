import type { ScreenResult } from "@/lib/screener";

/**
 * Two server-rendered charts for the screen. No client JavaScript: the page
 * is a list of static figures, and shipping a charting library to draw fifty
 * dots would cost more than it returns.
 *
 * Colour carries one meaning only — whether a company cleared the score
 * threshold. Everything else is grey. Green and red are reserved for price
 * direction elsewhere on the site and are deliberately absent here: a
 * screening score is not a gain or a loss.
 */

const GOLD = "#c9a227";
const GREY = "#5e636b";
const MUTED = "#8a8f98";
const LINE = "rgba(255,255,255,0.10)";
const MONO = "var(--font-plex-mono), monospace";

const HIGH_SCORE = 8;

/** Outliers are clamped to the edge rather than dropped, and drawn hollow so
 *  a reader does not mistake a clamped dot for a real value. */
const PE_MAX = 60;
const ROIC_MAX = 100;

export function ValueQualityScatter({ results }: { results: ScreenResult[] }) {
  const points = results
    .map((r) => ({
      ticker: r.company.ticker,
      score: r.score,
      pe: r.company.metrics.pe ?? null,
      roic: r.company.metrics.roic ?? null,
    }))
    .filter(
      (p): p is { ticker: string; score: number; pe: number; roic: number } =>
        p.pe !== null && p.roic !== null && p.pe > 0,
    );

  const skipped = results.length - points.length;
  if (points.length < 5) return null;

  const width = 660;
  const height = 340;
  const padLeft = 46;
  const padRight = 18;
  const padTop = 16;
  const padBottom = 38;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const x = (pe: number) => padLeft + (Math.min(pe, PE_MAX) / PE_MAX) * plotW;
  const y = (roic: number) =>
    padTop + plotH - (Math.min(Math.max(roic, 0), ROIC_MAX) / ROIC_MAX) * plotH;

  const xTicks = [0, 15, 30, 45, 60];
  const yTicks = [0, 25, 50, 75, 100];

  // Label only the standouts. Labelling fifty dots produces a smear.
  const labelled = [...points]
    .sort((a, b) => b.score - a.score || b.roic - a.roic)
    .slice(0, 6);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <figcaption className="mb-1 text-sm text-ink">תמחור מול איכות</figcaption>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-muted">
        כל נקודה היא חברה. ככל שהיא שמאלה יותר היא זולה יותר ביחס לרווחיה,
        וככל שהיא גבוהה יותר היא מייצרת תשואה טובה יותר על ההון שהושקע בה.
        הפינה השמאלית-עליונה היא המעניינת.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label={`תרשים פיזור של ${points.length} חברות: מכפיל רווח מול תשואה על ההון המושקע`}
        className="block"
      >
        {yTicks.map((tick) => (
          <g key={`y${tick}`}>
            <line
              x1={padLeft}
              x2={width - padRight}
              y1={y(tick)}
              y2={y(tick)}
              stroke={LINE}
              strokeWidth="1"
            />
            <text
              x={padLeft - 8}
              y={y(tick) + 4}
              textAnchor="end"
              fill={MUTED}
              fontSize="10"
              fontFamily={MONO}
            >
              {tick}%
            </text>
          </g>
        ))}

        {xTicks.map((tick) => (
          <text
            key={`x${tick}`}
            x={x(tick)}
            y={height - 20}
            textAnchor="middle"
            fill={MUTED}
            fontSize="10"
            fontFamily={MONO}
          >
            {tick}
          </text>
        ))}

        <text
          x={padLeft + plotW / 2}
          y={height - 5}
          textAnchor="middle"
          fill={GREY}
          fontSize="10"
          fontFamily={MONO}
        >
          P/E
        </text>
        <text
          x={13}
          y={padTop + plotH / 2}
          textAnchor="middle"
          fill={GREY}
          fontSize="10"
          fontFamily={MONO}
          transform={`rotate(-90 13 ${padTop + plotH / 2})`}
        >
          ROIC
        </text>

        {points.map((point) => {
          const strong = point.score >= HIGH_SCORE;
          const clamped = point.pe > PE_MAX || point.roic > ROIC_MAX;
          return (
            <circle
              key={point.ticker}
              cx={x(point.pe)}
              cy={y(point.roic)}
              r={strong ? 5 : 3.5}
              fill={clamped ? "none" : strong ? GOLD : GREY}
              stroke={clamped ? (strong ? GOLD : GREY) : "none"}
              strokeWidth={clamped ? 1.5 : 0}
              opacity={strong ? 1 : 0.7}
            >
              <title>
                {`${point.ticker} — P/E ${point.pe.toFixed(1)}x · ROIC ${point.roic.toFixed(1)}% · ציון ${point.score}`}
              </title>
            </circle>
          );
        })}

        {labelled.map((point) => (
          <text
            key={`label-${point.ticker}`}
            x={x(point.pe) + 8}
            y={y(point.roic) + 3}
            fill={point.score >= HIGH_SCORE ? GOLD : MUTED}
            fontSize="10"
            fontFamily={MONO}
          >
            {point.ticker}
          </text>
        ))}
      </svg>

      <p className="mt-2 text-[10px] leading-relaxed text-ink-faint">
        עיגול חלול = הערך חורג מגבול הציר והוצמד אליו.
        {skipped > 0 &&
          ` ${skipped} חברות אינן מוצגות כאן — חסר להן P/E או ROIC בדוחות.`}
      </p>
    </figure>
  );
}

export function ScoreDistribution({ results }: { results: ScreenResult[] }) {
  if (results.length === 0) return null;
  const maxScore = results[0].maxScore;

  // Scores below 3 are dropped: the bars are empty and only add width.
  const buckets = Array.from({ length: maxScore + 1 }, (_, score) => ({
    score,
    count: results.filter((r) => r.score === score).length,
  })).filter((bucket) => bucket.score >= 3);

  const tallest = Math.max(...buckets.map((b) => b.count), 1);

  const width = 660;
  const height = 200;
  const padTop = 22;
  const padBottom = 34;
  const plotH = height - padBottom - padTop;
  const slot = width / buckets.length;
  const barWidth = Math.min(24, slot * 0.55);

  return (
    <figure className="rounded-xl border border-line bg-surface p-4">
      <figcaption className="mb-1 text-sm text-ink">התפלגות הציונים</figcaption>
      <p className="mb-3 text-[11px] leading-relaxed text-ink-muted">
        כמה חברות קיבלו כל ציון. זה מראה כמה הרף באמת גבוה — ציון{" "}
        <span className="num">{HIGH_SCORE}</span> ומעלה הוא נדיר.
      </p>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        role="img"
        aria-label="תרשים עמודות של מספר החברות בכל ציון"
        className="block"
      >
        <line
          x1="0"
          x2={width}
          y1={padTop + plotH}
          y2={padTop + plotH}
          stroke={LINE}
          strokeWidth="1"
        />
        {buckets.map((bucket, i) => {
          const barHeight = (bucket.count / tallest) * plotH;
          const barX = i * slot + (slot - barWidth) / 2;
          const barY = padTop + plotH - barHeight;
          return (
            <g key={bucket.score}>
              <rect
                x={barX}
                y={barY}
                width={barWidth}
                height={Math.max(barHeight, 1)}
                rx="3"
                fill={bucket.score >= HIGH_SCORE ? GOLD : GREY}
                opacity={bucket.score >= HIGH_SCORE ? 1 : 0.6}
              />
              {bucket.count > 0 && (
                <text
                  x={barX + barWidth / 2}
                  y={barY - 6}
                  textAnchor="middle"
                  fill={MUTED}
                  fontSize="10"
                  fontFamily={MONO}
                >
                  {bucket.count}
                </text>
              )}
              <text
                x={barX + barWidth / 2}
                y={height - 12}
                textAnchor="middle"
                fill={GREY}
                fontSize="10"
                fontFamily={MONO}
              >
                {bucket.score}
              </text>
            </g>
          );
        })}
      </svg>
    </figure>
  );
}
