"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect,useRef,useState } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import type { LiveQuote } from "@/lib/use-live-ticks";
import { PRODUCTS } from "./product-catalog";

export function WallStreetPortal({quotes,status}:{quotes:Record<string,LiveQuote>;status:string}) {
  const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null),trigger=useRef<ScrollTrigger|null>(null);
  const [active,setActive]=useState(-1);
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let disposed=false,world:Awaited<ReturnType<typeof import("./market-world").createMarketWorld>>|undefined,resize:ResizeObserver|undefined,current=-1;
    const state={progress:0};const context=gsap.context(()=>{},root);gsap.registerPlugin(ScrollTrigger);
    const draw=()=>{world?.render(state.progress);const next=state.progress<.19?-1:Math.min(6,Math.floor((state.progress-.19)/.79*7));if(next!==current){current=next;setActive(next);}root.current?.style.setProperty("--product-detail",String(gsap.utils.clamp(0,1,(((state.progress-.19)/.79*7)%1-.25)*5)));};
    context.add(()=>{
      const timeline=gsap.timeline({scrollTrigger:{trigger:root.current,start:()=>innerWidth<800?"top 136px":"top 106px",refreshPriority:10,end:()=>"+="+(innerWidth<800?2600:3400),pin:root.current?.querySelector(".wall-street-stage"),scrub:.35,invalidateOnRefresh:true}});
      trigger.current=timeline.scrollTrigger??null;
      timeline.to(state,{progress:1,duration:1,ease:"none",onUpdate:draw},0)
        .to(".portal-opening",{yPercent:-45,scale:1.08,autoAlpha:0,duration:.075},.015)
        .to(".portal-progress i",{scaleX:1,duration:1,ease:"none"},0);
    });ScrollTrigger.refresh();
    import("./market-world").then(async({createMarketWorld})=>{
      if(!canvas.current||disposed)return;
      try{world=await createMarketWorld(canvas.current,quotes);}catch{context.revert();setActive(-1);return;}
      if(disposed){world.dispose();return;}
      root.current?.setAttribute("data-webgl","true");resize=new ResizeObserver(()=>{world?.resize();draw();});resize.observe(canvas.current);draw();
    });
    return()=>{disposed=true;trigger.current=null;context.revert();resize?.disconnect();world?.dispose();};
  },[quotes]);
  const product=active>=0?PRODUCTS[active]:null;
  const goTo=(i:number)=>{const t=trigger.current;if(t)window.scrollTo({top:t.start+(t.end-t.start)*(.19+.79*(i+.15)/7),behavior:"smooth"});};
  return <section ref={root} className="wall-street-portal product-portal" data-company={product?.symbol??"entrance"} aria-label="כניסה לעולם שוק ההון"><div className="wall-street-stage">
    <Image className="portal-fallback" src="/hero/exchange-closed.webp" alt="הדמיית הכניסה לוול סטריט שסופקה" fill priority sizes="100vw"/>
    <canvas ref={canvas} aria-hidden="true" className="portal-canvas"/><div className="portal-shade"/>
    <div className="portal-top"><span>WALL STREET / INSIDE THE COMPANIES</span><a href="#market-data">ישר לשוק עכשיו ↙</a></div>
    <div className="portal-opening"><span className="portal-eyebrow">WELCOME TO MARKET</span><h1>הדלת לשוק.<br/><em>העולם שבפנים.</em></h1><p>מהמוצרים שאתם מכירים<br/>אל החברות שמניעות את השוק.</p><a href="#market-data">לשוק עכשיו <span>↙</span></a></div>
    {product&&<div className="product-intelligence" key={product.symbol} style={{"--company-color":product.color} as React.CSSProperties}>
      <div className="product-identity"><Image src={`/companies/${product.symbol}.svg`} alt="" width={40} height={40}/><span dir="ltr">{product.name}<small>{product.symbol} · {active+1} / 7</small></span></div>
      <h2>{product.product}</h2>
      {active<6?<><ol className="product-parts">{product.parts.map((part,i)=><li key={part}><b>0{i+1}</b>{part}</li>)}</ol><small className="product-disclaimer">המחשת רכיבים · לא מפרט או פירוק הנדסי של דגם מסוים</small><Link href={`/company/${product.symbol}`}>מהמוצר למחקר החברה ↙</Link></>:<a href="#market-data">נכנסים לשוק עכשיו ↙</a>}
    </div>}
    <nav className="product-stops" aria-label="חברות במסע">{PRODUCTS.map((p,i)=><button type="button" key={p.symbol} aria-current={active===i?"step":undefined} onClick={()=>goTo(i)}>{p.symbol}</button>)}</nav>
    <div className="portal-bottom"><span>גללו · גלו מה נמצא בפנים</span><span>{status} · צילום נתונים</span><span>הדמיה מרחבית — לא רצפת מסחר אמיתית</span></div><div className="portal-progress"><i/></div>
  </div></section>;
}
