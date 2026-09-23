"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "דשבורד" },
  { href: "/ai", label: "AI" },
  { href: "/opportunities", label: "הזדמנויות" },
  { href: "/institutional", label: "מעקב מוסדי" },
  { href: "/news", label: "חדשות" },
  { href: "/learn", label: "מרכז ידע" },
  { href: "/launch/ttwo", label: "GTA VI" },
];

/**
 * The site bar.
 *
 * Sticky and translucent so the ambient background moves behind it as the
 * page scrolls — the one place on the site where the chrome is allowed to
 * be atmospheric, because it carries no data.
 *
 * The active link is marked with an underline in the page's accent rather
 * than with a different text colour. On a site where every page has its own
 * accent, a coloured label would change meaning from page to page; a rule
 * under the current item means the same thing everywhere.
 */
export function SiteNav() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_oklab,var(--color-canvas)_78%,transparent)] backdrop-blur-xl">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-5 gap-y-2 px-6 py-3">
        <Link
          href="/"
          className="font-serif text-sm tracking-tight text-gold transition-opacity hover:opacity-80"
        >
          Market Intel
        </Link>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative py-1 transition-colors ${
                  active ? "text-ink" : "hover:text-ink"
                }`}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute inset-x-0 -bottom-px h-px"
                    style={{ background: "var(--accent)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
