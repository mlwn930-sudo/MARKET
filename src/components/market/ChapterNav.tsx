"use client";

import { useEffect, useRef, useState } from "react";

export type Chapter = { id: string; label: string; number?: string };

/** Native anchor navigation still works before hydration and with motion off. */
export function ChapterNav({ chapters, label = "ניווט בעמוד" }: { chapters: Chapter[]; label?: string }) {
  const [active, setActive] = useState(chapters[0]?.id ?? "");
  const nav = useRef<HTMLElement>(null);
  useEffect(() => {
    const sections = chapters.map(({ id }) => document.getElementById(id)).filter((el): el is HTMLElement => Boolean(el));
    if (!sections.length || !("IntersectionObserver" in window)) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
      if (visible[0]) setActive(visible[0].target.id);
    }, { rootMargin: "-145px 0px -55% 0px", threshold: 0 });
    sections.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [chapters]);
  return <nav ref={nav} className="chapter-nav" aria-label={label}>
    {chapters.map((chapter, index) => <a key={chapter.id} href={"#" + chapter.id} aria-current={active === chapter.id ? "location" : undefined} onClick={() => setActive(chapter.id)}>
      <span className="num">{chapter.number ?? String(index + 1).padStart(2, "0")}</span>
      <span>{chapter.label}</span>
    </a>)}
  </nav>;
}
