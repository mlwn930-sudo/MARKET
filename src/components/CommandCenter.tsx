"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UNIVERSE, SECTOR_LABELS, type SectorKey } from "@/lib/universe";
import { TASE_LEADERS } from "@/lib/tase-universe";
import { detectTickers, normaliseTicker } from "@/lib/company-names";

/**
 * The command centre.
 *
 * One field that answers four different kinds of intent, because a
 * research tool is used in bursts and the cost of choosing the right menu
 * first is what makes a terminal feel slow:
 *
 *   a symbol or a company name  → that company's page
 *   a page name                 → that page
 *   a sector                    → the screener, filtered
 *   anything else               → the question goes to the chat
 *
 * The last one is the important one. A reader who types "למה NVDA ירדה"
 * has asked a question, not performed a search, and sending that to a
 * results list would be the wrong answer to the right input.
 *
 * Everything here is static data — the company universe, the Tel Aviv
 * list, the routes — so the palette opens instantly and works offline.
 * Nothing is fetched while typing, which also means no request is made
 * for a keystroke the reader immediately deletes.
 *
 * What the reader opened last is kept in localStorage and shown first on
 * an empty field. It is the single highest-value thing a palette can do:
 * research is repetitive, and the second visit to a company is far more
 * likely than the first visit to any other.
 */

type Group = "אחרונים" | "חברות" | "תל אביב" | "עמודים" | "סקטורים" | "שאלה";

type Item = {
  id: string;
  group: Group;
  label: string;
  hint?: string;
  href: string;
  /** Extra words this item can be found by. Never displayed. */
  keywords?: string;
};

const PAGES: Item[] = [
  { id: "p-home", group: "עמודים", label: "שוק", hint: "מדדים, תנועות וחדשות", href: "/", keywords: "home market dashboard" },
  { id: "p-brief", group: "עמודים", label: "תדריך יומי", hint: "מה קרה היום ומה זה אומר", href: "/brief", keywords: "brief daily" },
  { id: "p-opps", group: "עמודים", label: "הזדמנויות", hint: "הסורק — עשר בדיקות על כל חברה", href: "/opportunities", keywords: "screener opportunities" },
  { id: "p-compare", group: "עמודים", label: "השוואה", hint: "עד ארבע חברות זו מול זו", href: "/compare", keywords: "compare" },
  { id: "p-watch", group: "עמודים", label: "מעקב", hint: "מה השתנה מאז הביקור הקודם", href: "/watchlist", keywords: "watchlist" },
  { id: "p-portfolio", group: "עמודים", label: "בניית תיק", hint: "במה התיק מרוכז", href: "/portfolio", keywords: "portfolio risk תיק" },
  { id: "p-israel", group: "עמודים", label: "הבורסה בתל אביב", hint: "ת״א 35, ת״א 125 ומניות מובילות", href: "/israel", keywords: "tase israel ישראל" },
  { id: "p-sectors", group: "עמודים", label: "סקטורים", hint: "תשעה סקטורים לפי תנועה וחציונים", href: "/sectors", keywords: "sectors sector" },
  { id: "p-macro", group: "עמודים", label: "מאקרו", hint: "ריבית, תנודתיות, סחורות ומטבעות", href: "/macro", keywords: "macro rates vix" },
  { id: "p-heatmap", group: "עמודים", label: "מפת השוק", hint: "48 חברות לפי סקטור", href: "/heatmap", keywords: "heatmap map" },
  { id: "p-news", group: "עמודים", label: "חדשות", hint: "כל כתבה בשלוש עדשות", href: "/news", keywords: "news" },
  { id: "p-chat", group: "עמודים", label: "שאלות", hint: "צ׳אט על נתוני האתר", href: "/chat", keywords: "chat ai שאלות" },
  { id: "p-research", group: "עמודים", label: "מחקר עומק", hint: "פירוק שאלה לשאלות משנה", href: "/research", keywords: "research deep" },
  { id: "p-inst", group: "עמודים", label: "מוסדיים", hint: "מי קונה ומי יוצא לפי 13F", href: "/institutional", keywords: "13f institutional" },
  { id: "p-ai", group: "עמודים", label: "שרשרת ה-AI", hint: "שלוש חוליות, שלוש חשיפות", href: "/ai", keywords: "ai chain" },
  { id: "p-learn", group: "עמודים", label: "ידע", hint: "המונחים וההסברים", href: "/learn", keywords: "learn" },
  { id: "p-gta", group: "עמודים", label: "GTA VI", hint: "Take-Two דרך עדשת שוק ההון", href: "/launch/ttwo", keywords: "gta ttwo take-two" },
];

const COMPANIES: Item[] = UNIVERSE.map((company) => ({
  id: `c-${company.ticker}`,
  group: "חברות" as const,
  label: company.ticker,
  hint: SECTOR_LABELS[company.sector as SectorKey],
  href: `/company/${company.ticker}`,
}));

const TASE: Item[] = TASE_LEADERS.map((leader) => ({
  id: `t-${leader.symbol}`,
  group: "תל אביב" as const,
  label: leader.name,
  hint: `${leader.symbol.replace(".TA", "")} · ${leader.sector}`,
  href: "/israel",
  keywords: leader.symbol,
}));

