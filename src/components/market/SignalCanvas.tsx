"use client";

import Link from "next/link";
import { useId, useState } from "react";
import type { IndexCard } from "@/components/MarketDeck";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { fmtPercent } from "@/lib/format";

/** Prices are server seeds; paths are actual intraday closes, never decoration. */
export function SignalCanvas({ indices, quotes }: { indices: IndexCard[]; quotes: Record<string, LiveQuote> }) {
  const [selected, setSelected] = useState(indices[0]?.symbol ?? "SPY");
  const id = useId().replace(/:/g, "");
  const entry = indices.find((item) => item.symbol === selected) ?? indices[0];
  const quote = quotes[selected];
  const quoteTime = quote?.at ? new Date(quote.at) : null;
  const timestamp = quoteTime && Number.isFinite(quoteTime.getTime())
    ? new Intl.DateTimeFormat("he-IL", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jerusalem" }).format(quoteTime)
    : null;
  const values = (entry?.intraday ?? []).filter(Number.isFinite);
  const min = Math.min(...values), max = Math.max(...values);
  const span = max - min || 1;
  const points = values.map((v, i) => [12 + i / Math.max(1, values.length - 1) * 496, 138 - (v - min) / span * 100]);
  const path = points.map(([x, y], i) => (i ? "L" : "M") + x.toFixed(2) + "," + y.toFixed(2)).join(" ");
  return <section className="signal-canvas" aria-label="מהלך המסחר במדדים">
    <div className="signal-heading"><span className="micro-label" dir="ltr">SESSION / READOUT</span><span className="caption">קרנות סל עוקבות</span></div>
    <div className="signal-tabs" aria-label="בחירת מדד">
      {indices.map((index) => <button key={index.symbol} type="button" aria-pressed={selected === index.symbol} onClick={() => setSelected(index.symbol)}>{index.label}</button>)}
    </div>
    <div className="signal-quote">
      <div><span className="micro-label">{entry?.note}</span><strong className="num">{quote?.price != null ? "$" + quote.price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "—"}</strong></div>
      <span className={"num " + (quote?.changePercent == null ? "text-ink-faint" : quote.changePercent >= 0 ? "text-up" : "text-down")}>{fmtPercent(quote?.changePercent ?? null)}</span>
    </div>
    {values.length > 1 ? <svg viewBox="0 0 520 165" role="img" aria-label={"מהלך מחיר " + selected + " בסשן האחרון, בדולרים"} className="signal-chart">
      <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop stopColor="currentColor" stopOpacity=".22"/><stop offset="1" stopColor="currentColor" stopOpacity="0"/></linearGradient></defs>
      {[35,85,138].map((y) => <line key={y} x1="0" x2="520" y1={y} y2={y} stroke="var(--color-line)" strokeDasharray="3 6"/>)}
      <path d={path + " L508,162 L12,162 Z"} fill={"url(#" + id + ")"}/>
      <path key={selected} className="signal-line" d={path} fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinejoin="round"/>
      <circle cx={points.at(-1)?.[0]} cy={points.at(-1)?.[1]} r="3.5" fill="currentColor"/>
      <text x="9" y="17" fill="var(--color-ink-faint)" fontSize="11">{max.toFixed(2)}</text>
      <text x="9" y="157" fill="var(--color-ink-faint)" fontSize="11">{min.toFixed(2)}</text>
    </svg> : <div className="signal-empty">מהלך המסחר אינו זמין כרגע</div>}
    <div className="signal-source"><span>גרף: Yahoo · נרות 5 דקות</span><span>ציטוט: Finnhub · {timestamp ?? "לא זמין"}</span></div>
    <p className="signal-snapshot">תמונת מצב בטעינת העמוד · זמן ישראל</p>
    <Link href="/#market-data" className="signal-link">לכל המדדים והחברות <span aria-hidden="true">←</span></Link>
  </section>;
}
