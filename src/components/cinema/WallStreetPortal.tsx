"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { LiveQuote } from "@/lib/use-live-ticks";

export function WallStreetPortal({quotes,status}:{quotes:Record<string,LiveQuote>;status:string}) {
  const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let disposed=false,world:Awaited<ReturnType<typeof import("./market-world").createMarketWorld>>|undefined,resize:ResizeObserver|undefined;
    const state={progress:0};const context=gsap.context(()=>{},root);
    gsap.registerPlugin(ScrollTrigger);
    const draw=()=>world?.render(state.progress);
      context.add(()=>{
        const timeline=gsap.timeline({scrollTrigger:{trigger:root.current,start:()=>innerWidth<800?"top 136px":"top 106px",refreshPriority:10,end:()=>"+="+(innerWidth<800?1000:1800),pin:root.current?.querySelector(".wall-street-stage"),scrub:.65,invalidateOnRefresh:true}});
        timeline.to(state,{progress:1,duration:3,ease:"none",onUpdate:draw},0)
          .to(".portal-opening",{yPercent:-70,scale:1.2,autoAlpha:0,duration:.6},.12)
          .fromTo(".portal-crossing",{y:80,autoAlpha:0},{y:0,autoAlpha:1,duration:.3},1.48)
          .to(".portal-crossing",{y:-70,autoAlpha:0,duration:.3},2.05)
          .fromTo(".portal-arrival",{y:80,autoAlpha:0},{y:0,autoAlpha:1,duration:.4},2.4)
          .to(".portal-progress i",{scaleX:1,duration:3,ease:"none"},0);
      });ScrollTrigger.refresh();
    import("./market-world").then(async({createMarketWorld})=>{
      if(!canvas.current||disposed)return;
      try{world=await createMarketWorld(canvas.current,quotes);}catch{context.revert();return;}
      if(disposed){world.dispose();return;}
      root.current?.setAttribute("data-webgl","true");
      resize=new ResizeObserver(()=>{world?.resize();draw();});resize.observe(canvas.current);
      draw();
    });
    return()=>{disposed=true;context.revert();resize?.disconnect();world?.dispose();};
  },[quotes]);
  return <section ref={root} className="wall-street-portal" aria-label="כניסה לעולם שוק ההון"><div className="wall-street-stage">
    <Image className="portal-fallback" src="/hero/wall-street.webp" alt="הבורסה בניו יורק ורחוב וול סטריט, מהתמונה שסופקה" fill priority sizes="100vw"/>
    <canvas ref={canvas} aria-hidden="true" className="portal-canvas"/><div className="portal-shade"/>
    <div className="portal-top"><span>NEW YORK / WALL STREET</span><a href="#market-data">ישר לשוק עכשיו ↙</a></div>
    <div className="portal-opening"><span className="portal-eyebrow">WELCOME TO MARKET</span><h1>מאחורי כל מחיר,<br/><em>יש עולם.</em></h1><p>היכנסו לשוק ההון. גלו מה זז, למה זה קורה,<br/>ואיפה מתחיל המחקר שלכם.</p><a href="#market-data">לגלות את השוק <span>↓</span></a></div>
    <div className="portal-crossing"><span>BEYOND THE PRICE</span><h2>לא רק לראות.<br/>להבין מבפנים.</h2></div>
    <div className="portal-arrival"><span>YOUR FINANCIAL WORLD</span><h2>חברות. סיפורים.<br/>החלטות טובות יותר.</h2><Link href="/research">לפתוח מחקר ↖</Link><a href="#market-data">השוק עכשיו ↓</a></div>
    <div className="portal-bottom"><span>גללו כדי להיכנס דרך הדלת</span><span>{status} · צילום נתונים</span><span>המחשה מרחבית · לא רצפת מסחר אמיתית</span></div><div className="portal-progress"><i/></div>
  </div></section>;
}
