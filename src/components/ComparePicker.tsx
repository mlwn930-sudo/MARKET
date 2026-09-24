"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { normaliseTicker } from "@/lib/company-names";

/**
 * Choosing what to compare.
 *
 * The selection lives in the URL rather than in component state, so a
 * comparison can be sent to someone, bookmarked, or reopened tomorrow. That
 * is worth a full navigation per change on a page whose data is cached
 * anyway.
 */
export function ComparePicker({
  selected,
  suggestions,
  max,
}: {
  selected: string[];
  suggestions: { ticker: string; name: string }[];
  /** Passed in rather than imported: the limit lives beside the query that
   *  enforces it, in lib/compare.ts, which reads files and cannot be
   *  imported into a client component. */
  max: number;
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");

  const go = (tickers: string[]) => {
    const unique = [...new Set(tickers)].slice(0, max);
    router.push(unique.length > 0 ? `/compare?tickers=${unique.join(",")}` : "/compare");
  };

  const add = (raw: string) => {
    const ticker = normaliseTicker(raw);
    if (!ticker) return;
    setDraft("");
    go([...selected, ticker]);
  };

  const shortlist = suggestions
    .filter((company) => !selected.includes(company.ticker))
    .slice(0, 10);

  return (
    <div className="surface space-y-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        {selected.map((ticker) => (
          <span
            key={ticker}
            className="inline-flex items-center gap-2 rounded-md border border-line-strong bg-raised px-2.5 py-1"
          >
            <span className="num text-[12px] text-ink">{ticker}</span>
            <button
              type="button"
              onClick={() => go(selected.filter((t) => t !== ticker))}
              className="text-[12px] text-ink-faint transition-colors hover:text-ink"
              aria-label={`הסר את ${ticker} מההשוואה`}
            >
              ×
            </button>
          </span>
        ))}

        {selected.length === 0 && (
          <span className="text-[12px] text-ink-faint">
            בחר שתיים עד {max} חברות.
          </span>
        )}
      </div>

      <form
        onSubmit={(event) => {
          event.preventDefault();
          add(draft);
        }}
        className="flex items-center gap-2"
      >
        <label htmlFor="compare-add" className="sr-only">
          הוספת חברה להשוואה
        </label>
        <input
          id="compare-add"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="סימבול או שם"
          autoComplete="off"
          spellCheck={false}
          disabled={selected.length >= max}
          className="num w-44 rounded-md border border-line bg-base px-3 py-1.5 text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-line-strong focus:outline-none disabled:opacity-40"
        />
        <button
          type="submit"
          disabled={selected.length >= max}
          className="btn btn-ghost px-3 py-1.5 text-[12px] disabled:opacity-40"
        >
          הוסף
        </button>
      </form>

      {shortlist.length > 0 && selected.length < max && (
        <div className="flex flex-wrap gap-1.5 border-t border-line pt-3">
          {shortlist.map((company) => (
            <button
              key={company.ticker}
              type="button"
              onClick={() => go([...selected, company.ticker])}
              title={company.name}
              className="pill num text-[11px]"
            >
              {company.ticker}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
