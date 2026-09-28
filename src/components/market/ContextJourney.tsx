"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { EnrichedArticle } from "@/lib/news-shape";
const stages=["מה קרה","למה זה משנה","מה לבדוק עכשיו"];
/** One source stays on the desk while the reader moves from evidence to interpretation. */
export function ContextJourney({articles}:{articles:EnrichedArticle[]}) {
  const root=useRef<HTMLElement>(null);
  const [selected,setSelected]=useState(0);
  const [stage,setStage]=useState(0);
  const [ready,setReady]=useState(false);
  const article=articles[selected];
  useEffect(()=>{
    setReady(true);
    gsap.registerPlugin(ScrollTrigger);
    const media=gsap.matchMedia();
    media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)",()=>{
      const ctx=gsap.context(()=>{
        gsap.fromTo(".evidence-sheet",{rotateY:-7,rotateX:4,z:-80,x:24},{rotateY:0,rotateX:0,z:0,x:0,ease:"none",scrollTrigger:{trigger:root.current,start:"top 85%",end:"top 25%",scrub:.5}});
        gsap.to(".context-progress",{scaleX:1,ease:"none",scrollTrigger:{trigger:root.current,start:"top 60%",end:"bottom 45%",scrub:true}});
        gsap.utils.toArray<HTMLElement>(".context-step").forEach((el,i)=>ScrollTrigger.create({trigger:el,start:"top 58%",end:"bottom 58%",onEnter:()=>setStage(i),onEnterBack:()=>setStage(i)}));
      },root);
      return()=>ctx.revert();
    });
    return()=>media.revert();
  },[]);
  if(!article) return <section className="context-empty"><h2>מחברים בין הנתון לסיפור</h2><p>החדשות אינן זמינות כרגע. אפשר להמשיך למחקר חברה או למפת הסקטורים.</p><Link href="/research">לפתוח מחקר ←</Link></section>;
  return <section ref={root} data-ready={ready} className="context-journey" aria-labelledby="context-title"><div className="compact-heading"><div><span className="micro-label">02 / WHY IT MATTERS</span><h2 id="context-title">מהכותרת להבנה.</h2></div><Link href="/news">כל החדשות ↖</Link></div>
    <div className="story-select" aria-label="בחירת סיפור">{articles.map((a,i)=><button key={a.url} aria-pressed={selected===i} onClick={()=>{setSelected(i);setStage(0);}}><small>{a.domain}</small><span>{a.title}</span></button>)}</div>
    <div className="context-grid"><div className="evidence-space"><article className="evidence-sheet"><div className="evidence-top"><span>MARKET / SOURCE NOTE</span><span>0{selected+1}</span></div><p className="source-label">המקור נשאר מול העיניים</p><h3>{article.title}</h3><div className="source-meta"><span>{article.domain}</span><time>{article.seenAt?new Date(article.seenAt).toLocaleDateString("he-IL"):"ללא מועד מאומת"}</time></div><a href={article.url} target="_blank" rel="noopener noreferrer">לכתבה המקורית ↗</a><div className="context-progress"/><div className="evidence-stages">{stages.map((s,i)=><a href={`#context-step-${i}`} key={s} aria-current={stage===i?"step":undefined} onClick={(event)=>{setStage(i);if(window.matchMedia("(max-width: 800px)").matches)event.preventDefault();}}><b>0{i+1}</b>{s}</a>)}</div><p className="data-caption">סיקור חדשותי אינו הוכחה לסיבת תנועת המחיר.</p></article></div>
    <div className="context-steps">
      <article className="context-step" data-active={stage===0} id="context-step-0"><span className="step-number">01</span><div><h3>מה קרה?</h3><p>{article.analysis?.summary||article.excerpt||"למקור הזה אין תקציר זמין. קראו את הכתבה לפני הסקת מסקנה."}</p><small>{article.analysis?"תקציר בסיוע AI · יש לאמת מול המקור":"תקציר המפרסם"}</small></div></article>
      <article className="context-step" data-active={stage===1} id="context-step-1"><span className="step-number">02</span><div><h3>איך זה עשוי להשפיע?</h3><p>{article.analysis?.impact||"בדקו האם האירוע משנה הכנסות, עלויות או יתרון תחרותי. ללא ניתוח מאומת, אין כאן מסקנה על השפעה פיננסית."}</p><small>פרשנות, לא עובדה או המלצת השקעה</small></div></article>
      <article className="context-step" data-active={stage===2} id="context-step-2"><span className="step-number">03</span><div><h3>מה צריך לבדוק עכשיו?</h3><p>השוו את הטענה לדוח האחרון. מה כבר כלול בציפיות, איזו ראיה יכולה להפריך את הרעיון, ומה יהיה המבחן בעדכון הבא?</p><div className="context-actions">{article.tickers.slice(0,3).map(t=><Link key={t} href={`/company/${t}`}>מחקר {t} ↖</Link>)}<Link href="/research">כלי המחקר ←</Link></div></div></article>
    </div></div>
  </section>;
}
