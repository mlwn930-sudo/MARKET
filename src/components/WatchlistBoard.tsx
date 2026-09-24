"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  PRICE_MOVE_THRESHOLD,
  WATCHLIST_EVENT,
  diffAgainst,
  getSnapshot,
  getWatchlist,
  saveSnapshot,
  setWatchlist,
  type Change,
} from "@/lib/watchlist";
import { normaliseTicker } from "@/lib/company-names";
import {
  directionClass,
  fmtMetric,
  fmtPercent,
  fmtPrice,
  fmtRelative,
} from "@/lib/format";

/**
 * The watchlist board.
 *
 * The part that earns the page is the strip at the top: what changed since
 * the last visit. A table of prices is available on every finance site;
 * "TTWO filed, and the metrics now describe the quarter that ended in June"
 * is the thing a medium-term reader actually wants to be told.
 *
 * The snapshot is written only after the difference has been rendered, so a
 * reader who opens the page twice in a minute still sees what changed since
 * yesterday rather than an empty strip.
 */

type Row = {
  ticker: string;
  name: string | null;
  sector: string | null;
  price: number | null;
  changePercent: number | null;
  metrics: {
    pe: number | null;
    roic: number | null;
    operating_margin: number | null;
    rev_cagr_3: number | null;
  } | null;
  filingAsOf: string | null;
  stale: boolean | null;
  inUniverse: boolean;
  news: {
    count: number;
    top: { title: string; url: string; significance: string } | null;
  };
};

const REFRESH_MS = 60_000;

