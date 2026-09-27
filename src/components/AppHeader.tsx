"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { RefreshButton } from "./RefreshButton";
import { COMMAND_EVENT } from "./CommandCenter";
import { Wordmark } from "./Wordmark";

/**
 * The masthead.
 *
 * What it replaces: a fixed rail listing eighteen destinations, plus a bar
 * listing eight of them again. Two navigations for one site, 232px of
 * every desktop screen spent on a list nobody read past the third item,
 * and a content column that could never be the full width of the page.
 *
 * The structure here is three doors and a counter:
 *
 *   שווקים   what is happening right now
 *   מודיעין  what the system made of it
 *   מחקר     the tools for working a question yourself
 *
 * and on the other side, the four things a reader reaches for regardless
 * of where they are: search, the model, their list, their account.
 *
 * Each door opens onto the pages behind it with a line explaining what
 * each one is for. That line is the reason the menu can hold six items
 * without becoming the wall of small text the rail was — a label alone
 * asks the reader to remember; a label with a sentence asks them to read.
 *
 * Under the bar, when a section has siblings, a second row lists them.
 * Contextual navigation is what lets the primary navigation stay at
 * three items without burying the other fifteen two clicks deep.
 */

type Entry = { href: string; label: string; note: string };
type Group = { key: string; label: string; items: Entry[] };

const NAV: Group[] = [
  {
    key: "markets",
    label: "שווקים",
    items: [
      { href: "/", label: "מבט שוק", note: "מדדים, תנועות, ומה מסביר אותן" },
      { href: "/heatmap", label: "מפת השוק", note: "48 חברות לפי סקטור וגודל" },
      { href: "/sectors", label: "סקטורים", note: "תשע קבוצות מול החציון של כל אחת" },
      { href: "/macro", label: "מאקרו", note: "תשואות, סחורות, מטבעות ו-VIX" },
      { href: "/israel", label: "תל אביב", note: "ת״א 35 ו-125, בשקלים" },
      { href: "/news", label: "חדשות", note: "כותרות שנקראו דרך שלוש עדשות" },
    ],
  },
  {
    key: "intelligence",
    label: "מודיעין",
    items: [
      { href: "/intel", label: "חדר המודיעין", note: "ממצאים, שרשראות ושינויי תזה" },
      { href: "/brief", label: "תדריך יומי", note: "מה נסגר אתמול ומה פתוח היום" },
      { href: "/opportunities", label: "הזדמנויות", note: "הסורק על כל החברות במעקב" },
      { href: "/institutional", label: "מוסדיים", note: "מי עוד קונה, לפי דוחות 13F" },
      { href: "/ai", label: "שרשרת ה-AI", note: "מפת התלות של שוק הבינה" },
      { href: "/launch/ttwo", label: "GTA VI", note: "השקה אחת, שרשרת ערך שלמה" },
    ],
  },
  {
    key: "research",
    label: "מחקר",
    items: [
      { href: "/compare", label: "השוואה", note: "עד ארבע חברות, כל אחת מול הסקטור שלה" },
      { href: "/research", label: "מחקר עומק", note: "שאלה שמתפרקת לשאלות משנה" },
      { href: "/portfolio", label: "בניית תיק", note: "ריכוז, חפיפה, ומה שלא נמדד" },
      { href: "/learn", label: "ידע", note: "המונחים, בעברית" },
    ],
  },
];

/** Where the right-hand cluster points. */
const CHAT = "/chat";
const WATCHLIST = "/watchlist";

const ACCOUNT: Entry[] = [
  { href: "/portfolio", label: "התיק שלי", note: "ריכוז וחשיפה" },
  { href: WATCHLIST, label: "רשימת המעקב", note: "מה השתנה מאז הביקור הקודם" },
  { href: "/learn", label: "ידע", note: "איך לקרוא את המדדים" },
];

function groupOf(pathname: string): Group | null {
  for (const group of NAV) {
    for (const item of group.items) {
      if (item.href === "/" ? pathname === "/" : pathname.startsWith(item.href)) {
        return group;
      }
    }
  }
  // A company page belongs to research: it is where a question is worked.
  if (pathname.startsWith("/company")) return NAV[2];
  return null;
}