const SECTORS: Item[] = (
  Object.entries(SECTOR_LABELS) as [SectorKey, string][]
).map(([key, label]) => ({
  id: `s-${key}`,
  group: "סקטורים" as const,
  label,
  hint: "לעמוד הסקטור",
  href: `/sectors/${key}`,
  keywords: key,
}));

const ALL = [...COMPANIES, ...PAGES, ...TASE, ...SECTORS];

/** A glyph per group, so the eye can sort a mixed result list without
 *  reading the headings. Same grid and weight as the rail's. */
const GROUP_ICON: Record<Group, string> = {
  אחרונים: "M8 4.2V8l2.4 1.5M8 2.2a5.8 5.8 0 100 11.6A5.8 5.8 0 008 2.2z",
  חברות: "M2.5 13.5h11M4 13.5V4l4-2 4 2v9.5M6.5 7h3M6.5 9.5h3",
  "תל אביב": "M8 2a6 6 0 100 12A6 6 0 008 2zM2.4 6.4h11.2M2.4 9.6h11.2",
  עמודים: "M3.5 2.5h9v11h-9zM5.5 5.5h5M5.5 8h5M5.5 10.5h3",
  סקטורים: "M2.5 13V9M6 13V4.5M9.5 13V7M13 13V2.5",
  שאלה: "M6 6a2 2 0 113 1.7c-.6.4-1 .8-1 1.6M8 11.6v.01",
};

const RECENT_KEY = "market-intel:recent-commands";
const RECENT_MAX = 5;

/** A question, not a lookup: more than two words, or a question mark. */
function looksLikeQuestion(query: string): boolean {
  return query.includes("?") || query.trim().split(/\s+/).length >= 3;
}

/** Anything on the page can open the palette by dispatching this. The
 *  search control in the bar does exactly that, so there is one search on
 *  the site rather than two that behave differently. */
export const COMMAND_EVENT = "market-intel:command";

