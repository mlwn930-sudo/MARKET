"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * The rail.
 *
 * Desktop only, and the reason is not screen width. A site with fifteen
 * destinations has outgrown a horizontal bar — seven fit, the rest went
 * behind "more", and "more" is where features go to be forgotten. A rail
 * shows all of them at once and groups them by what they are for, which is
 * the difference between a product and a set of pages.
 *
 * Grouped by the question each answers rather than by type:
 *
 *   מבט — what is happening right now
 *   מחקר — what is this company worth
 *   שלי — what am I holding, and what changed
 *
 * The bar stays for phones and tablets, where a rail would eat a third of
 * the screen. Neither is a copy of the other: the bar carries search and
 * refresh, the rail carries the map of the site.
 */

type Entry = { href: string; label: string; hint?: string };

const GROUPS: { title: string; items: Entry[] }[] = [
  {
    title: "מבט",
    items: [
      { href: "/", label: "שוק" },
      { href: "/brief", label: "תדריך" },
      { href: "/heatmap", label: "מפת השוק" },
      { href: "/israel", label: "תל אביב" },
      { href: "/news", label: "חדשות" },
    ],
  },
  {
    title: "מחקר",
    items: [
      { href: "/opportunities", label: "הזדמנויות" },
      { href: "/sectors", label: "סקטורים" },
      { href: "/macro", label: "מאקרו" },
      { href: "/compare", label: "השוואה" },
      { href: "/institutional", label: "מוסדיים" },
      { href: "/ai", label: "שרשרת ה-AI" },
      { href: "/launch/ttwo", label: "GTA VI" },
    ],
  },
  {
    title: "שלי",
    items: [
      { href: "/watchlist", label: "מעקב" },
      { href: "/portfolio", label: "בניית תיק" },
    ],
  },
  {
    title: "בינה",
    items: [
      { href: "/chat", label: "שאלות" },
      { href: "/research", label: "מחקר עומק" },
      { href: "/learn", label: "ידע" },
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
      className="fixed inset-y-0 start-0 z-40 hidden w-[224px] flex-col border-e border-line bg-surface/70 backdrop-blur-xl lg:flex"
    >
      <Link
        href="/"
        className="flex items-center gap-2.5 border-b border-line px-5 py-[21px]"
      >
        <span
          className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
          style={{
            background: "var(--gradient-brand)",
            color: "#f8fafc",
          }}
          aria-hidden="true"
        >
          M
        </span>
        <span className="leading-tight">
          <span className="block text-[13px] font-semibold tracking-tight text-ink">
            MARKET
          </span>
          <span className="block text-[11px] tracking-[0.18em] text-ink-faint">
            INTEL
          </span>
        </span>
      </Link>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {GROUPS.map((group) => (
          <div key={group.title} className="mb-5">
            <div className="px-2 pb-1.5 text-[10px] uppercase tracking-wider text-ink-ghost">
              {group.title}
            </div>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={`relative flex items-center rounded-md px-2.5 py-1.5 text-[13px] transition-colors ${
                        active
                          ? "bg-raised text-ink"
                          : "text-ink-muted hover:bg-raised/60 hover:text-ink"
                      }`}
                    >
                      {/* The active mark is a rule in the accent, never
                          coloured text: on a company page the accent is
                          the company's own colour. */}
                      {active && (
                        <span
                          className="absolute inset-y-1.5 -start-3 w-[2px] rounded-full"
                          style={{ background: "var(--color-accent)" }}
                          aria-hidden="true"
                        />
                      )}
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-line px-5 py-3 text-[10px] leading-relaxed text-ink-ghost">
        נתונים: SEC · Finnhub · Yahoo · FRED
        <br />
        מחקר בלבד, לא ייעוץ השקעות
      </div>
    </aside>
  );
}
