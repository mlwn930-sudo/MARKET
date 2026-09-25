"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Empty } from "@/components/ui";
import {
  LEVEL_LABELS,
  PORTFOLIO_EVENT,
  getHoldings,
  readPortfolio,
  setHoldings,
  type Holding,
  type Summary,
} from "@/lib/portfolio";
import { normaliseTicker } from "@/lib/company-names";
import { directionClass, fmtMetric, fmtPercent, fmtPrice } from "@/lib/format";

/**
 * Build a portfolio and see what it is exposed to.
 *
 * Weights are entered as plain numbers and normalised to 100% — a reader
 * thinking in shekels, in shares, or in "about a third" all get the same
 * answer without converting anything first.
 *
 * The readings never say buy, sell or hold, and the page says so twice.
 * What they say is what the holdings add up to: how much rests on one
 * name, how much on one sector, what multiple is being paid, and how much
 * of it the site could not measure at all.
 */

type Row = {
  ticker: string;
  name: string | null;
  sector: string | null;
  share: number;
  price: number | null;
  changePercent: number | null;
  pe: number | null;
  roic: number | null;
  measured: boolean;
};

export function PortfolioBuilder() {
  const [holdings, setLocal] = useState<Holding[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(false);
  const [draft, setDraft] = useState({ ticker: "", weight: "" });

  useEffect(() => {
    const sync = () => setLocal(getHoldings());
    sync();
    window.addEventListener(PORTFOLIO_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(PORTFOLIO_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const load = useCallback(async (list: Holding[]) => {
    if (list.length === 0) {
      setRows([]);
      setSummary(null);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/portfolio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ holdings: list }),
      });
      const data = await res.json();
      setRows(data.rows ?? []);
      setSummary(data.summary ?? null);
    } catch {
      /* Leaves the previous reading on screen rather than blanking it. */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(holdings);
  }, [holdings, load]);

  const add = () => {
    const ticker = normaliseTicker(draft.ticker);
    const weight = Number(draft.weight);
    if (!ticker || !Number.isFinite(weight) || weight <= 0) return;

    const next = [
      ...getHoldings().filter((h) => h.ticker !== ticker),
      { ticker, weight },
    ];
    setHoldings(next);
    setDraft({ ticker: "", weight: "" });
  };

  const remove = (ticker: string) =>
    setHoldings(getHoldings().filter((h) => h.ticker !== ticker));

  const readings = summary ? readPortfolio(summary) : [];

  return (
    <div className="space-y-6">
      {/* Entry */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          add();
        }}
        className="surface flex flex-wrap items-end gap-3 p-4"
      >
        <div>
          <label htmlFor="pf-ticker" className="block text-[11px] text-ink-faint">
            חברה
          </label>
          <input
            id="pf-ticker"
            value={draft.ticker}
            onChange={(e) => setDraft({ ...draft, ticker: e.target.value })}
            placeholder="NVDA או אנבידיה"
            autoComplete="off"
            className="num mt-1 w-44 rounded-md border border-line bg-base px-3 py-2 text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <div>
          <label htmlFor="pf-weight" className="block text-[11px] text-ink-faint">
            משקל
          </label>
          <input
            id="pf-weight"
            value={draft.weight}
            onChange={(e) => setDraft({ ...draft, weight: e.target.value })}
            placeholder="25"
            inputMode="decimal"
            className="num mt-1 w-24 rounded-md border border-line bg-base px-3 py-2 text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
          />
        </div>
        <button type="submit" className="btn btn-primary px-4 py-2 text-[13px]">
          הוסף
        </button>
        <p className="w-full text-[11px] leading-relaxed text-ink-ghost">
          המשקלים מנורמלים ל-100% לבד, אז אפשר להזין אחוזים, שקלים או מספר
          מניות — מה שנוח. הכול נשמר בדפדפן הזה בלבד.
        </p>
      </form>

      {holdings.length === 0 ? (
        <Empty
          title="התיק ריק"
          reason="הוסף שתי חברות לפחות כדי לראות במה התיק מרוכז, מה המכפיל שהוא משלם, ומה בו לא ניתן למדוד."
          links={[
            { href: "/watchlist", label: "מרשימת המעקב" },
            { href: "/opportunities", label: "מהסורק" },
            { href: "/sectors", label: "לפי סקטור" },
          ]}
        />
      ) : (
        <>
          {/* Holdings */}
          <div className="surface overflow-hidden">
            {rows.map((row) => (
              <div
                key={row.ticker}
                className="row grid-cols-[1fr_auto_auto] gap-4 sm:grid-cols-[1.2fr_auto_auto_auto_auto]"
              >
                <span className="min-w-0">
                  <Link
                    href={`/company/${row.ticker}`}
                    className="num block text-[13px] font-medium text-ink hover:text-accent"
                  >
                    {row.ticker}
                  </Link>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {row.name ?? "לא נמדד באתר"}
                    {row.sector ? ` · ${row.sector}` : ""}
                  </span>
                </span>

                <span className="self-center text-end">
                  <span className="num block text-[14px] text-ink">
                    {row.share.toFixed(1)}%
                  </span>
                  <span className="num block h-[3px] w-16 rounded-full bg-overlay">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.min(row.share, 100)}%`,
                        background: "var(--color-accent)",
                      }}
                    />
                  </span>
                </span>

                <span className="hidden self-center text-end sm:block">
                  <span className="num block text-[13px] text-ink-muted">
                    {fmtPrice(row.price)}
                  </span>
                  <span
                    className={`num block text-[11px] ${directionClass(row.changePercent)}`}
                  >
                    {fmtPercent(row.changePercent)}
                  </span>
                </span>

                <span className="hidden self-center text-end sm:block">
                  <span className="block text-[10px] text-ink-ghost">P/E</span>
                  <span className="num block text-[12px] text-ink-muted">
                    {fmtMetric(row.pe, "x")}
                  </span>
                </span>

                <button
                  type="button"
                  onClick={() => remove(row.ticker)}
                  className="btn btn-ghost self-center px-2 py-1 text-[11px]"
                >
                  הסר
                </button>
              </div>
            ))}
          </div>

          {/* Readings */}
          {summary && (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {readings.map((reading) => (
                  <article key={reading.key} className="surface p-5">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[13px] text-ink">{reading.title}</h3>
                      <span className="badge">{LEVEL_LABELS[reading.level]}</span>
                    </div>
                    <div className="num mt-2 text-[24px] text-ink">
                      {reading.figure}
                    </div>
                    <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
                      {reading.body}
                    </p>
                  </article>
                ))}
              </div>

              {/* Sector split */}
              <section className="surface p-5">
                <div className="mb-3 flex items-center gap-2.5">
                  <span className="section-mark" aria-hidden="true" />
                  <span className="eyebrow">פיזור לפי סקטור</span>
                </div>
                <div className="space-y-2">
                  {summary.sectors.map((entry) => (
                    <div key={entry.sector} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 text-[12px] text-ink-muted">
                        {entry.sector}
                      </span>
                      <span className="h-[6px] flex-1 rounded-full bg-overlay">
                        <span
                          className="block h-full rounded-full"
                          style={{
                            width: `${entry.share}%`,
                            background: "var(--color-accent)",
                            opacity: 0.8,
                          }}
                        />
                      </span>
                      <span className="num w-12 text-end text-[12px] text-ink">
                        {entry.share.toFixed(0)}%
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            </>
          )}
        </>
      )}

      {loading && <p className="text-[11px] text-ink-ghost">מחשב…</p>}
    </div>
  );
}
