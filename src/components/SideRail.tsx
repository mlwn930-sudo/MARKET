"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMMAND_EVENT } from "./CommandCenter";

/**
 * The rail.
 *
 * Desktop only, and the reason is not screen width. A site with eighteen
 * destinations has outgrown a horizontal bar — seven fit, the rest went
 * behind "more", and "more" is where features go to be forgotten. A rail
 * shows all of them at once and groups them by what they are for, which is
 * the difference between a product and a set of pages.
 *
 * Grouped by the question each answers rather than by type:
 *
 *   מבט   — what is happening right now
 *   מחקר  — what is this company worth
 *   שלי   — what am I holding, and what changed
 *   בינה  — ask it something
 *
 * Every item carries a glyph. Not for decoration: at thirteen pixels of
 * Hebrew, eighteen labels in a column are a wall of similar shapes, and a
 * mark beside each is what makes the list navigable by muscle memory
 * instead of by reading. They are drawn as strokes on one grid at one
 * weight, so the column reads as an instrument panel rather than as a
 * collection of icons.
 *
 * The active mark is a two-pixel rule in the accent. A filled, glowing
 * block was tried and removed — on a company page the accent is the
 * company's own colour, and a saturated block of it beside a label was
 * the loudest thing on a screen whose job is showing figures.
 *
 * The bar stays for phones and tablets, where a rail would eat a third of
 * the screen. Neither is a copy of the other: the bar carries search and
 * refresh, the rail carries the map of the site.
 */

type Entry = { href: string; label: string; icon: string };

/** All drawn on a 16-unit grid, stroked, never filled. */
const ICON = {
  market: "M2 11.5l3.5-4 3 2.5L13 4.5M13 4.5h-3M13 4.5v3",
  brief: "M4 2.5h8v11H4zM6 6h4M6 8.5h4M6 11h2",
  heatmap: "M2.5 2.5h5v5h-5zM8.5 2.5h5v5h-5zM2.5 8.5h5v5h-5zM8.5 8.5h5v5h-5z",
  globe: "M8 2a6 6 0 100 12A6 6 0 008 2zM2.4 6.4h11.2M2.4 9.6h11.2M8 2c1.6 1.8 2.4 3.8 2.4 6S9.6 12.2 8 14c-1.6-1.8-2.4-3.8-2.4-6S6.4 3.8 8 2z",
  news: "M2.5 3.5h8v9h-8zM10.5 6h3v5a1.5 1.5 0 01-3 0zM4.5 6h4M4.5 8.5h4M4.5 11h2",
  radar: "M8 2.5a5.5 5.5 0 105.5 5.5M8 5.5a2.5 2.5 0 102.5 2.5M8 8l4.5-4.5",
  sectors: "M2.5 13V9M6 13V4.5M9.5 13V7M13 13V2.5",
  macro: "M2 10.5c1.8 0 1.8-5 3.6-5s1.8 5 3.6 5 1.8-3 3.6-3",
  compare: "M4 13V6M4 6L2 8M4 6l2 2M12 3v7M12 10l-2-2M12 10l2-2",
  institutional: "M2.5 13.5h11M3.5 13.5V7M6.5 13.5V7M9.5 13.5V7M12.5 13.5V7M2 7l6-4.5L14 7z",
  chain: "M5.5 8h5M5.5 8a2 2 0 11-3 0 2 2 0 013 0zM13.5 4.5a2 2 0 11-3 0 2 2 0 013 0zM13.5 11.5a2 2 0 11-3 0 2 2 0 013 0zM10.6 6.2L7.4 7.2M10.6 9.8L7.4 8.8",
  launch: "M8 1.8c2.2 1.6 3.3 3.8 3.3 6.4L8 11.5 4.7 8.2c0-2.6 1.1-4.8 3.3-6.4zM8 6.6a1 1 0 100 .01M5.8 11.4l-1.3 2.8 2.6-1M10.2 11.4l1.3 2.8-2.6-1",
  watch: "M8 2.2l1.75 3.6 3.9.55-2.83 2.7.68 3.9L8 11.1l-3.5 1.85.68-3.9L2.35 6.35l3.9-.55z",
  portfolio: "M8 2.5v5.5h5.5A5.5 5.5 0 008 2.5zM6.5 4.3A5.5 5.5 0 108 13.5",
  chat: "M2.5 3.5h11v7h-6L4 13.2V10.5h-1.5zM5.5 7h5",
  research: "M7 2.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM10.4 10.4L14 14M5.2 7h3.6M7 5.2v3.6",
  learn: "M2.5 3.5h4.2A1.3 1.3 0 018 4.8v8A1.2 1.2 0 006.8 11.6H2.5zM13.5 3.5H9.3A1.3 1.3 0 008 4.8v8a1.2 1.2 0 011.2-1.2h4.3z",
} as const;

