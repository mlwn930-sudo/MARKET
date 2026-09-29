"use client";
import Image from "next/image";
import { GtaFracture } from "@/components/cinema/GtaFracture";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

const scenes = [
  { label:"01 / THE WORLD", title:<>שני אנשים.<br />עולם של ציפיות.</>, text:"ג׳ייסון ולוסיה. וייס סיטי ומדינת ליאונידה. Rockstar בונה עולם שהקהל רוצה להיכנס אליו — וזאת נקודת הפתיחה, עוד לפני המספרים.", word:"LEONIDA", note:"העולם והדמויות · לפי Rockstar Games" },
  { label:"02 / THE BUSINESS", title:<>מאחורי העולם הזה,<br />יש חברה ציבורית.</>, text:"Rockstar היא חלק מ־Take-Two. לצד GTA נמצאים גם 2K ו־Zynga: משחקי ספורט, מובייל ועולמות מתמשכים. השקעה ב־TTWO היא השקעה בכל העסק.", word:"TTWO", note:"Rockstar Games / 2K / Zynga" },
  { label:"03 / THE INVESTMENT", title:<>משחק גדול.<br />באיזה מחיר?</>, text:"התלהבות היא התחלה. תשואה דורשת יותר: מכירות, רווחיות ותזרים ביחס לציפיות שכבר במחיר. מכאן עוברים מהסיפור אל מה שאפשר לבדוק.", word:"EXPECTATIONS", note:"מסגרת ניתוח · לא תחזית תשואה" },
];

/** Pinning is progressive enhancement; all chapters remain in normal flow on phones. */
export function TakeTwoStory({ release }: {release: string | null}) {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 900px) and (min-height: 620px) and (prefers-reduced-motion: no-preference)", () => {
      const track = root.current?.querySelector<HTMLElement>(".story-track");
      const stage = root.current?.querySelector<HTMLElement>(".story-stage");
      if (!track || !stage) return;
      track.dataset.enhanced = "true";
      const panels = gsap.utils.toArray<HTMLElement>(".story-scene", track);
      gsap.set(panels.slice(1), {autoAlpha:0,y:50});
      const sequence = gsap.timeline({scrollTrigger:{trigger:stage,start:"top 76px",end:"+=200%",pin:true,scrub:.65,invalidateOnRefresh:true}});
      sequence.to(".story-art",{rotateY:-10,rotateZ:-3,scale:.92,duration:1},0)
        .to(panels[0],{autoAlpha:0,y:-35,duration:.3},.7)
        .to(panels[1],{autoAlpha:1,y:0,duration:.3},1)
        .to(".story-art-city",{opacity:0,duration:.5},.8)
        .to(".story-financial",{opacity:1,duration:.5},1)
        .to(".story-art",{rotateY:0,rotateZ:0,scale:1,duration:1},1)
        .to(panels[1],{autoAlpha:0,y:-35,duration:.3},1.7)
        .to(panels[2],{autoAlpha:1,y:0,duration:.3},2)
        .to(".business-layer",{y:(i)=>i * -22,z:(i)=>i * 55,rotateX:16,duration:.9},2)
        .to(".story-progress-fill",{scaleX:1,duration:3,ease:"none"},0);
      return () => { delete track.dataset.enhanced; sequence.kill(); };
    }, root);
    return () => media.revert();
  }, []);
  return <div ref={root} className="take-two-story">
    <GtaFracture release={release}/>
    <section id="gta-world" className="story-track" aria-label="מהעולם של GTA אל Take-Two">
      <div className="story-stage">
        <div className="story-art" aria-hidden="true">
          <div className="story-art-city"><Image src="/hero/rockstar-vice-city.webp" alt="" fill sizes="(max-width:899px) 90vw, 50vw" className="object-cover" /></div>
          <div className="story-financial"><span className="micro-label" dir="ltr">ONE WORLD. A WIDER BUSINESS.</span><div className="business-layer"><span>ROCKSTAR GAMES</span><strong>GTA</strong><small>תרבות → מעורבות</small></div><div className="business-layer"><span>TAKE-TWO INTERACTIVE</span><strong>TTWO</strong><small>מכירות → רווחיות</small></div><div className="business-layer"><span>THE SHAREHOLDER</span><strong>תזרים.</strong><small>השקעה → ערך</small></div></div>
        </div>
        <div className="story-scenes">{scenes.map((scene) => <article key={scene.label} className="story-scene"><span className="micro-label" dir="ltr">{scene.label}</span><h2>{scene.title}</h2><p>{scene.text}</p><div className="story-scene-note">{scene.note}</div><span className="scene-word" dir="ltr" aria-hidden="true">{scene.word}</span></article>)}</div>
        <div className="story-progress" aria-hidden="true"><span className="story-progress-fill"/></div>
      </div>
    </section>
    <div className="story-source"><span>איורים: © Rockstar Games · שימוש מערכתי לדיון בכותר ובחברה. MARKET הוא אתר עצמאי.</span><a href="https://www.rockstargames.com/VI/only-in-leonida" target="_blank" rel="noopener noreferrer">הסיפור במקור ↗</a></div>
  </div>;
}