export function CommandCenter() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [recent, setRecent] = useState<Item[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  /* ---- Opening ---- */
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }
      if (event.key === "Escape") setOpen(false);
      // A bare "k" opens it too, but never while the reader is typing
      // somewhere else — the chat box is a textarea full of k's.
      if (!typing && !open && event.key === "k" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }
    };

    const onRequest = () => setOpen(true);

    window.addEventListener("keydown", onKey);
    window.addEventListener(COMMAND_EVENT, onRequest);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(COMMAND_EVENT, onRequest);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;

    setQuery("");
    setActive(0);

    /* Read on open rather than on mount: another tab may have visited
       something since this one was loaded, and a "recent" list that is
       stale by an hour is worse than none. */
    try {
      const stored = window.localStorage.getItem(RECENT_KEY);
      if (stored) {
        const parsed: Item[] = JSON.parse(stored);
        setRecent(
          parsed
            .filter((item) => item && item.href && item.label)
            .slice(0, RECENT_MAX)
            .map((item) => ({ ...item, group: "אחרונים" as const })),
        );
      }
    } catch {
      // A corrupt entry should cost the reader nothing.
    }

    /* Focused twice on purpose: immediately, which works when the dialog
       is already mounted, and again on the next frame, which is what
       catches the first open — the element is created in the same commit
       as this effect, and a browser will not focus a node it has not
       painted yet. */
    inputRef.current?.focus();
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [open]);

  /* The palette is modal. A page that keeps scrolling behind an open
     overlay is the clearest sign an interface was assembled rather than
     designed. */
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  /* ---- Matching ---- */
  const results = useMemo(() => {
    const raw = query.trim();

    if (!raw) {
      const seen = new Set(recent.map((item) => item.href));
      return [
        ...recent,
        ...PAGES.filter((page) => !seen.has(page.href)).slice(
          0,
          Math.max(4, 8 - recent.length),
        ),
        ...COMPANIES.filter((company) => !seen.has(company.href)).slice(0, 4),
      ];
    }

    const needle = raw.toLowerCase();

    const scored = ALL.map((item) => {
      const label = item.label.toLowerCase();
      const hint = (item.hint ?? "").toLowerCase();
      const keywords = (item.keywords ?? "").toLowerCase();

      let score = 0;
      if (label === needle) score = 100;
      else if (label.startsWith(needle)) score = 80;
      else if (label.includes(needle)) score = 60;
      else if (keywords.startsWith(needle)) score = 52;
      else if (keywords.includes(needle)) score = 45;
      else if (hint.includes(needle)) score = 30;

      return { item, score };
    })
      .filter((row) => row.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 12)
      .map((row) => row.item);

    /* A name the table knows — "אנבידיה" — resolves to its ticker even
       though no label matched, which is the whole point of that table. */
    const byName = detectTickers(raw, 2);
    for (const ticker of byName) {
      if (!scored.some((item) => item.label === ticker)) {
        scored.unshift({
          id: `c-${ticker}`,
          group: "חברות",
          label: ticker,
          hint: "לפי השם שהוקלד",
          href: `/company/${ticker}`,
        });
      }
    }

    /* An unknown symbol is still worth offering: the company page resolves
       anything that files with SEC, not only the universe. */
    const direct = normaliseTicker(raw);
    if (
      direct &&
      /^[A-Z.\-]{1,6}$/.test(direct) &&
      !scored.some((item) => item.label === direct)
    ) {
      scored.unshift({
        id: `c-direct-${direct}`,
        group: "חברות",
        label: direct,
        hint: "חיפוש ישיר ב-SEC",
        href: `/company/${direct}`,
      });
    }

    const items = scored.slice(0, 12);

    if (looksLikeQuestion(raw)) {
      items.unshift({
        id: "ask",
        group: "שאלה",
        label: raw,
        hint: "שאל את הצ׳אט — התשובה תיבנה מנתוני האתר",
        href: `/chat?q=${encodeURIComponent(raw)}`,
      });
    }

    return items;
  }, [query, recent]);

  useEffect(() => setActive(0), [query]);

  /* Keeps the highlighted row in view when the list is driven by the
     keyboard rather than by the mouse. */
  useEffect(() => {
    listRef.current
      ?.querySelector<HTMLElement>(`[data-index="${active}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [active]);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);

      /* A typed question is not a destination and does not belong in a
         list of places you have been. */
      if (item.group !== "שאלה") {
        try {
          const entry = { ...item, group: "אחרונים" as const };
          const next = [
            entry,
            ...recent.filter((previous) => previous.href !== item.href),
          ].slice(0, RECENT_MAX);
          window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
          setRecent(next);
        } catch {
          // Private browsing, a full quota — neither should block a click.
        }
      }

      router.push(item.href);
    },
    [router, recent],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[11vh]"
      role="dialog"
      aria-modal="true"
      aria-label="חיפוש ופקודות"
    >
      <button
        type="button"
        aria-label="סגור"
        onClick={() => setOpen(false)}
        className="veil absolute inset-0 cursor-default bg-deep/75 backdrop-blur-[3px]"
      />

      <div className="palette raised relative w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3.5">
          <svg width="15" height="15" viewBox="0 0 16 16" aria-hidden="true" className="shrink-0 text-ink-faint">
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.4" />
            <path d="M11 11l3.5 3.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
          </svg>

          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActive((i) => (i + 1) % Math.max(results.length, 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive(
                  (i) => (i - 1 + results.length) % Math.max(results.length, 1),
                );
              } else if (event.key === "Enter" && results[active]) {
                event.preventDefault();
                go(results[active]);
              }
            }}
            autoFocus
            placeholder="חברה, סימבול, עמוד — או שאלה שלמה"
            className="flex-1 bg-transparent text-[15px] text-ink placeholder:text-ink-faint focus:outline-none"
            aria-label="חיפוש"
            autoComplete="off"
            spellCheck={false}
          />

          <kbd className="kbd hidden sm:inline-grid">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[54vh] overflow-y-auto py-1.5">
          {results.length === 0 ? (
            <div className="px-5 py-8 text-center">
              <p className="text-[13px] text-ink-muted">
                אין התאמה ל״{query.trim()}״.
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                סימבול שלא ברשימה עדיין ייפתח אם החברה מגישה דוחות ל-SEC.
                ואפשר פשוט לנסח את זה כשאלה — הצ׳אט יענה מהנתונים.
              </p>
            </div>
          ) : (
            results.map((item, index) => {
              const first =
                index === 0 || results[index - 1].group !== item.group;
              const selected = index === active;

              return (
                <div key={`${item.group}-${item.id}`}>
                  {first && (
                    <div className="px-4 pb-1 pt-3 text-[9px] font-medium uppercase tracking-[0.13em] text-ink-ghost">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    data-index={index}
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-start transition-colors duration-100 ${
                      selected ? "bg-hover" : ""
                    }`}
                  >
                    <svg
                      width="13"
                      height="13"
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      className={`shrink-0 ${selected ? "text-accent" : "text-ink-ghost"}`}
                    >
                      <path
                        d={GROUP_ICON[item.group]}
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>

                    <span
                      className={`shrink-0 text-[13px] ${
                        item.group === "חברות" ? "num" : ""
                      } text-ink`}
                    >
                      {item.label}
                    </span>

                    {item.hint && (
                      <span className="truncate text-[11px] text-ink-faint">
                        {item.hint}
                      </span>
                    )}

                    <kbd
                      className={`kbd ms-auto shrink-0 ${
                        selected ? "opacity-100" : "opacity-0"
                      }`}
                      aria-hidden="true"
                    >
                      ↵
                    </kbd>
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line bg-base/50 px-4 py-2.5 text-[10px] text-ink-ghost">
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↑</kbd>
            <kbd className="kbd">↓</kbd>
            ניווט
          </span>
          <span className="flex items-center gap-1.5">
            <kbd className="kbd">↵</kbd>
            פתיחה
          </span>
          <span className="ms-auto hidden sm:inline">
            שאלה שלמה נשלחת לצ׳אט
          </span>
        </div>
      </div>
    </div>
  );
}
