"use client";
import { CompanyMark as Mark } from "@/components/CompanyMark";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useLiveTicks, type LiveQuote } from "@/lib/use-live-ticks";
import type { IndexCard, RowSeed } from "@/components/MarketDeck";
import { Sparkline } from "@/components/Sparkline";
import { SignalCanvas } from "./SignalCanvas";
import { COMMAND_EVENT } from "@/components/CommandCenter";
import type { EnrichedArticle } from "@/lib/news-shape";
import type { ScreenResult } from "@/lib/screener";
import { fmtPercent } from "@/lib/format";
/** Re-exported so the homepage keeps one import. The mark itself now
 *  lives in src/components/CompanyMark.tsx and is used site-wide. */
export function CompanyMark({symbol}:{symbol:string}) {
  return <Mark ticker={symbol} size="md"/>;
}
export function MarketNow({indices,rows,initial,detail,articles,picks}:{indices:IndexCard[];rows:RowSeed[];initial:Record<string,LiveQuote>;detail:string|null;articles:EnrichedArticle[];picks:ScreenResult[]}) {
  const symbols=useMemo(()=>[...indices.map(x=>x.symbol),...rows.map(x=>x.symbol)],[indices,rows]);
  const {quotes,flash}=useLiveTicks(symbols,initial);
  const [workspace,setWorkspace]=useState("companies");
  const [selectedIndex,setSelectedIndex]=useState(indices[0]?.symbol??"SPY");
  const [expanded,setExpanded]=useState(false);
  const [view,setView]=useState<"leaders"|"up"|"down">("leaders");

  /* Which session every figure on this board belongs to.
   *
   * Once, on the board, rather than a chip on each of twelve rows: the
   * session is a property of the clock, not of a company, and twelve
   * identical labels would read as decoration rather than as a warning.
   * Taken from the quotes themselves so it cannot disagree with the
   * numbers beside it — if the tape says these are pre-market prints, the
   * label says pre-market. */
  const session=useMemo(()=>{
    for(const q of Object.values(quotes)){
      if(q?.extended&&(q.phase==="pre"||q.phase==="post")) return q.phase;
    }
    return null;
  },[quotes]);
  const displayed=useMemo(()=>view==="leaders"?rows:[...rows].filter(r=>{const change=quotes[r.symbol]?.changePercent;return change!=null&&(view==="up"?change>0:change<0);}).sort((a,b)=>(view==="up"?-1:1)*((quotes[a.symbol]?.changePercent??0)-(quotes[b.symbol]?.changePercent??0))),[view,rows,quotes]);
  return <section className="market-now" id="market-data" aria-label="השוק עכשיו">
    <div className="index-rail">{indices.map(index=>{const q=quotes[index.symbol];return <a key={index.symbol} href="#session-chart" onClick={()=>{setWorkspace("chart");setSelectedIndex(index.symbol);}} className="index-tile"><span className="index-title" dir="ltr">{index.label}<small>{index.symbol} · ETF</small></span><strong className={"num"+(flash[index.symbol]==="up"?" settle-up":flash[index.symbol]==="down"?" settle-down":"")}>{q?.price!=null?"$"+q.price.toLocaleString("en-US",{maximumFractionDigits:2,minimumFractionDigits:2}):"—"}</strong><span dir="ltr" className={(q?.changePercent??0)>=0?"text-up":"text-down"}>{fmtPercent(q?.changePercent??null)}</span><Sparkline points={index.intraday} direction={(q?.changePercent??0)>=0?"up":"down"} className="index-spark"/></a>;})}</div>
    <div className="workspace-switch" aria-label="תצוגת שולחן השוק">{[["companies","חברות"],["news","חדשות"],["signals","רעיונות"],["chart","מדדים"]].map(([key,label])=><button key={key} aria-pressed={workspace===key} onClick={()=>setWorkspace(key)}>{label}</button>)}<button className="workspace-search" onClick={()=>window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}>חיפוש חברה ⌕</button></div>
    <div className="market-workspace terminal-workspace" data-workspace={workspace}>
      <div className="companies-panel"><div className="compact-heading"><div><span className="micro-label">01 / WHAT IS MOVING</span><h2>החברות שבמרכז</h2>{session&&<span className="session-tag board-session">{session==="pre"?"PRE MARKET":"AFTER HOURS"}</span>}</div><Link href="/heatmap">מפת השוק ↖</Link></div>
      <div className="market-filters" aria-label="מיון חברות">{([["leaders","במוקד"],["up","עולות"],["down","יורדות"]] as const).map(([key,label])=><button key={key} aria-pressed={view===key} onClick={()=>setView(key)}>{label}</button>)}<span>מתוך {rows.length} חברות נבחרות</span></div>
      {/* Twelve, not seven. The board reads across sixteen companies now,
          and a list that stops at seven turns a market-wide view back into
          a shortlist of whatever sorted highest. */}
      <div className="company-grid" data-expanded={expanded}>{displayed.slice(0,12).map(row=>{const q=quotes[row.symbol];return <Link href={`/company/${row.symbol}`} className="company-tile" key={row.symbol}><CompanyMark symbol={row.symbol}/><span className="company-name"><strong dir="ltr">{row.name}</strong><small>{row.symbol}</small></span><span className="company-price num"><strong className={flash[row.symbol]==="up"?"settle-up":flash[row.symbol]==="down"?"settle-down":undefined}>{q?.price!=null?"$"+q.price.toLocaleString("en-US",{maximumFractionDigits:2}):"—"}</strong><small dir="ltr" className={(q?.changePercent??0)>=0?"text-up":"text-down"}>{fmtPercent(q?.changePercent??null)}</small></span><Sparkline points={row.trail} direction={(q?.changePercent??0)>=0?"up":"down"} className="company-spark"/></Link>;})}</div>
      {displayed.length>6&&<button className="more-companies" onClick={()=>setExpanded(!expanded)}>{expanded?"פחות חברות ↑":`עוד ${Math.min(displayed.length,12)-6} חברות ↓`}</button>}
      {!displayed.length&&<p className="data-empty">אין כרגע שינוי מחיר מאומת למיון. אפשר לפתוח את מחקרי החברות בלשונית ״במוקד״.</p>}
      <p className="data-caption">שינוי מול הסגירה הקודמת · קווי החברות: 120 ימי מסחר · Finnhub / Yahoo Finance</p></div>
      <div id="session-chart"><SignalCanvas indices={indices} quotes={quotes} detail={detail} selectedSymbol={selectedIndex} onSelect={setSelectedIndex}/></div>
      <aside className="now-news"><div className="compact-heading"><h2>מה חשוב עכשיו</h2><Link href="/news">לפיד ↖</Link></div>{articles.slice(0,6).map((article,i)=><a key={article.url} className="now-headline" href={article.url} target="_blank" rel="noopener noreferrer"><span>0{i+1}</span><div><small>{article.domain} · {article.analysis?.significance==="high"?"השפעה גבוהה לפי הניתוח":"סיקור אחרון"}</small><strong>{article.title}</strong></div></a>)}{!articles.length&&<p className="data-caption">אין כרגע חדשות זמינות.</p>}<a className="desk-deeper" href="#context-title">להבין את ההקשר ↓</a></aside>
      <aside className="now-signals"><div className="compact-heading"><h2>על הרדאר</h2><Link href="/opportunities">לסורק ↖</Link></div>{picks.map(pick=><Link className="now-pick" href={`/company/${pick.company.ticker}`} key={pick.company.ticker}><CompanyMark symbol={pick.company.ticker}/><span><strong>{pick.company.ticker}</strong><small>{pick.sectorLabel}</small></span><b dir="ltr">{pick.score}<small>/{pick.maxScore}</small></b></Link>)}<p className="data-caption">ציון סינון הוא הזמנה למחקר, לא המלצת קנייה.</p><Link className="desk-deeper" href="/research">לחקור חברה ←</Link></aside>
    </div>
  </section>;
}
