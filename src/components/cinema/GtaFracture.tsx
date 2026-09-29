"use client";
import Image from "next/image";
import { useEffect,useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function GtaFracture({release}:{release:string|null}) {
  const root=useRef<HTMLElement>(null),canvas=useRef<HTMLCanvasElement>(null);
  useEffect(()=>{
    if(matchMedia("(prefers-reduced-motion: reduce)").matches)return;
    let disposed=false,world:Awaited<ReturnType<typeof import("./fracture-world").createFractureWorld>>|undefined;
    let resize:ResizeObserver|undefined;
    const state={intro:0,scroll:0};
    const context=gsap.context(()=>{},root);
    gsap.registerPlugin(ScrollTrigger);
    const draw=()=>world?.render(state.intro*(1-gsap.utils.clamp(0,1,(state.scroll-.08)/.66)));
      context.add(()=>{

        gsap.to(state,{scroll:1,ease:"none",onUpdate:()=>{draw();gsap.set(".impact-marks",{autoAlpha:1-state.scroll});},scrollTrigger:{trigger:root.current,start:()=>innerWidth<800?"top 136px":"top 106px",refreshPriority:10,end:()=>"+="+(innerWidth<800?600:1100),pin:root.current?.querySelector(".fracture-stage"),scrub:.45,invalidateOnRefresh:true}});
        gsap.to(".fracture-title",{autoAlpha:0,yPercent:-160,rotateX:45,scale:.85,ease:"none",scrollTrigger:{trigger:root.current,start:"top 80px",end:"+=450",scrub:.4}});
        gsap.fromTo(".fracture-return",{y:70,autoAlpha:0},{y:0,autoAlpha:1,scrollTrigger:{trigger:root.current,start:"top -420px",end:"+=250",scrub:.4}});
      });ScrollTrigger.refresh();
    import("./fracture-world").then(async({createFractureWorld})=>{
      if(!canvas.current||disposed)return;
      try{world=await createFractureWorld(canvas.current);}catch{context.revert();return;}
      if(disposed){world.dispose();return;}
      root.current?.setAttribute("data-webgl","true");
      resize=new ResizeObserver(()=>{world?.resize();draw();});resize.observe(canvas.current);
      context.add(()=>{gsap.to(state,{intro:.52,duration:1.8,delay:.5,ease:"steps(3)",onUpdate:draw});});
      draw();
    });
    return()=>{disposed=true;context.revert();resize?.disconnect();world?.dispose();};
  },[]);
  return <header ref={root} className="gta-fracture" aria-label="GTA VI: מהסיפור להשקעה"><div className="fracture-stage">
    <Image className="fracture-fallback" src="/hero/rockstar-jason-lucia.webp" alt="GTA VI — האיור הרשמי של ג׳ייסון ולוסיה" fill priority sizes="100vw"/>
    <canvas ref={canvas} className="fracture-canvas" aria-hidden="true"/><div className="fracture-shade"/><div className="impact-marks" aria-hidden="true"><i/><i/><i/></div>
    <div className="fracture-top"><span>MARKET STORIES / TAKE-TWO</span><a href="#investment">למחקר הפיננסי ↙</a></div>
    <div className="fracture-title"><span>VICE CITY. WALL STREET.</span><h1 className="gta-cover-title" dir="ltr">GTA <em>VI</em></h1><p>הסיפור מתפרק.<br/>התזה צריכה להחזיק.</p></div>
    <div className="fracture-return"><span>FROM CULTURE TO CAPITAL</span><h2>עולם אחד.<br/>מיליארדי ציפיות.</h2><p>גללו כדי להרכיב את התמונה — מהמשחק אל החברה שמאחוריו.</p><a href="#gta-world">אל הסיפור של Take-Two ↓</a></div>
    <div className="fracture-bottom"><span>גללו. שברו את הציפיות. הרכיבו תזה.</span><span>{release??"מועד טרם הוכרז"}</span><span>NASDAQ / TTWO</span></div>
  </div></header>;
}
