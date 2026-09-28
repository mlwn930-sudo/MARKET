"use client";
import Link from "next/link";
import type { RowSeed } from "@/components/MarketDeck";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { CompanyMark } from "./MarketNow";
import { Sparkline } from "@/components/Sparkline";
import { KineticHeading } from "@/components/motion/FinancialMotion";
import { useState } from "react";
import { ScrollScene, ScrollProgress, SceneBridge } from "@/components/motion/ScrollScene";
import type { EnrichedArticle } from "@/lib/news-shape";
const stages=["האירוע","המשמעות","המחקר"];
export function ContextJourney({articles,rows,quotes}:{articles:EnrichedArticle[];rows:RowSeed[];quotes:Record<string,LiveQuote>}) {
  const [selected,setSelected]=useState(0);
  const article=articles[selected];
  const company=rows.find(row=>article?.tickers.includes(row.symbol));
  const quote=company?quotes[company.symbol]:undefined;
  if(!article)return <section className="context-empty"><h2>החדשות אינן זמינות כרגע</h2><Link href="/research">להמשיך למחקר חברה ←</Link></section>;
  return <div className="context-journey context-cinema"><SceneBridge from="ראינו את התנועה" to="עכשיו מבינים את ההקשר"/><div className="compact-heading"><div><span className="micro-label">THE INTELLIGENCE LENS</span><h2 id="context-title">כותרת אחת. שלוש שכבות.</h2></div><Link href="/news">כל החדשות ↖</Link></div><div className="story-select" aria-label="בחירת סיפור">{articles.map((a,i)=><button key={a.url} aria-pressed={selected===i} onClick={()=>setSelected(i)}><small>{a.domain}</small><span>{a.title}</span></button>)}</div>
    <ScrollScene label="מהאירוע לתזה">{({stage,goTo,ready})=><div className="scene-viewport"><ScrollProgress stage={stage} onChange={goTo} labels={stages}/><div className="scene-composition">
      <div className="scene-object-space"><div className="scene-depth-sheet" aria-hidden="true"/><article className="scene-object evidence-sheet"><div className="evidence-top"><span>MARKET / INTELLIGENCE FILE</span><span>0{selected+1}</span></div>{company&&<div className="scene-company-anchor"><CompanyMark symbol={company.symbol}/><div><strong dir="ltr">{company.name}</strong><small>חברה המוזכרת בסיקור · {company.symbol}</small></div><Sparkline points={company.trail} direction="flat" className="anchor-trail"/><span className="num">{quote?.price!=null?"$"+quote.price.toFixed(2):"—"}<small>צילום נתון</small></span></div>}<div className="scene-object-window"><div className="scene-object-track">
        <div className="scene-object-panel" inert={ready && stage!==0}><span className="scene-object-label">THE EVENT</span><h3>{article.title}</h3><div className="source-meta"><span>{article.domain}</span><time>{article.seenAt?new Date(article.seenAt).toLocaleDateString("he-IL"):"ללא מועד מאומת"}</time></div><a href={article.url} target="_blank" rel="noopener noreferrer">לכתבה המקורית ↗</a></div>
        <div className="scene-object-panel" inert={ready && stage!==1}><span className="scene-object-label">THE TRANSMISSION</span><h3>איך אירוע הופך להשפעה עסקית?</h3><div className="transmission-map"><span>האירוע</span><i>↓</i><span>הכנסות / עלויות / תחרות</span><i>↓</i><span>ציפיות ותמחור</span></div><small>מסגרת בדיקה — אינה הוכחה לקשר סיבתי</small></div>
        <div className="scene-object-panel" inert={ready && stage!==2}><span className="scene-object-label">THE RESEARCH FILE</span><h3>רעיון שאפשר לבחון.</h3><ol className="scene-checklist"><li>מה תומך בהנחה?</li><li>מה יכול להפריך אותה?</li><li>מה נבדוק בעדכון הבא?</li></ol><Link href="/watchlist">לפתוח רשימת מעקב ←</Link></div>
      </div></div><div className="scene-object-footer"><span>{article.domain}</span><span>מקור → הקשר → תזה</span></div></article></div>
      <div className="scene-narrative-window"><div className="scene-narrative-track">
        <article className="scene-reading context-step" inert={ready && stage!==0} data-active={stage===0} id="context-step-0"><span className="scene-large-number" aria-hidden="true">01</span><span className="micro-label">WHAT HAPPENED</span><h3><KineticHeading>מתחילים במה שידוע.</KineticHeading></h3><p>{article.analysis?.summary||article.excerpt||"אין תקציר זמין. קראו את המקור לפני הסקת מסקנות."}</p><small>{article.analysis?"תקציר בסיוע AI · יש לאמת מול המקור":"תקציר המפרסם"}</small></article>
        <article className="scene-reading context-step" inert={ready && stage!==1} data-active={stage===1} id="context-step-1"><span className="scene-large-number" aria-hidden="true">02</span><span className="micro-label">WHY IT MATTERS</span><h3><KineticHeading>מה השתנה בעסק?</KineticHeading></h3><p>{article.analysis?.impact||"בדקו האם האירוע משנה הכנסות, עלויות או יתרון תחרותי. אין כאן מסקנה מאומתת לגבי ההשפעה הפיננסית."}</p><small>פרשנות בסיוע AI, לא עובדה או המלצה. סיקור אינו הוכחה לסיבת תנועת מחיר.</small></article>
        <article className="scene-reading context-step" inert={ready && stage!==2} data-active={stage===2} id="context-step-2"><span className="scene-large-number" aria-hidden="true">03</span><span className="micro-label">WHAT TO RESEARCH</span><h3><KineticHeading>עכשיו שואלים שאלה טובה יותר.</KineticHeading></h3><p>מה כבר מגולם בציפיות? השוו את הטענה לדוח האחרון, חפשו הסבר חלופי וקבעו איזו ראיה תשנה את דעתכם.</p><div className="context-actions">{article.tickers.slice(0,3).map(t=><Link key={t} href={`/company/${t}`}>מחקר {t} ↖</Link>)}<Link href="/research">לפתוח מחקר ←</Link></div></article>
      </div></div></div><div className="scene-bottom"><span>גללו בין השכבות, או בחרו שלב למעלה</span><Link href="/learn">ללמוד איך בונים תזה ↖</Link></div></div>}</ScrollScene>
  </div>;
}
