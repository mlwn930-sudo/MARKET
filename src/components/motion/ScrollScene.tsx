"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

type SceneState = { ready:boolean; stage:number; goTo:(stage:number)=>void };
/** Native scrolling, bounded pinning and explicit reading stops. No wheel interception. */
export function ScrollScene({children,label}:{children:(scene:SceneState)=>ReactNode;label:string}) {
  const root=useRef<HTMLElement>(null);
  const trigger=useRef<ScrollTrigger|null>(null);
  const [stage,setStage]=useState(0);
  const [ready,setReady]=useState(false);
  useEffect(()=>{
    setReady(true);
    gsap.registerPlugin(ScrollTrigger);
    const media=gsap.matchMedia();
    media.add("(min-width: 1000px) and (min-height: 850px) and (prefers-reduced-motion: no-preference)",()=>{
      const node=root.current;
      if(!node)return;
      node.dataset.pinned="true";
      const context=gsap.context(()=>{
        const timeline=gsap.timeline({scrollTrigger:{trigger:node,pin:node.querySelector<HTMLElement>(".scene-viewport"),start:"top 125px",end:()=>"+="+Math.min(1050,innerHeight),scrub:.55,invalidateOnRefresh:true,onUpdate:self=>setStage(Math.min(2,Math.floor(self.progress*3)))}});
        trigger.current=timeline.scrollTrigger??null;
        timeline.to(".scene-object",{rotateY:-12,rotateX:6,xPercent:-12,scale:.88,duration:.8,ease:"power2.inOut"},.55)
          .to(".scene-narrative-track",{yPercent:-100/3,duration:.35,ease:"power2.inOut"},1)
          .to(".scene-object-track",{yPercent:-100/3,duration:.35,ease:"power2.inOut"},1)
          .to(".scene-depth-sheet",{x:35,y:24,rotateZ:-4,duration:.6},.65)
          .to(".scene-object",{rotateY:0,rotateX:0,xPercent:0,scale:1,duration:.65,ease:"power2.inOut"},1.8)
          .to(".scene-narrative-track",{yPercent:-200/3,duration:.35,ease:"power2.inOut"},2)
          .to(".scene-object-track",{yPercent:-200/3,duration:.35,ease:"power2.inOut"},2)
          .to(".scene-depth-sheet",{x:12,y:12,rotateZ:0,duration:.6},1.8)
          .to(".scene-progress-fill",{scaleX:1,duration:3,ease:"none"},0);
      },node);
      return()=>{trigger.current=null;context.revert();delete node.dataset.pinned;};
    });
    return()=>media.revert();
  },[]);
  const goTo=(next:number)=>{
    const current=trigger.current;
    if(current){const positions=[.02,.48,.83];window.scrollTo({top:current.start+(current.end-current.start)*positions[next],behavior:"smooth"});}
    else setStage(next);
  };
  return <section ref={root} className="scroll-scene" data-ready={ready} data-stage={stage} aria-label={label}>{children({stage,goTo,ready})}</section>;
}

export function ScrollProgress({stage,onChange,labels}:{stage:number;onChange:(stage:number)=>void;labels:string[]}) {
  return <nav className="scene-stops" aria-label="שלבי הסיפור">{labels.map((label,i)=><button type="button" key={label} aria-current={stage===i?"step":undefined} onClick={()=>onChange(i)}><span>0{i+1}</span>{label}</button>)}<div className="scene-progress"><i className="scene-progress-fill"/></div></nav>;
}

export function SceneBridge({from,to}:{from:string;to:string}) {
  return <div className="scene-bridge"><span>{from}</span><i aria-hidden="true"/><span>{to}</span><b aria-hidden="true">↓</b></div>;
}