const GROUPS: { title: string; items: Entry[] }[] = [
  {
    title: "מבט",
    items: [
      { href: "/", label: "שוק", icon: ICON.market },
      { href: "/brief", label: "תדריך", icon: ICON.brief },
      { href: "/heatmap", label: "מפת השוק", icon: ICON.heatmap },
      { href: "/israel", label: "תל אביב", icon: ICON.globe },
      { href: "/news", label: "חדשות", icon: ICON.news },
    ],
  },
  {
    title: "מחקר",
    items: [
      { href: "/opportunities", label: "הזדמנויות", icon: ICON.radar },
      { href: "/sectors", label: "סקטורים", icon: ICON.sectors },
      { href: "/macro", label: "מאקרו", icon: ICON.macro },
      { href: "/compare", label: "השוואה", icon: ICON.compare },
      { href: "/institutional", label: "מוסדיים", icon: ICON.institutional },
      { href: "/ai", label: "שרשרת ה-AI", icon: ICON.chain },
      { href: "/launch/ttwo", label: "GTA VI", icon: ICON.launch },
    ],
  },
  {
    title: "שלי",
    items: [
      { href: "/watchlist", label: "מעקב", icon: ICON.watch },
      { href: "/portfolio", label: "בניית תיק", icon: ICON.portfolio },
    ],
  },
  {
    title: "בינה",
    items: [
      { href: "/chat", label: "שאלות", icon: ICON.chat },
      { href: "/research", label: "מחקר עומק", icon: ICON.research },
      { href: "/learn", label: "ידע", icon: ICON.learn },
    ],
  },
];

export function SideRail() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <aside
      aria-label="ניווט ראשי"
      className="fixed inset-y-0 start-0 z-40 hidden w-[232px] flex-col border-e border-line bg-surface/70 backdrop-blur-xl lg:flex"
    >
      {/* The wordmark. The gradient lives on the monogram alone — the
          lockup beside it stays ink, because a gradient on the type would
          be the brightest thing on every page of the site. */}
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-line px-5 py-[21px]"
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
          style={{ background: "var(--gradient-brand)", color: "#f8fafc" }}
          aria-hidden="true"
        >
          M
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight text-ink">
            MARKET
          </span>
          <span className="block text-[10px] tracking-[0.22em] text-ink-faint">
            INTEL
          </span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-5">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-6 last:mb-0">
            <div className="px-2.5 pb-2 text-[9px] font-medium uppercase tracking-[0.13em] text-ink-ghost">
              {group.title}
            </div>
            <ul className="space-y-px">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href} className="relative">
                    {/* The rule sits outside the link's padding so it
                        aligns with the rail's own edge rather than with
                        the label, which is what makes a column of them
                        read as a margin marker instead of as a bullet. */}
                    {active && (
                      <span
                        className="absolute inset-y-[5px] -start-3 w-[2px] rounded-e-full"
                        style={{ background: "var(--color-accent)" }}
                        aria-hidden="true"
                      />
                    )}
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[13px] transition-colors duration-150 ${
                        active
                          ? "bg-raised/80 text-ink"
                          : "text-ink-muted hover:bg-raised/45 hover:text-ink"
                      }`}
                    >
                      <svg
                        width="15"
                        height="15"
                        viewBox="0 0 16 16"
                        aria-hidden="true"
                        className={`shrink-0 transition-opacity ${
                          active ? "opacity-100" : "opacity-55"
                        }`}
                      >
                        <path
                          d={item.icon}
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1.25"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* Search lives at the foot of the rail as well as in the bar. A
          terminal's fastest control should be reachable without the
          reader's hand leaving the keyboard or their eye leaving the
          navigation. */}
      <div className="border-t border-line p-3">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
          className="flex w-full items-center gap-2.5 rounded-md border border-line bg-element px-2.5 py-2 text-[12px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink-muted"
        >
          <svg width="13" height="13" viewBox="0 0 16 16" aria-hidden="true">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.3" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          חיפוש ופקודות
          <kbd className="kbd ms-auto">⌘K</kbd>
        </button>

        <p className="mt-3 px-1 text-[10px] leading-relaxed text-ink-ghost">
          SEC · Finnhub · Yahoo · FRED
          <br />
          מחקר בלבד, לא ייעוץ השקעות
        </p>
      </div>
    </aside>
  );
}
