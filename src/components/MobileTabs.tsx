"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMMAND_EVENT } from "./CommandCenter";

/**
 * The phone's navigation.
 *
 * Five destinations at the bottom of the screen, because a drawer behind
 * a hamburger costs two taps for every move and is where the rest of the
 * site goes to be forgotten.
 *
 * These five are not the five most important pages; they are the five a
 * reader returns to. Search is one of them, and it opens the same palette
 * the desktop uses, which is what keeps the phone a smaller version of
 * the product rather than a different one. Everything else is in the
 * drawer at the top, grouped exactly as the desktop menus are.
 *
 * `pb-[env(safe-area-inset-bottom)]` is not decoration: without it the
 * bar sits under the home indicator on an iPhone and the last row of
 * every table is unreachable.
 */

const TABS = [
  {
    href: "/",
    label: "בית",
    icon: "M2.5 7.2L8 2.6l5.5 4.6V13a.5.5 0 01-.5.5h-3v-4h-4v4H3a.5.5 0 01-.5-.5z",
  },
  {
    href: "/sectors",
    label: "שווקים",
    icon: "M2.5 13V9M6 13V4.5M9.5 13V7M13 13V2.5",
  },
  {
    href: "/watchlist",
    label: "מעקב",
    icon: "M8 2.2l1.75 3.6 3.9.55-2.83 2.7.68 3.9L8 11.1l-3.5 1.85.68-3.9L2.35 6.35l3.9-.55z",
  },
  {
    href: "/chat",
    label: "AI",
    icon: "M2.5 3.5h11v7h-6L4 13.2V10.5h-1.5zM5.5 7h5",
  },
];

export function MobileTabs() {
  const pathname = usePathname();

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <nav
      aria-label="ניווט תחתון"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden"
      style={{ boxShadow: "0 -6px 24px -18px rgba(11, 18, 32, 0.4)" }}
    >
      <ul className="mx-auto flex max-w-lg items-stretch">
        {TABS.slice(0, 2).map((tab) => (
          <Tab key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}

        {/* Search sits in the middle, where a thumb reaches without
            moving the hand. */}
        <li className="flex-1">
          <button
            type="button"
            onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
            className="flex w-full flex-col items-center gap-1 py-2.5 text-[12px] text-ink-faint transition-colors active:text-ink"
          >
            <span
              className="grid h-7 w-7 place-items-center rounded-full text-white"
              style={{
                background: "var(--gradient-brand)",
                boxShadow: "0 6px 14px -6px rgba(40, 85, 245, 0.7)",
              }}
            >
              <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true">
                <circle cx="7" cy="7" r="4.5" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </span>
            חיפוש
          </button>
        </li>

        {TABS.slice(2).map((tab) => (
          <Tab key={tab.href} tab={tab} active={isActive(tab.href)} />
        ))}
      </ul>
    </nav>
  );
}

function Tab({
  tab,
  active,
}: {
  tab: (typeof TABS)[number];
  active: boolean;
}) {
  return (
    /* The mark is positioned against the list item, not the link. It was
       written against the link before, which is not a positioned
       ancestor — so every tab's rule was pinned to the top of the page
       instead of to the top of its tab. */
    <li className="relative flex-1">
      {active && (
        <span
          className="absolute inset-x-0 top-0 mx-auto h-[2px] w-9 rounded-b-full"
          style={{ background: "var(--color-brand)" }}
          aria-hidden="true"
        />
      )}
      <Link
        href={tab.href}
        aria-current={active ? "page" : undefined}
        className={`flex flex-col items-center gap-1 py-2.5 text-[12px] transition-colors duration-150 ${
          active ? "text-[var(--color-brand)]" : "text-ink-faint"
        }`}
      >
        <svg width="18" height="18" viewBox="0 0 16 16" aria-hidden="true">
          <path
            d={tab.icon}
            fill="none"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
        {tab.label}
      </Link>
    </li>
  );
}
