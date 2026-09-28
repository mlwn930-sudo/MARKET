"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
export function ResearchDock({macro,monitor}:{macro:ReactNode;monitor:ReactNode}) {
  const [tab,setTab]=useState("research");
  return <section className="research-dock" aria-label="הצעד הבא במחקר"><div className="dock-heading"><span className="micro-label">FROM INTELLIGENCE TO ACTION</span><h2>מכאן ממשיכים לעומק.</h2><div className="dock-tabs">{[["research","לחקור"],["macro","תמונת המאקרו"],["monitor","המעקב שלי"]].map(([key,label])=><button key={key} aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</div></div><div className="dock-content">{tab==="research"?<div className="research-paths">{[["/research","01","מחקר חברה","מה העסק עושה, מה שווה לבדוק ומה חסר בתזה."],["/compare","02","השוואה למתחרות","בדקו תמחור ואיכות בתוך אותו סקטור."],["/institutional","03","כסף מוסדי","מי מחזיק, מה השתנה ומה מגבלות המידע."]].map(([href,n,title,text])=><Link href={href} key={href}><span>{n}</span><h3>{title} ↖</h3><p>{text}</p></Link>)}</div>:tab==="macro"?macro:<>{monitor}<Link className="desk-deeper" href="/watchlist">לכל רשימת המעקב ←</Link></>}</div></section>;
}
