"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { COMMAND_EVENT } from "./CommandCenter";
import { Wordmark } from "./Wordmark";

/**
 * Every page, on the bar.
 *
 * There used to be a drawer behind a "all tools" button, and three items on
 * the bar itself. It kept the bar tidy and it hid fifteen pages behind a
 * press that nobody makes twice — a menu is a promise that the thing you
 * want is somewhere inside, and the visitor has to take it on faith.
 *
 * So the drawer is gone and the whole site is on the bar, in two tiers. The
 * top tier is where you go to work; the second is everything else, one
 * button each. Nothing is more than one press away and nothing has to be
 * discovered.
 *
 * Both tiers scroll sideways rather than wrap, because a navigation bar
 * that changes height when a label grows moves the page under the reader.
 */

/** Where the work happens. These six carry the weight of a session. */
const PRIMARY: [string, string][] = [
  ["/", "שווקים"],
  ["/intel", "מודיעין"],
  ["/research", "מחקר"],
  ["/opportunities", "הזדמנויות"],
  ["/watchlist", "מעקב"],
  ["/launch/ttwo", "GTA VI"],
];

/** Everything the drawer used to hold, grouped so the eye can find a place
 *  rather than read twelve labels in a row. The separators are drawn by CSS
 *  off `data-group`, so the markup stays a flat list for a screen reader. */
const SECONDARY: { href: string; label: string; group: string }[] = [
  { href: "/brief", label: "התדריך", group: "market" },
  { href: "/news", label: "חדשות", group: "market" },
  { href: "/heatmap", label: "מפת השוק", group: "market" },
  { href: "/sectors", label: "סקטורים", group: "market" },
  { href: "/macro", label: "מאקרו", group: "market" },
  { href: "/israel", label: "תל אביב", group: "market" },
  { href: "/compare", label: "השוואה", group: "study" },
  { href: "/chart-reader", label: "קריאת גרף", group: "study" },
  /* Beside the chart reader on purpose: it is the page that says what the
     thing you are about to read is worth. */
  { href: "/signals", label: "ערך האותות", group: "study" },
  { href: "/institutional", label: "מוסדיים", group: "study" },
  { href: "/ai", label: "שרשרת AI", group: "study" },
  { href: "/portfolio", label: "בניית תיק", group: "act" },
  { href: "/chat", label: "שיחה", group: "act" },
  { href: "/learn", label: "מילון", group: "act" },
  { href: "/sources", label: "מקורות", group: "act" },
];

const GROUP_LABEL: Record<string, string> = {
  market: "להבין את השוק",
  study: "לחקור רעיון",
  act: "לבנות עמדה",
};

export function AppHeader() {
  const path = usePathname();
  const current = (href: string) =>
    (href === "/" ? path === "/" : path.startsWith(href)) ? "page" : undefined;

  return (
    <header className="studio-header">
      <nav aria-label="ראשי" className="studio-nav">
        <Link href="/" aria-label="MARKET — בית">
          <Wordmark />
        </Link>

        <div className="primary-destinations">
          {PRIMARY.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              className={href === "/launch/ttwo" ? "destination-story" : undefined}
              aria-current={current(href)}
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="nav-utilities">
          <button
            type="button"
            className="search-trigger"
            onClick={() => window.dispatchEvent(new CustomEvent(COMMAND_EVENT))}
            aria-label="חיפוש חברה או כלי"
          >
            <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
              <circle cx="10" cy="10" r="6" fill="none" stroke="currentColor" strokeWidth="1.5" />
              <path d="m15 15 5 5" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            <span>חיפוש</span>
          </button>
        </div>
      </nav>

      <nav className="financial-subnav" aria-label="שאר עמודי האתר">
        {SECONDARY.map((item, i) => (
          <Link
            key={item.href}
            href={item.href}
            data-group={item.group}
            data-group-start={SECONDARY[i - 1]?.group !== item.group ? "true" : undefined}
            aria-label={
              SECONDARY[i - 1]?.group !== item.group
                ? `${item.label} — ${GROUP_LABEL[item.group]}`
                : undefined
            }
            aria-current={current(item.href)}
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}
