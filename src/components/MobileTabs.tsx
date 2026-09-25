"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMMAND_EVENT } from "./CommandCenter";

/**
 * The phone's navigation.
 *
 * Five destinations at the bottom of the screen, because a drawer behind a
 * hamburger costs two taps for every move and is where the rest of the
 * site goes to be forgotten — the same reason the desktop got a rail.
 *
 * These five are not the five most important pages; they are the five a
 * reader returns to. Search is one of them, and it opens the same palette
 * the desktop uses, which is what keeps the phone a smaller version of the
 * product rather than a different one.
 *
 * `pb-[env(safe-area-inset-bottom)]` is not decoration: without it the bar
 * sits under the home indicator on an iPhone and the last row of every
 * table is unreachable.
 */

const TABS = [
  {
    href: "/",
    label: "שוק",
    icon: "M2 11.5l3.5-4 3 2.5L13 4.5M13 4.5h-3M13 4.5v3",
  },
  {
    href: "/sectors",
    label: "סקטורים",
    icon: "M2.5 13V9M6 13V4.5M9.5 13V7M13 13V2.5",
  },
  {
    href: "/watchlist",
    label: "מעקב",
    icon: "M8 2.2l1.75 3.6 3.9.55-2.83 2.7.68 3.9L8 11.1l-3.5 1.85.68-3.9L2.35 6.35l3.9-.55z",
  },
  {
    href: "/chat",
    label: "שאלות",
    icon: "M2.5 3.5h11v7h-6L4 13.2V10.5h-1.5z",
  },
];

export function MobileTabs() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/92 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            /* The mark is positioned against the list item, not the link.
               It was written against the link before, which is not a
               positioned ancestor — so every tab's rule was pinned to the
               top of the page instead of to the top of its tab. */
            <li key={tab.href} className="relative flex-1">
              {active && (
                <span
                  className="absolute inset-x-0 top-0 mx-auto h-[2px] w-9 rounded-b-full"
                  style={{ background: "var(--color-accent)" }}
                  aria-hidden="true"
                />
              )}
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors duration-150 ${
                  active ? "text-ink" : "text-ink-faint"
                }`}
              >
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                  className={active ? "opacity-100" : "opacity-70"}
                >
                  <path
                    d={tab.icon}
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.3"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                </svg>
                {tab.label}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
            className="flex w-full flex-col items-center gap-1 py-2.5 text-[10px] text-ink-faint transition-colors active:text-ink"
          >
            <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true" className="opacity-70">
              <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.3" />
              <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
            </svg>
            חיפוש
          </button>
        </li>
      </ul>
    </nav>
  );
}