export function WatchlistBoard() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [checkedAt, setCheckedAt] = useState<Date | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");

  /** The snapshot from the previous visit, captured once on mount. Reading
   *  it later would compare the page against itself. */
  const previous = useRef(getSnapshot());
  const mounted = useRef(false);

  useEffect(() => {
    const sync = () => setTickers(getWatchlist());
    sync();
    window.addEventListener(WATCHLIST_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(WATCHLIST_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const load = useCallback(
    async (list: string[]) => {
      if (list.length === 0) {
        setRows([]);
        setChanges([]);
        setLoading(false);
        return;
      }

      try {
        const res = await fetch("/api/watchlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tickers: list }),
        });
        if (!res.ok) throw new Error(String(res.status));

        const data = (await res.json()) as { rows: Row[]; checkedAt: string };
        setRows(data.rows);
        setCheckedAt(new Date(data.checkedAt));
        setError(null);

        // The difference is computed against the snapshot from the previous
        // visit, and only on the first load of this one.
        if (!mounted.current) {
          setChanges(diffAgainst(previous.current, data.rows));
          mounted.current = true;
        }

        saveSnapshot({
          checkedAt: data.checkedAt,
          rows: Object.fromEntries(
            data.rows.map((row) => [
              row.ticker,
              {
                price: row.price,
                filingAsOf: row.filingAsOf,
                newsCount: row.news.count,
              },
            ]),
          ),
        });
      } catch {
        setError("לא הצלחתי למשוך את הנתונים. הרשימה עצמה נשמרה.");
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    load(tickers);
  }, [tickers, load]);

  // A tab nobody is looking at does not poll. The same rule the live price
  // follows everywhere else on the site.
  useEffect(() => {
    if (tickers.length === 0) return;
    const timer = setInterval(() => {
      if (!document.hidden) load(tickers);
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [tickers, load]);

  const add = (raw: string) => {
    const ticker = normaliseTicker(raw);
    if (!ticker) return;
    setWatchlist([...getWatchlist(), ticker]);
    setDraft("");
  };

  const remove = (ticker: string) =>
    setWatchlist(getWatchlist().filter((t) => t !== ticker));

  return (
    <div className="space-y-6">
      {/* What changed */}
      {changes.length > 0 && (
        <div className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">מאז הביקור הקודם</span>
          </div>
          <ul className="space-y-2">
            {changes.map((change, i) => (
              <li key={`${change.ticker}-${change.kind}-${i}`} className="flex gap-3 text-[13px]">
                <Link
                  href={`/company/${change.ticker}`}
                  className="num shrink-0 text-ink hover:text-accent"
                >
                  {change.ticker}
                </Link>
                <span
                  className={
                    change.direction
                      ? change.direction === "up"
                        ? "text-up"
                        : "text-down"
                      : "text-ink-muted"
                  }
                >
                  {change.text}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 border-t border-line pt-3 text-[11px] text-ink-ghost">
            תנועת מחיר נספרת מ-{PRICE_MOVE_THRESHOLD}% ומעלה. מתחת לזה זה שוק
            פתוח, לא אירוע. ההשוואה היא מול המצב שנשמר בדפדפן הזה בביקור
            הקודם.
          </p>
        </div>
      )}

      {/* Add */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(draft);
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="watch-add" className="sr-only">
          הוספת חברה למעקב
        </label>
        <input
          id="watch-add"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="סימבול או שם — NVDA, אנבידיה"
          autoComplete="off"
          spellCheck={false}
          className="num w-full max-w-xs rounded-md border border-line bg-surface px-3 py-2 text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
        />
        <button type="submit" className="btn btn-primary px-4 py-2 text-[13px]">
          הוסף
        </button>
      </form>

      {error && <p className="text-[12px] text-ink-faint">{error}</p>}

      {/* The list */}
      {tickers.length === 0 ? (
        <div className="surface px-5 py-8 text-center">
          <p className="text-[14px] text-ink">הרשימה ריקה.</p>
          <p className="mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-ink-muted">
            הוסף חברה מהשדה למעלה, או מכפתור המעקב בעמוד של כל חברה. הרשימה
            נשמרת בדפדפן הזה בלבד — אין חשבונות ואין שרת שמחזיק אותה.
          </p>
        </div>
      ) : loading && rows.length === 0 ? (
        <p className="surface px-5 py-6 text-[13px] text-ink-muted">טוען…</p>
      ) : (
        <div className="surface overflow-hidden">
          {rows.map((row) => (
            <div
              key={row.ticker}
              className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[1.4fr_auto_auto_auto_auto_auto]"
            >
              <span className="min-w-0">
                <Link
                  href={`/company/${row.ticker}`}
                  className="num block text-[13px] font-medium text-ink hover:text-accent"
                >
                  {row.ticker}
                </Link>
                <span className="block truncate text-[11px] text-ink-faint" dir="auto">
                  {row.name ?? "מחוץ ליקום המדדים של האתר"}
                  {row.sector ? ` · ${row.sector}` : ""}
                </span>
              </span>

              <span className="text-end">
                <span className="num block text-[14px] text-ink">
                  {fmtPrice(row.price)}
                </span>
                <span
                  className={`num block text-[11px] ${directionClass(row.changePercent)}`}
                >
                  {fmtPercent(row.changePercent)}
                </span>
              </span>

              {[
                { label: "P/E", value: row.metrics?.pe ?? null, unit: "x" as const },
                {
                  label: "ROIC",
                  value: row.metrics?.roic ?? null,
                  unit: "%" as const,
                },
                {
                  label: "צמיחת הכנסות 3ש׳",
                  value: row.metrics?.rev_cagr_3 ?? null,
                  unit: "%" as const,
                },
              ].map((metric) => (
                <span key={metric.label} className="hidden text-end sm:block">
                  <span className="block text-[10px] text-ink-ghost">
                    {metric.label}
                  </span>
                  <span className="num block text-[13px] text-ink-muted">
                    {fmtMetric(metric.value, metric.unit)}
                  </span>
                </span>
              ))}

              <span className="flex items-center justify-end gap-2">
                {row.news.count > 0 && (
                  <span className="badge" title={row.news.top?.title ?? ""}>
                    {row.news.count} בפיד
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(row.ticker)}
                  className="btn btn-ghost px-2 py-1 text-[11px]"
                  title={`הסר את ${row.ticker} מהמעקב`}
                >
                  הסר
                </button>
              </span>
            </div>
          ))}
        </div>
      )}

      {checkedAt && (
        <p className="text-[11px] text-ink-ghost">
          נבדק {fmtRelative(checkedAt)} · מתעדכן לבד כל דקה בזמן שהלשונית
          פתוחה
        </p>
      )}
    </div>
  );
}