function Icon({ path, size = 16 }: { path: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d={path}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const GLYPH = {
  search: "M7 2.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM10.5 10.5L14 14",
  ai: "M2.5 3.5h11v7h-6L4 13.2V10.5h-1.5zM5.5 7h5",
  star: "M8 2.2l1.75 3.6 3.9.55-2.83 2.7.68 3.9L8 11.1l-3.5 1.85.68-3.9L2.35 6.35l3.9-.55z",
  user: "M8 8.5a3 3 0 100-6 3 3 0 000 6zM2.8 14c.6-2.4 2.7-3.8 5.2-3.8s4.6 1.4 5.2 3.8",
  menu: "M2 4h12M2 8h12M2 12h12",
  close: "M3 3l10 10M13 3L3 13",
} as const;

export function AppHeader() {
  const pathname = usePathname();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [drawer, setDrawer] = useState(false);
  const barRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // A navigation should not stay open across a navigation.
  useEffect(() => {
    setOpen(null);
    setDrawer(false);
  }, [pathname]);

  // A menu that only closes by clicking its own button is a trap on a
  // touch screen, where there is no hover to signal it is still open.
  useEffect(() => {
    if (!open && !drawer) return;
    const onPointer = (event: MouseEvent) => {
      if (!barRef.current?.contains(event.target as Node)) setOpen(null);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        const trigger = barRef.current?.querySelector<HTMLButtonElement>('button[aria-expanded="true"]');
        setOpen(null);
        setDrawer(false);
        trigger?.focus();
      }
    };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, drawer]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  const current = groupOf(pathname);

  return (
    <header className="market-masthead sticky top-0 z-50" data-scrolled={scrolled}>
      <div ref={barRef} className="mx-auto max-w-[1440px] px-5 sm:px-8">
        <nav
          aria-label="ראשי"
          className="flex h-16 items-center gap-4"
        >
          <Link href="/" className="shrink-0" aria-label="Market Intel">
            <Wordmark />
          </Link>

          {/* The three doors, centred. */}
          <div className="mx-auto hidden items-center gap-1 md:flex">
            {NAV.map((group) => {
              const active = current?.key === group.key;
              const expanded = open === group.key;
              return (
                <div key={group.key} className="relative">
                  <button
                    type="button"
                    onClick={() => setOpen(expanded ? null : group.key)}
                    onMouseEnter={() => open && setOpen(group.key)}
                    aria-expanded={expanded}

                    className={`flex items-center gap-1.5 rounded-md px-3.5 py-2 text-[15px] font-medium transition-colors ${
                      active || expanded
                        ? "text-ink"
                        : "text-ink-muted hover:text-ink"
                    }`}
                  >
                    {group.label}
                    <span
                      className={`text-[8px] transition-transform ${expanded ? "rotate-180" : ""}`}
                      aria-hidden="true"
                    >
                      ▾
                    </span>
                    {active && (
                      <span
                        className="absolute inset-x-3.5 -bottom-[13px] h-[2px] rounded-full"
                        style={{ background: "var(--color-brand)" }}
                        aria-hidden="true"
                      />
                    )}
                  </button>

                  {expanded && (
                    <div

                      className="raised palette absolute start-1/2 top-[calc(100%+12px)] w-[336px] -translate-x-1/2 overflow-hidden p-1.5 rtl:translate-x-1/2"
                    >
                      {group.items.map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}

                          aria-current={isActive(item.href) ? "page" : undefined}
                          className={`block rounded-md px-3 py-2.5 transition-colors ${
                            isActive(item.href)
                              ? "bg-[var(--color-accent-dim)]"
                              : "hover:bg-[var(--color-surface-secondary)]"
                          }`}
                        >
                          <span
                            className={`block text-[15px] font-medium ${
                              isActive(item.href) ? "text-[var(--color-brand)]" : "text-ink"
                            }`}
                          >
                            {item.label}
                          </span>
                          <span className="mt-0.5 block text-[12px] leading-snug text-ink-faint">
                            {item.note}
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* The counter. */}
          <div className="ms-auto flex items-center gap-1.5 md:ms-0">
            <button
              type="button"
              onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
              className="flex items-center gap-2 rounded-md border border-line bg-surface px-2.5 py-1.5 text-[14px] text-ink-faint shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:text-ink-muted"
              aria-label="חיפוש ופקודות"
            >
              <Icon path={GLYPH.search} size={14} />
              <span className="hidden lg:inline">חיפוש</span>
              <kbd className="kbd num hidden lg:inline-grid">⌘K</kbd>
            </button>

            <Link
              href={CHAT}
              aria-current={isActive(CHAT) ? "page" : undefined}
              className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[14px] transition-colors sm:flex ${
                isActive(CHAT)
                  ? "text-[var(--color-brand)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon path={GLYPH.ai} size={14} />
              AI
            </Link>

            <Link
              href={WATCHLIST}
              aria-current={isActive(WATCHLIST) ? "page" : undefined}
              className={`hidden items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[14px] transition-colors sm:flex ${
                isActive(WATCHLIST)
                  ? "text-[var(--color-brand)]"
                  : "text-ink-muted hover:text-ink"
              }`}
            >
              <Icon path={GLYPH.star} size={14} />
              מעקב
            </Link>

            <div className="relative hidden md:block">
              <button
                type="button"
                onClick={() => setOpen(open === "account" ? null : "account")}
                aria-expanded={open === "account"}

                aria-label="כלים אישיים"
                className="grid h-8 w-8 place-items-center rounded-full border border-line bg-surface text-ink-muted shadow-[var(--shadow-sm)] transition-colors hover:border-line-strong hover:text-ink"
              >
                <Icon path={GLYPH.user} size={15} />
              </button>

              {open === "account" && (
                <div

                  className="raised palette absolute end-0 top-[calc(100%+12px)] w-56 overflow-hidden p-1.5"
                >
                  {ACCOUNT.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}

                      className="block rounded-md px-3 py-2 transition-colors hover:bg-[var(--color-surface-secondary)]"
                    >
                      <span className="block text-[13px] font-medium text-ink">
                        {item.label}
                      </span>
                      <span className="block text-[12px] text-ink-faint">
                        {item.note}
                      </span>
                    </Link>
                  ))}
                  <div className="divider my-1.5" />
                  <div className="px-3 py-1.5">
                    <RefreshButton />
                  </div>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => setDrawer((value) => !value)}
              aria-expanded={drawer}
              aria-controls="nav-drawer"
              className="grid h-8 w-8 place-items-center rounded-md border border-line bg-surface text-ink-muted md:hidden"
            >
              <span className="sr-only">תפריט</span>
              <Icon path={drawer ? GLYPH.close : GLYPH.menu} size={15} />
            </button>
          </div>
        </nav>
      </div>

      {/* --- Contextual row -------------------------------------------
          The siblings of wherever you are. It appears only when the
          section has any, and never on a phone: on a phone the same
          links are one tap away in the drawer, and a second scrolling
          strip under a 16px bar is how a small screen loses its content. */}
      {current && (
        <div className="hidden border-t border-line/70 md:block">
          <div className="mx-auto flex max-w-[1440px] items-center gap-1 overflow-x-auto px-5 sm:px-8">
            {current.items.map((item) => {
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`relative whitespace-nowrap px-3 py-2.5 text-[14px] transition-colors ${
                    active ? "text-ink" : "text-ink-faint hover:text-ink-muted"
                  }`}
                >
                  {item.label}
                  {active && (
                    <span
                      className="absolute inset-x-3 bottom-0 h-[2px] rounded-t-full"
                      style={{ background: "var(--color-brand)" }}
                      aria-hidden="true"
                    />
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* --- Phone drawer ---------------------------------------------- */}
      {drawer && (
        <div
          id="nav-drawer"
          className="max-h-[70vh] overflow-y-auto border-t border-line bg-surface px-5 pb-6 pt-4 md:hidden"
        >
          {NAV.map((group) => (
            <div key={group.key} className="mb-5">
              <span className="eyebrow">{group.label}</span>
              <ul className="mt-2 space-y-0.5">
                {group.items.map((item) => (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive(item.href) ? "page" : undefined}
                      className={`block rounded-md px-3 py-2.5 text-[14px] ${
                        isActive(item.href)
                          ? "bg-[var(--color-accent-dim)] text-[var(--color-brand)]"
                          : "text-ink-muted"
                      }`}
                    >
                      {item.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
          <div className="divider mb-4" />
          <RefreshButton />
        </div>
      )}
    </header>
  );
}
