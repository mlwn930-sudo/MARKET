"use client";

import { useEffect, useRef } from "react";
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
import type { Candle } from "@/lib/sources/prices";

/**
 * The price chart, as a real instrument.
 *
 * Built on TradingView's lightweight-charts rather than a general-purpose
 * plotting library, and the reason is interaction rather than looks. A chart
 * a reader cannot zoom into, pan across or hover for the exact OHLC of one
 * session is a picture of data. Scroll to zoom, drag to pan, pinch on a
 * phone, and the crosshair reads out the bar under it — all of that arrives
 * with the library and none of it is reproducible in a static SVG.
 *
 * Everything drawn on top comes from `metrics/technical.ts`. The chart does
 * not decide where a pivot is or what the stop should be; it renders what
 * the frameworks computed, so the levels here and the numbers in the
 * analysis panel below cannot disagree.
 *
 * The live half updates the final candle in place. A trade print arrives,
 * the session's close moves, and its high or low widens if the print went
 * beyond it — which is exactly what the real bar is doing at that moment.
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
  50: { color: "#c9a227", width: 1 },
  150: { color: "#a78bfa", width: 2 },
  200: { color: "#94a3b8", width: 2 },
};

/** Levels are drawn in the meaning-colours the rest of the site uses: the
 *  stop is the losing side, the targets the winning one, and the pivot is
 *  neither until the price picks a direction. */
const LEVEL_COLOR: Record<ChartLevel["kind"], string> = {
  pivot: "#eceae5",
  stop: "#e24b4a",
  target: "#1baf7a",
};

const toTime = (date: string): UTCTimestamp =>
  (Date.parse(`${date}T00:00:00Z`) / 1000) as UTCTimestamp;

function movingAverage(candles: Candle[], period: number) {
  const out: { time: Time; value: number }[] = [];
  let sum = 0;
  for (let i = 0; i < candles.length; i++) {
    sum += candles[i].close;
    if (i >= period) sum -= candles[i - period].close;
    if (i >= period - 1) {
      out.push({ time: toTime(candles[i].date), value: sum / period });
    }
  }
  return out;
}

