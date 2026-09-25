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
  { href: "/", label: "שוק", icon: "M2 8.5L8 3l6 5.5M3.5 7.5V13h9V7.5" },
  { href: "/sectors", label: "סקטורים", icon: "M2 12h3V6H2v6zm4.5 0h3V3h-3v9zm4.5 0h3V8h-3v4z" },
  { href: "/watchlist", label: "מעקב", icon: "M8 2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.2 4.4 13.1l.7-4L2.2 6.3l4-.6z" },
  { href: "/chat", label: "שאלות", icon: "M2.5 3.5h11v7h-6l-3 2.5v-2.5h-2z" },
];

export function MobileTabs() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl lg:hidden"
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.map((tab) => {
          const active = isActive(tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`flex flex-col items-center gap-1 py-2.5 text-[10px] transition-colors ${
                  active ? "text-ink" : "text-ink-faint"
                }`}
              >
                <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
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
                {active && (
                  <span
                    className="absolute top-0 h-[2px] w-8 rounded-full"
                    style={{ background: "var(--color-accent)" }}
                    aria-hidden="true"
                  />
                )}
              </Link>
            </li>
          );
        })}

        <li className="flex-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
            className="flex w-full flex-col items-center gap-1 py-2.5 text-[10px] text-ink-faint"
          >
            <svg width="17" height="17" viewBox="0 0 16 16" aria-hidden="true">
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
