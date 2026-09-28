"use client";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
const chapters = [
  { word: "נתון.", label: "01 / DATA", title: "מחיר הוא רק ההתחלה.", text: "תנועה בגרף היא שאלה. כדי להבין אותה, צריך לדעת מה השתנה בעסק.", href: "/#market-data", link: "לנתוני השוק", sheet: "OBSERVATION", detail: "מקור · זמן · שינוי", lines: ["מחיר ותנועת מסחר", "האירוע שמאחורי התנועה", "מה ידוע — ומה עוד חסר"] },
  { word: "הקשר.", label: "02 / CONTEXT → INTELLIGENCE", title: "מחברים בין הסיבות.", text: "מאירוע אחד אל החברה, המתחרות ושרשרת הערך. כאן מתחיל הסיפור שהמספר לבדו לא מספר.", href: "/intel", link: "לחדר המודיעין", sheet: "INTERPRETATION", detail: "אירוע → עסק → השפעה", lines: ["המנגנון הכלכלי", "הראיות שתומכות בו", "הסבר חלופי שצריך לבדוק"] },
  { word: "עמדה.", label: "03 / THESIS → MONITOR", title: "רעיון שאפשר לבחון.", text: "מנסחים מה צריך לקרות, מה יכול להפריך את ההנחה ומה לבדוק בדוח הבא. משם ממשיכים למעקב.", href: "/research", link: "לפתוח מחקר", sheet: "INVESTMENT THESIS", detail: "הנחה · סיכון · מבחן", lines: ["מה כבר מגולם בציפיות", "מה ישנה את המסקנה", "העדכון הבא ברשימת המעקב"] },
];
export function DiscoveryJourney() {
  const root = useRef<HTMLElement>(null);
  useEffect(() => {
    gsap.registerPlugin(ScrollTrigger);
    const media = gsap.matchMedia();
    media.add("(min-width: 900px) and (prefers-reduced-motion: no-preference)", () => {
      gsap.utils.toArray<HTMLElement>(".discovery-chapter", root.current).forEach((panel) => {
        gsap.fromTo(panel.querySelector(".research-paper"), { rotateY: -18, rotateX: 9, z: -120, y: 65 }, { rotateY: 0, rotateX: 0, z: 0, y: -20, ease: "none", scrollTrigger: { trigger: panel, start: "top 85%", end: "bottom 20%", scrub: 0.6 } });
        gsap.fromTo(panel.querySelector(".discovery-word"), { xPercent: -7 }, { xPercent: 7, ease: "none", scrollTrigger: { trigger: panel, start: "top bottom", end: "bottom top", scrub: true } });
      });
    }, root);
    return () => media.revert();
  }, []);
  return <section ref={root} className="discovery" aria-label="מהנתון לתזה">
    <div className="discovery-intro"><span className="micro-label">A DIFFERENT WAY TO READ THE MARKET</span><p>לא עוד נתונים.<br />דרך לראות מה הם אומרים.</p></div>
    {chapters.map((chapter, i) => <article className="discovery-chapter" key={chapter.label}>
      <div className="discovery-word" aria-hidden="true">{chapter.word}</div>
      <div className="discovery-copy"><span className="micro-label" dir="ltr">{chapter.label}</span><h2>{chapter.title}</h2><p>{chapter.text}</p><Link href={chapter.href}>{chapter.link} <span aria-hidden="true">←</span></Link></div>
      <div className="paper-space"><div className="research-paper"><div className="paper-top" dir="ltr"><span>MARKET / FIELD NOTES</span><span>0{i + 1}</span></div><h3 dir="ltr">{chapter.sheet}</h3><p>{chapter.detail}</p><div className="paper-diagram" aria-hidden="true"><span/><span/><span/></div><ol>{chapter.lines.map(line => <li key={line}>{line}</li>)}</ol><footer>מסגרת מחקר · לא נתוני מסחר</footer></div></div>
    </article>)}
  </section>;
}
