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
 */

type Item = {
  id: string;
  group: "חברות" | "תל אביב" | "עמודים" | "סקטורים" | "שאלה";
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
  hint: "לסורק ההזדמנויות",
  href: `/opportunities#${key}`,
  keywords: key,
}));

const ALL = [...COMPANIES, ...PAGES, ...TASE, ...SECTORS];

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
    if (open) {
      setQuery("");
      setActive(0);
      /* Focused twice on purpose: immediately, which works when the
         dialog is already mounted, and again on the next frame, which is
         what catches the first open — the element is created in the same
         commit as this effect, and a browser will not focus a node it has
         not painted yet. */
      inputRef.current?.focus();
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  /* ---- Matching ---- */
  const results = useMemo(() => {
    const raw = query.trim();
    if (!raw) {
      return [
        ...PAGES.slice(0, 6),
        ...COMPANIES.slice(0, 4),
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
  }, [query]);

  useEffect(() => setActive(0), [query]);

  const go = useCallback(
    (item: Item) => {
      setOpen(false);
      router.push(item.href);
    },
    [router],
  );

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-start justify-center px-4 pt-[12vh]"
      role="dialog"
      aria-modal="true"
      aria-label="חיפוש ופקודות"
    >
      <button
        type="button"
        aria-label="סגור"
        onClick={() => setOpen(false)}
        className="absolute inset-0 cursor-default bg-deep/70 backdrop-blur-sm"
      />

      <div className="raised relative w-full max-w-xl overflow-hidden">
        <div className="flex items-center gap-3 border-b border-line px-4 py-3">
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
                setActive((i) => Math.min(i + 1, results.length - 1));
              } else if (event.key === "ArrowUp") {
                event.preventDefault();
                setActive((i) => Math.max(i - 1, 0));
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

          <kbd className="hidden text-[10px] text-ink-ghost sm:block">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto py-1">
          {results.length === 0 ? (
            <p className="px-4 py-6 text-center text-[13px] text-ink-faint">
              אין התאמה. אפשר לנסח את זה כשאלה — הצ׳אט יענה מהנתונים.
            </p>
          ) : (
            results.map((item, index) => {
              const first =
                index === 0 || results[index - 1].group !== item.group;

              return (
                <div key={item.id}>
                  {first && (
                    <div className="px-4 pb-1 pt-3 text-[10px] uppercase tracking-wider text-ink-ghost">
                      {item.group}
                    </div>
                  )}
                  <button
                    type="button"
                    onMouseEnter={() => setActive(index)}
                    onClick={() => go(item)}
                    className={`flex w-full items-center gap-3 px-4 py-2 text-start transition-colors ${
                      index === active ? "bg-hover" : ""
                    }`}
                  >
                    <span
                      className={`text-[13px] ${
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
                    {index === active && (
                      <span className="ms-auto shrink-0 text-[10px] text-ink-ghost">
                        ↵
                      </span>
                    )}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[10px] text-ink-ghost">
          <span>↑↓ ניווט</span>
          <span>↵ פתיחה</span>
          <span className="ms-auto">שאלה שלמה נשלחת לצ׳אט</span>
        </div>
      </div>
    </div>
  );
}
