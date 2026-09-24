"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * The bar.
 *
 * 68px, sticky, and translucent only once the page has scrolled — a bar
 * that is blurred over the very top of a page is blurring nothing, and the
 * hairline under it reads as a seam on a layout that has not moved yet.
 *
 * The active item is marked with a rule in the accent rather than with
 * coloured text. Coloured text competes with the figures on the page for
 * the eye, and on a site where each page tints its own light, a coloured
 * label would change meaning from page to page.
 *
 * Search lives here rather than on the dashboard because it is the fastest
 * path to the thing most readers came for, and putting it in the bar makes
 * it reachable from every page instead of one.
 */

/**
 * Seven in the bar, the rest behind "עוד".
 *
 * The site has thirteen pages now and a bar that lists all of them stops
 * being navigation and becomes a wall of small text. The seven here are the
 * ones a reader opens without having decided anything yet; the rest are
 * places you go for a specific reason, and a reason is enough to open a
 * menu.
 */
const LINKS = [
  { href: "/", label: "שוק" },
  { href: "/brief", label: "תדריך" },
  { href: "/opportunities", label: "הזדמנויות" },
  { href: "/compare", label: "השוואה" },
  { href: "/watchlist", label: "מעקב" },
  { href: "/news", label: "חדשות" },
  { href: "/chat", label: "שאלות" },
];

const MORE = [
  { href: "/heatmap", label: "מפת השוק" },
  { href: "/research", label: "מחקר עומק" },
  { href: "/institutional", label: "מוסדיים" },
  { href: "/ai", label: "שרשרת ה-AI" },
  { href: "/learn", label: "ידע" },
  { href: "/launch/ttwo", label: "GTA VI" },
];

function Search() {
  const router = useRouter();
  const [value, setValue] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // A slash focuses the field, the way every terminal does it — but not
  // while the reader is typing into something else.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" || target?.tagName === "TEXTAREA";
      if (event.key === "/" && !typing) {
        event.preventDefault();
        input.current?.focus();
      }
      if (event.key === "Escape") input.current?.blur();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const symbol = value.trim().toUpperCase();
        if (!/^[A-Z.\-]{1,10}$/.test(symbol)) return;
        setValue("");
        input.current?.blur();
        router.push(`/company/${symbol}`);
      }}
      role="search"
      className="relative"
    >
      <label htmlFor="nav-search" className="sr-only">
        חיפוש חברה לפי סימבול
      </label>
      <input
        id="nav-search"
        ref={input}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="חיפוש סימבול"
        autoComplete="off"
        spellCheck={false}
        className="num w-28 rounded-md border border-line bg-surface py-1.5 pe-7 ps-2.5 text-xs text-ink placeholder:font-sans placeholder:text-ink-faint focus:w-40 focus:border-line-strong focus:outline-none sm:w-36 sm:focus:w-48"
        style={{ transition: "width 0.18s ease, border-color 0.18s ease" }}
      />
      <kbd
        className="pointer-events-none absolute end-2 top-1/2 -translate-y-1/2 text-[10px] text-ink-ghost"
        aria-hidden="true"
      >
        /
      </kbd>
    </form>
  );
}

export function SiteNav() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const moreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A navigation should not stay open across a navigation.
  useEffect(() => {
    setOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // A menu that only closes by clicking its own button is a trap on a
  // touch screen, where there is no hover to signal it is still open.
  useEffect(() => {
    if (!moreOpen) return;

    const onPointer = (event: MouseEvent) => {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMoreOpen(false);
    };

    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [moreOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header
      className="sticky top-0 z-50"
      style={{
        background: scrolled
          ? "color-mix(in oklab, var(--color-base) 82%, transparent)"
          : "transparent",
        backdropFilter: scrolled ? "blur(16px) saturate(150%)" : "none",
        borderBottom: `1px solid ${scrolled ? "var(--color-line)" : "transparent"}`,
        transition: "background-color 0.2s ease, border-color 0.2s ease",
      }}
    >
      <nav
        aria-label="ראשי"
        className="mx-auto flex h-[68px] max-w-[1400px] items-center gap-6 px-5 sm:px-8"
      >
        <Link href="/" className="group flex items-center gap-2.5">
          <span
            className="grid h-7 w-7 place-items-center rounded-md text-[13px] font-bold"
            style={{
              background: "var(--color-accent-dim)",
              color: "var(--color-accent)",
              border: "1px solid var(--color-accent-line)",
            }}
            aria-hidden="true"
          >
            M
          </span>
          <span className="editorial hidden text-[15px] tracking-tight text-ink sm:block">
            Market Intel
          </span>
        </Link>

        {/* Desktop navigation, centred. */}
        <div className="mx-auto hidden items-center gap-1 lg:flex">
          {LINKS.map((link) => {
            const active = isActive(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                  active ? "text-ink" : "text-ink-muted hover:text-ink"
                }`}
              >
                {link.label}
                {active && (
                  <span
                    className="absolute inset-x-3 -bottom-[19px] h-[2px] rounded-full"
                    style={{ background: "var(--color-accent)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            );
          })}

          <div className="relative" ref={moreRef}>
            <button
              type="button"
              onClick={() => setMoreOpen((value) => !value)}
              aria-expanded={moreOpen}
              aria-haspopup="menu"
              className={`relative rounded-md px-3 py-1.5 text-[13px] transition-colors ${
                MORE.some((link) => isActive(link.href))
                  ? "text-ink"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              עוד
              <span className="ms-1 text-[9px]" aria-hidden="true">
                ▾
              </span>
              {MORE.some((link) => isActive(link.href)) && (
                <span
                  className="absolute inset-x-3 -bottom-[19px] h-[2px] rounded-full"
                  style={{ background: "var(--color-accent)" }}
                  aria-hidden="true"
                />
              )}
            </button>

            {moreOpen && (
              <div
                role="menu"
                className="absolute end-0 top-[calc(100%+14px)] w-48 overflow-hidden rounded-md border border-line bg-overlay py-1 shadow-xl"
              >
                {MORE.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    role="menuitem"
                    aria-current={isActive(link.href) ? "page" : undefined}
                    className={`block px-4 py-2 text-[13px] transition-colors hover:bg-hover ${
                      isActive(link.href) ? "text-ink" : "text-ink-muted"
                    }`}
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="ms-auto flex items-center gap-2 lg:ms-0">
          <Search />

          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="nav-drawer"
            className="btn btn-ghost px-2 py-1.5 lg:hidden"
          >
            <span className="sr-only">תפריט</span>
            <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
              <path
                d={open ? "M3 3l10 10M13 3L3 13" : "M2 4h12M2 8h12M2 12h12"}
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                fill="none"
              />
            </svg>
          </button>
        </div>
      </nav>

      {/* Mobile drawer. Rendered rather than animated open, because a list
          of seven links does not need a transition and an animated drawer
          is the slowest part of a phone navigation. */}
      {open && (
        <div
          id="nav-drawer"
          className="border-t border-line bg-base/95 px-5 pb-4 pt-2 backdrop-blur-xl lg:hidden"
        >
          <ul className="grid grid-cols-2 gap-1">
            {[...LINKS, ...MORE].map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  aria-current={isActive(link.href) ? "page" : undefined}
                  className={`block rounded-md px-3 py-2.5 text-sm ${
                    isActive(link.href)
                      ? "bg-raised text-ink"
                      : "text-ink-muted"
                  }`}
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </header>
  );
}
