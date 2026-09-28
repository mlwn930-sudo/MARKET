"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
const tabs = [{href:"/", label:"לגלות", mark:"01"}, {href:"/launch/ttwo", label:"GTA VI", mark:"VI"}, {href:"/watchlist", label:"המעקב שלי", mark:"☆"}];
export function MobileTabs() {
  const path = usePathname();
  return <nav className="studio-mobile-tabs" aria-label="ניווט תחתון">{tabs.map((tab) => <Link key={tab.href} href={tab.href} aria-current={(tab.href === "/" ? path === "/" : path.startsWith(tab.href)) ? "page" : undefined}><span aria-hidden="true">{tab.mark}</span><bdi>{tab.label}</bdi></Link>)}</nav>;
}
