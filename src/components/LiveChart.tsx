"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  createChart,
  createSeriesMarkers,
  HistogramSeries,
  LineSeries,
  LineStyle,
  type IChartApi,
  type ISeriesApi,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import { ChartControls, type Indicator } from "./ChartControls";
import { rsi, sma } from "@/lib/metrics/technical";
import { ema, macd } from "@/lib/metrics/indicators";
import { RANGES, type Candle, type RangeKey } from "@/lib/sources/prices";

/**
 * The price chart.
 *
 * Built on TradingView's lightweight-charts for interaction rather than
 * looks: scroll to zoom, drag to pan, pinch on a phone, and a crosshair
 * that reads out the bar under it. A chart a reader cannot interrogate is a
 * picture of data.
 *
 * Three things are worth knowing about how it is wired.
 *
 * The range switches without a navigation. The server renders the default
 * range, so the first chart is never a loading state; any other range is
 * fetched from /api/history and swapped in place.
 *
 * Indicators are off by default except price and volume. Each one added
 * costs legibility from the ones already there, and RSI and MACD get their
 * own panes rather than being squeezed onto the price scale, where they
 * would either be invisible or would flatten the candles.
 *
 * Everything drawn as a LEVEL — pivot, stop, targets — comes from
 * `metrics/technical.ts`. The chart renders what the frameworks computed
 * and never decides where a level belongs, so a line here and a number in
 * the analysis panel cannot disagree.
 */

export type ChartLevel = {
  price: number;
  label: string;
  kind: "pivot" | "stop" | "target";
};

export type ChartMarker = {
  date: string;
  label: string;
};

const MA_STYLE: Record<number, { color: string; width: 1 | 2 }> = {
  20: { color: "#60a5fa", width: 1 },
  50: { color: "#d9b04a", width: 1 },
  150: { color: "#a78bfa", width: 2 },
  200: { color: "#94a3b8", width: 2 },
};

const LEVEL_COLOR: Record<ChartLevel["kind"], string> = {
  pivot: "#e9ecf1",
  stop: "#e5484d",
  target: "#26b87c",
};

/** Handles both bar shapes: a daily bar is "YYYY-MM-DD", an intraday bar is
 *  a full ISO timestamp. Reading the first as UTC midnight keeps daily bars
 *  from drifting a day in a negative-offset timezone. */
const toTime = (date: string): UTCTimestamp =>
  (Date.parse(date.length === 10 ? `${date}T00:00:00Z` : date) /
    1000) as UTCTimestamp;

function seriesFrom(
  candles: Candle[],
  values: (number | null)[],
): { time: Time; value: number }[] {
  const out: { time: Time; value: number }[] = [];
  for (let i = 0; i < candles.length; i++) {
    const value = values[i];
    if (value !== null && Number.isFinite(value)) {
      out.push({ time: toTime(candles[i].date), value });
    }
  }
  return out;
}

const HEBREW_DATE = new Intl.DateTimeFormat("he-IL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const HEBREW_TIME = new Intl.DateTimeFormat("he-IL", {
  hour: "2-digit",
  minute: "2-digit",
});

const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

type Hover = {
  date: string;
  price: string;
  change: string;
  direction: "up" | "down" | "flat";
  open: string;
  high: string;
  low: string;
  volume: string;
};