export function LiveChart({
  candles,
  livePrice,
  accent = "#c9a227",
  levels = [],
  markers = [],
  height = 460,
  label,
}: {
  candles: Candle[];
  /** The last trade, applied to the final bar as it arrives. */
  livePrice?: number | null;
  accent?: string;
  levels?: ChartLevel[];
  markers?: ChartMarker[];
  height?: number;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const chart = useRef<IChartApi | null>(null);
  const priceSeries = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const volumeSeries = useRef<ISeriesApi<"Histogram"> | null>(null);
  /** The last bar as the chart currently holds it, so a live print can widen
   *  its high or low instead of overwriting the session's range. */
  const lastBar = useRef<Candle | null>(null);

  /* ---- Build. Re-runs only when the data itself changes. ---- */
  useEffect(() => {
    const element = container.current;
    if (!element || candles.length === 0) return;

    const instance = createChart(element, {
      height,
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#939aa6",
        fontFamily: "var(--font-plex-mono), ui-monospace, monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "rgba(255,255,255,0.04)" },
        horzLines: { color: "rgba(255,255,255,0.04)" },
      },
      rightPriceScale: {
        borderColor: "rgba(255,255,255,0.08)",
        scaleMargins: { top: 0.08, bottom: 0.28 },
      },
      timeScale: {
        borderColor: "rgba(255,255,255,0.08)",
        timeVisible: false,
      },
      crosshair: {
        mode: 0,
        vertLine: {
          color: accent,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: accent,
        },
        horzLine: {
          color: accent,
          width: 1,
          style: LineStyle.Dashed,
          labelBackgroundColor: accent,
        },
      },
      // Touch: drag to pan, pinch to zoom. On by default, listed here
      // because a chart that traps a phone's vertical scroll is worse than
      // no chart, and these are the switches that govern it.
      handleScroll: { vertTouchDrag: false },
      handleScale: { pinch: true, mouseWheel: true },
      localization: {
        locale: "en-US",
        priceFormatter: (price: number) =>
          price.toLocaleString("en-US", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }),
      },
    });

    const candleSeries = instance.addSeries(CandlestickSeries, {
      upColor: "#1baf7a",
      downColor: "#e24b4a",
      borderUpColor: "#1baf7a",
      borderDownColor: "#e24b4a",
      wickUpColor: "rgba(27,175,122,0.7)",
      wickDownColor: "rgba(226,75,74,0.7)",
      priceLineColor: accent,
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

    // Volume on its own scale, pinned to the lower quarter so it reads as a
    // sub-panel rather than as bars drawn over the price.
    const volume = instance.addSeries(HistogramSeries, {
      priceFormat: { type: "volume" },
      priceScaleId: "volume",
    });
    instance
      .priceScale("volume")
      .applyOptions({ scaleMargins: { top: 0.8, bottom: 0 } });

    volume.setData(
      candles.map((c) => ({
        time: toTime(c.date),
        value: c.volume,
        color:
          c.close >= c.open ? "rgba(27,175,122,0.32)" : "rgba(226,75,74,0.32)",
      })),
    );

    // The four averages the frameworks on this site are defined against.
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
      line.setData(movingAverage(candles, period));
    }

    if (markers.length > 0) {
      createSeriesMarkers(
        candleSeries,
        markers.map((marker) => ({
          time: toTime(marker.date),
          position: "belowBar" as const,
          color: accent,
          shape: "arrowUp" as const,
          text: marker.label,
        })),
      );
    }

    for (const level of levels) {
      candleSeries.createPriceLine({
        price: level.price,
        color: LEVEL_COLOR[level.kind],
        lineWidth: 1,
        lineStyle: level.kind === "pivot" ? LineStyle.Solid : LineStyle.Dashed,
        axisLabelVisible: true,
        title: level.label,
      });
    }

    instance.timeScale().fitContent();

    chart.current = instance;
    priceSeries.current = candleSeries;
    volumeSeries.current = volume;
    lastBar.current = { ...candles[candles.length - 1] };

    // ResizeObserver rather than a window listener: the chart also has to
    // follow a sidebar opening or a tab switching, which never fire resize.
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width;
      if (width) instance.applyOptions({ width });
    });
    observer.observe(element);

    return () => {
      observer.disconnect();
      instance.remove();
      chart.current = null;
      priceSeries.current = null;
      volumeSeries.current = null;
      lastBar.current = null;
    };
  }, [candles, accent, height, levels, markers]);

  /* ---- Live: the final bar follows the tape. ---- */
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

  if (candles.length === 0) {
    return (
      <div className="panel flex h-64 items-center justify-center text-xs text-ink-faint">
        אין היסטוריית מחירים זמינה לסימבול הזה.
      </div>
    );
  }

  return (
    <figure className="panel overflow-hidden p-3">
      <figcaption className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] text-ink-faint">
        <span className="text-ink-muted">{label}</span>
        {([20, 50, 150, 200] as const).map((period) => (
          <span key={period} className="flex items-center gap-1.5">
            <span
              className="inline-block h-0.5 w-4 rounded-full"
              style={{ background: MA_STYLE[period].color }}
              aria-hidden="true"
            />
            <span className="num">MA{period}</span>
          </span>
        ))}
        <span className="ms-auto">גלגלת לזום · גרירה להזזה · ריחוף לנתוני הנר</span>
      </figcaption>

      {/* The chart is a canvas, so it carries no text for a screen reader.
          The figure is labelled and the numbers it draws are all repeated in
          the analysis panel below, which is the accessible path to them. */}
      <div
        ref={container}
        role="img"
        aria-label={label}
        className="w-full"
        style={{ height }}
      />
    </figure>
  );
}
