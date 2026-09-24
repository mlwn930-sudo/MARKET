"use client";

import { RANGES, type RangeKey } from "@/lib/sources/prices";

/**
 * The chart's controls: which window, and which overlays.
 *
 * Defaults are Price and Volume, with nothing else on. Every indicator
 * added to a chart costs legibility from the ones already there, and a
 * chart that opens with four oscillators is a chart nobody reads. The rest
 * are one click away for a reader who wants them.
 *
 * The moving averages are grouped as one toggle rather than four. They are
 * used together by every framework on this site, and four separate switches
 * would be four decisions to make about something that is really one.
 */

export type Indicator = "ma" | "rsi" | "macd" | "ema";

export const INDICATORS: { key: Indicator; label: string; note: string }[] = [
  { key: "ma", label: "ממוצעים נעים", note: "SMA 20 · 50 · 150 · 200" },
  { key: "ema", label: "EMA 21", note: "ממוצע מעריכי, מגיב מהר יותר" },
  { key: "rsi", label: "RSI", note: "עוצמה יחסית, 14 תקופות" },
  { key: "macd", label: "MACD", note: "12 · 26 · 9" },
];

export function ChartControls({
  range,
  onRange,
  indicators,
  onToggle,
  loading,
  note,
}: {
  range: RangeKey;
  onRange: (range: RangeKey) => void;
  indicators: Set<Indicator>;
  onToggle: (indicator: Indicator) => void;
  loading: boolean;
  note?: string;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 pb-3">
      {/* Ranges. A radiogroup rather than buttons, because they are one
          choice among several and a screen reader should hear it that way. */}
      <div
        role="radiogroup"
        aria-label="טווח הגרף"
        className="inset flex items-center gap-0.5 p-0.5"
      >
        {(Object.keys(RANGES) as RangeKey[]).map((key) => {
          const active = key === range;
          return (
            <button
              key={key}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={RANGES[key].label}
              onClick={() => onRange(key)}
              className={`num rounded-[5px] px-2.5 py-1 text-[11px] transition-colors ${
                active
                  ? "bg-overlay text-ink"
                  : "text-ink-faint hover:text-ink-muted"
              }`}
            >
              {key}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {loading && (
          <span className="num text-[10px] text-ink-ghost">טוען…</span>
        )}
        {note && !loading && (
          <span className="text-[10px] text-ink-ghost">{note}</span>
        )}

        {/* Indicators, folded away. Open it and the list is short enough to
            read at a glance, with what each one measures beside it. */}
        <details className="relative">
          <summary className="pill cursor-pointer list-none">
            אינדיקטורים
            {indicators.size > 0 && (
              <span className="num text-accent">{indicators.size}</span>
            )}
          </summary>

          <div className="raised absolute end-0 z-20 mt-2 w-60 p-2">
            {INDICATORS.map((item) => {
              const on = indicators.has(item.key);
              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={on}
                  onClick={() => onToggle(item.key)}
                  className="flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-start transition-colors hover:bg-overlay"
                >
                  <span
                    className={`mt-0.5 grid h-3.5 w-3.5 shrink-0 place-items-center rounded-[3px] border text-[9px] ${
                      on
                        ? "border-accent bg-accent text-[#12100a]"
                        : "border-line-strong text-transparent"
                    }`}
                    aria-hidden="true"
                  >
                    ✓
                  </span>
                  <span className="min-w-0">
                    <span className="block text-[12px] text-ink">
                      {item.label}
                    </span>
                    <span className="num block text-[10px] text-ink-ghost">
                      {item.note}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        </details>
      </div>
    </div>
  );
}
