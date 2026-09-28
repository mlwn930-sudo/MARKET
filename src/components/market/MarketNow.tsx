"use client";
import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import type { IndexCard, RowSeed } from "@/components/MarketDeck";
import { Sparkline } from "@/components/Sparkline";
import { SignalCanvas } from "./SignalCanvas";
import { fmtPercent } from "@/lib/format";
const logos = new Set(["NVDA","AAPL","AMZN","GOOGL","META","TSLA","AVGO"]);
export function CompanyMark({symbol}:{symbol:string}) {
  return <span className="company-mark">{logos.has(symbol) ? <Image src={`/companies/${symbol}.svg`} alt="" width={25} height={25}/> : <span>{symbol.slice(0,2)}</span>}</span>;
}
export function MarketNow({indices,rows,initial,detail}:{indices:IndexCard[];rows:RowSeed[];initial:Record<string,LiveQuote>;detail:string|null}) {
  const symbols=useMemo(()=>[...indices.map(x=>x.symbol),...rows.map(x=>x.symbol)],[indices,rows]);
  const {quotes}=useLiveTicks(symbols,initial);
  const [view,setView]=useState<"leaders"|"up"|"down">("leaders");
  const displayed=useMemo(()=>view==="leaders"?rows:[...rows].filter(r=>{const change=quotes[r.symbol]?.changePercent;return change!=null&&(view==="up"?change>0:change<0);}).sort((a,b)=>(view==="up"?-1:1)*((quotes[a.symbol]?.changePercent??0)-(quotes[b.symbol]?.changePercent??0))),[view,rows,quotes]);
  return <section className="market-now" id="market-data" aria-label="השוק עכשיו">
    <div className="index-rail">{indices.map(index=>{const q=quotes[index.symbol];return <a key={index.symbol} href="#session-chart" className="index-tile"><span className="index-title" dir="ltr">{index.label}<small>{index.symbol} · ETF</small></span><strong className="num">{q?.price!=null?"$"+q.price.toLocaleString("en-US",{maximumFractionDigits:2,minimumFractionDigits:2}):"—"}</strong><span dir="ltr" className={(q?.changePercent??0)>=0?"text-up":"text-down"}>{fmtPercent(q?.changePercent??null)}</span><Sparkline points={index.intraday} direction={(q?.changePercent??0)>=0?"up":"down"} className="index-spark"/></a>;})}</div>
    <div className="market-workspace">
      <div className="companies-panel"><div className="compact-heading"><div><span className="micro-label">01 / WHAT IS MOVING</span><h2>החברות שבמרכז</h2></div><Link href="/heatmap">מפת השוק ↖</Link></div>
      <div className="market-filters" aria-label="מיון חברות">{([["leaders","במוקד"],["up","עולות"],["down","יורדות"]] as const).map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}<span>מתוך {rows.length} חברות נבחרות</span></div>
      <div className="company-grid">{displayed.slice(0,6).map(row=>{const q=quotes[row.symbol];return <Link href={`/company/${row.symbol}`} className="company-tile" key={row.symbol}><CompanyMark symbol={row.symbol}/><span className="company-name"><strong dir="ltr">{row.name}</strong><small>{row.symbol}</small></span><span className="company-price num"><strong>{q?.price!=null?"$"+q.price.toLocaleString("en-US",{maximumFractionDigits:2}):"—"}</strong><small dir="ltr" className={(q?.changePercent??0)>=0?"text-up":"text-down"}>{fmtPercent(q?.changePercent??null)}</small></span><Sparkline points={row.trail} direction={(q?.changePercent??0)>=0?"up":"down"} className="company-spark"/></Link>;})}</div>
      {!displayed.length&&<p className="data-empty">אין כרגע שינוי מחיר מאומת למיון. אפשר לפתוח את מחקרי החברות בלשונית ״במוקד״.</p>}
      <p className="data-caption">שינוי מול הסגירה הקודמת · קווי החברות: 30 ימי מסחר · Finnhub / Yahoo Finance</p></div>
      <div id="session-chart"><SignalCanvas indices={indices} quotes={quotes} detail={detail}/></div>
    </div>
  </section>;
}