export function LiveChart({
  symbol,
  candles: initialCandles,
  livePrice,
  levels = [],
  markers = [],
  height = 440,
  label,
  defaultRange = "1Y",
}: {
  symbol: string;
  candles: Candle[];
  livePrice?: number | null;
  levels?: ChartLevel[];
  markers?: ChartMarker[];
  height?: number;
  label: string;
  defaultRange?: RangeKey;
}) {
  const container = useRef<HTMLDivElement>(null);
  const priceSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastBar = useRef<Candle | null>(null);

  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [candles, setCandles] = useState<Candle[]>(initialCandles);
  const [loading, setLoading] = useState(false);
  const [indicators, setIndicators] = useState<Set<Indicator>>(new Set());
  const [hover, setHover] = useState<Hover | null>(null);

  const intraday = !RANGES[range].daily;

  const load = useCallback(
    async (next: RangeKey) => {
      setRange(next);
      if (next === defaultRange) {
        setCandles(initialCandles);
        return;
      }

      setLoading(true);
      try {
        const res = await fetch(
          `/api/history?symbol=${encodeURIComponent(symbol)}&range=${next}`,
          { cache: "no-store" },
        );
        if (!res.ok) return;
        const data: { candles: Candle[] } = await res.json();
        if (data.candles?.length) setCandles(data.candles);
      } catch {
        // Keep whatever is on screen. A failed range switch should leave
        // the previous chart, not an empty frame.
      } finally {
        setLoading(false);
      }
    },
    [symbol, defaultRange, initialCandles],
  );

  const toggle = useCallback((indicator: Indicator) => {
    setIndicators((current) => {
      const next = new Set(current);
      if (next.has(indicator)) next.delete(indicator);
      else next.add(indicator);
      return next;
    });
  }, []);

  useEffect(() => {
    const element = container.current;
    if (!element || candles.length === 0) return;

    const showRsi = indicators.has("rsi") && candles.length > 15;
    const showMacd = indicators.has("macd") && candles.length > 40;
    const extraPanes = (showRsi ? 1 : 0) + (showMacd ? 1 : 0);

    const instance: IChartApi = createChart(element, {
      height: height + extraPanes * 110,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8b94a3",
        fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.035)" },
        horzLines: { color: "rgba(255,255,255,0.035)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.07)",
        scaleMargins: { top: 0.08, bottom: 0.26 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.07)",
        timeVisible: intraday,
        secondsVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: "rgba(217,176,74,0.6)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#d9b04a",
        },
        horzLine: {
          color: "rgba(217,176,74,0.6)",
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: "#d9b04a",
        },
      },
      // A chart that traps a phone's vertical scroll is worse than no
      // chart: horizontal drag pans, vertical drag scrolls the page.
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, mouseWheel: true },
      localization: {
        locale: "en-US",
        priceFormatter: money,
      },
    });

    const candleSeries = instance.addSeries(CandlestickSeries, {
      upColor: "#26b87c",
      downColor: "#e5484d",
      borderUpColor: "#26b87c",
      borderDownColor: "#e5484d",
      wickUpColor: "rgba(38,184,124,0.7)",
      wickDownColor: "rgba(229,72,77,0.7)",
      priceLineColor: "rgba(217,176,74,0.5)",
      priceLineStyle: LineStyle.Dotted,
    });

    candleSeries.setData(
      candles.map((c) => ({
        time: toTime(c.date),
        open: c.open,
        high: c.high,
        low: c.low,
        close: c.close,
      })),
    );

    const volume = instance.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    instance
      .priceScale("volume")
      .applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } });

    volume.setData(
      candles.map((c) => ({
        time: toTime(c.date),
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(38,184,124,0.28)" : "rgba(229,72,77,0.28)",
      })),
    );

    /* ---- Overlays on the price pane ---- */

    if (indicators.has("ma")) {
      for (const period of [20, 50, 150, 200] as const) {
        if (candles.length < period) continue;
        const style = MA_STYLE[period];
        const line = instance.addSeries(LineSeries, {
          color: style.color,
          lineWidth: style.width,
          priceLineVisible: false,
          lastValueVisible: false,
          crosshairMarkerVisible: false,
        });
        line.setData(seriesFrom(candles, sma(candles, period)));
      }
    }

    if (indicators.has("ema") && candles.length >= 21) {
      const line = instance.addSeries(LineSeries, {
        color: "#f472b6",
        lineWidth: 1,
        priceLineVisible: false,
        lastValueVisible: false,
        crosshairMarkerVisible: false,
      });
      line.setData(seriesFrom(candles, ema(candles, 21)));
    }

    /* ---- Their own panes ---- */

    let pane = 1;

    if (showRsi) {
      const index = pane++;
      const line = instance.addSeries(
        LineSeries,
        { color: "#a78bfa", lineWidth: 1, priceLineVisible: false },
        index,
      );
      line.setData(seriesFrom(candles, rsi(candles)));

      // 70 and 30 are the conventional bands, and they mislead in a strong
      // trend — a stock in a real advance holds above 70 for months. Drawn
      // faintly, as reference rather than as a signal.
      for (const level of [70, 30]) {
        line.createPriceLine({
          price: level,
          color: "rgba(255,255,255,0.14)",
          lineWidth: 1,
          lineStyle: LineStyle.Dotted,
          axisLabelVisible: true,
          title: String(level),
        });
      }
    }

    if (showMacd) {
      const index = pane++;
      const { macd: line, signal, histogram } = macd(candles);

      const bars = instance.addSeries(
        HistogramSeries,
        { priceFormat: { type: "price", precision: 2, minMove: 0.01 } },
        index,
      );
      bars.setData(
        seriesFrom(candles, histogram).map((point) => ({
          ...point,
          color:
            point.value >= 0 ? "rgba(38,184,124,0.5)" : "rgba(229,72,77,0.5)",
        })),
      );

      instance
        .addSeries(
          LineSeries,
          { color: "#60a5fa", lineWidth: 1, priceLineVisible: false },
          index,
        )
        .setData(seriesFrom(candles, line));

      instance
        .addSeries(
          LineSeries,
          { color: "#d9b04a", lineWidth: 1, priceLineVisible: false },
          index,
        )
        .setData(seriesFrom(candles, signal));
    }

    /* ---- What the frameworks computed ---- */

    // Only on ranges long enough to have produced them. The levels come
    // from two years of daily bars, and drawing them over an intraday
    // chart would imply they were computed from it.
    if (!intraday && (range === "1Y" || range === "5Y")) {
      for (const level of levels) {
        candleSeries.createPriceLine({
          price: level.price,
          color: LEVEL_COLOR[level.kind],
          lineWidth: 1,
          lineStyle:
            level.kind === "pivot" ? LineStyle.Solid : LineStyle.Dashed,
          axisLabelVisible: true,
          title: level.label,
        });
      }

      if (markers.length > 0) {
        createSeriesMarkers(
          candleSeries,
          markers.map((marker) => ({
            time: toTime(marker.date),
            position: "belowBar" as const,
            color: "#d9b04a",
            shape: "arrowUp" as const,
            text: marker.label,
          })),
        );
      }
    }

    /* ---- The Hebrew read-out ---- */

    instance.subscribeCrosshairMove((param) => {
      if (!param.time || !param.point) {
        setHover(null);
        return;
      }
      const bar = param.seriesData.get(candleSeries) as
        | { open: number; high: number; low: number; close: number }
        | undefined;
      if (!bar) {
        setHover(null);
        return;
      }

      const when = new Date((param.time as number) * 1000);
      const change = bar.open > 0 ? ((bar.close - bar.open) / bar.open) * 100 : 0;
      const volumeBar = param.seriesData.get(volume) as
        | { value: number }
        | undefined;

      setHover({
        date: intraday
          ? `${HEBREW_DATE.format(when)} · ${HEBREW_TIME.format(when)}`
          : HEBREW_DATE.format(when),
        price: money(bar.close),
        change: `${change >= 0 ? "+" : "−"}${Math.abs(change).toFixed(2)}%`,
        direction: change > 0 ? "up" : change < 0 ? "down" : "flat",
        open: money(bar.open),
        high: money(bar.high),
        low: money(bar.low),
        volume: volumeBar
          ? volumeBar.value.toLocaleString("en-US", {
              notation: "compact",
              maximumFractionDigits: 1,
            })
          : "—",
      });
    });

    instance.timeScale().fitContent();

    priceSeries.current = candleSeries;
    lastBar.current = { ...candles[candles.length - 1] };

    // ResizeObserver rather than a window listener: the chart also has to
    // follow a panel opening or a tab switching, which never fire resize.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) instance.applyOptions({ width });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      instance.remove();
      priceSeries.current = null;
      lastBar.current = null;
      setHover(null);
    };
  }, [candles, height, levels, markers, indicators, intraday, range]);

  /* ---- Live: the final bar follows the tape ---- */

  useEffect(() => {
    const series = priceSeries.current;
    const bar = lastBar.current;
    if (!series || !bar || livePrice == null || !Number.isFinite(livePrice)) {
      return;
    }

    const updated: Candle = {
      ...bar,
      close: livePrice,
      high: Math.max(bar.high, livePrice),
      low: Math.min(bar.low, livePrice),
    };
    lastBar.current = updated;

    series.update({
      time: toTime(updated.date),
      open: updated.open,
      high: updated.high,
      low: updated.low,
      close: updated.close,
    });
  }, [livePrice]);

  if (initialCandles.length === 0) {
    return (
      <div className="surface flex h-64 items-center justify-center text-[13px] text-ink-ghost">
        אין היסטוריית מחירים זמינה לסימבול הזה.
      </div>
    );
  }

  return (
    <figure className="surface overflow-hidden p-4">
      <ChartControls
        range={range}
        onRange={load}
        indicators={indicators}
        onToggle={toggle}
        loading={loading}
        note={
          intraday
            ? "רמות הניתוח מוצגות בטווחים ארוכים בלבד"
            : `${candles.length} נרות`
        }
      />

      {/* The read-out. Fixed height so the chart does not jump as the
          crosshair enters and leaves. */}
      <div className="mb-2 flex h-9 flex-wrap items-center gap-x-5 gap-y-1 px-1 text-[11px]">
        {hover ? (
          <>
            <span className="text-ink-muted">{hover.date}</span>
            <span className="num text-ink">
              {hover.price}
              <span
                className={`ms-2 ${
                  hover.direction === "up"
                    ? "text-up"
                    : hover.direction === "down"
                      ? "text-down"
                      : "text-ink-faint"
                }`}
              >
                {hover.change}
              </span>
            </span>
            <span className="num hidden text-ink-ghost sm:inline">
              פתיחה {hover.open} · גבוה {hover.high} · נמוך {hover.low}
            </span>
            <span className="num hidden text-ink-ghost md:inline">
              מחזור {hover.volume}
            </span>
          </>
        ) : (
          <span className="text-ink-ghost">
            ריחוף לנתוני נר · גלגלת לזום · גרירה להזזה
          </span>
        )}

        {indicators.has("ma") && (
          <span className="ms-auto hidden items-center gap-3 lg:flex">
            {([20, 50, 150, 200] as const).map((period) => (
              <span key={period} className="flex items-center gap-1.5">
                <span
                  className="inline-block h-0.5 w-3.5 rounded-full"
                  style={{ background: MA_STYLE[period].color }}
                  aria-hidden="true"
                />
                <span className="num text-ink-ghost">MA{period}</span>
              </span>
            ))}
          </span>
        )}
      </div>

      {/* The chart is a canvas and carries no text for a screen reader. The
          figure is labelled, and every number it draws is repeated in the
          analysis panels below — which is the accessible path to it. */}
      <div ref={container} role="img" aria-label={label} className="w-full" />
    </figure>
  );
}
