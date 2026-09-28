"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function MarketEntrance({ status, detail }: {status: string; detail: string | null}) {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(prefers-reduced-motion: no-preference)", () => {
      gsap.fromTo(".entrance-image", {scale:1.06}, {scale:1, duration:1.6, ease:"power2.out"});
      gsap.to(".entrance-image", {yPercent:15, ease:"none", scrollTrigger:{trigger:root.current,start:"top top",end:"bottom top",scrub:true}});
      gsap.from(".entrance-title span", {y:45, opacity:0, stagger:.12,duration:1, ease:"power3.out"});
    }, root);
    return () => media.revert();
  }, []);
  return <section ref={root} className="market-entrance">
    <div className="entrance-image"><Image src="/hero/market-city.webp" fill priority sizes="100vw" alt="קו הרקיע של העיר בשעת ערב" className="object-cover" /></div>
    <div className="entrance-scrim" aria-hidden="true" />
    <div className="entrance-topline"><span dir="ltr">MARKET / FINANCIAL INTELLIGENCE</span><span>{status}</span></div>
    <div className="entrance-copy"><span className="entrance-eyebrow">לכל תנועה יש סיפור.</span><h1 className="entrance-title"><span>השוק זז.</span><span>תבינו למה.</span></h1><p>מסע בין החברות, הרעיונות והכוחות<br className="desktop-break" /> שמעצבים את ההחלטה הבאה.</p><a href="#featured-story" className="entrance-cta">לגלות את הסיפור <span aria-hidden="true">↙</span></a></div>
    <div className="entrance-bottom"><a href="#market-data">ישר לתמונת השוק <span aria-hidden="true">↓</span></a><p>{detail ?? "מקורות גלויים. הנחות מפורשות. מחקר שאפשר לבדוק."}</p><span dir="ltr">SCROLL TO DISCOVER</span></div>
    <Link href="/launch/ttwo" className="entrance-story-tag"><span dir="ltr">FEATURED / 001</span><strong>GTA VI</strong><span>כשהתרבות פוגשת את ההון ↖</span></Link>
  </section>;
}
