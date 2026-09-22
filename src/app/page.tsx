import Link from "next/link";
import { getQuotes, type Quote } from "@/lib/sources/finnhub";
import { TickerSearch } from "@/components/TickerSearch";
import {
  fmtPrice,
  fmtPercent,
  fmtChange,
  directionClass,
  fmtTime,
} from "@/lib/format";

// Finnhub's free tier does not carry index symbols, so we track the ETFs that
// follow them. The label says which index each one tracks — never imply the
// ETF *is* the index.
const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500", note: "SPY" },
  { symbol: "QQQ", label: "Nasdaq 100", note: "QQQ" },
  { symbol: "IWM", label: "Russell 2000", note: "IWM" },
  { symbol: "DIA", label: "Dow Jones", note: "DIA" },
];

const WATCHLIST = ["NVDA", "AAPL", "MSFT", "AMZN", "GOOGL", "META", "TSLA"];

export const revalidate = 30;

export default async function Home() {
  const [indexQuotes, watchQuotes] = await Promise.all([
    getQuotes(INDEX_PROXIES.map((i) => i.symbol)),
    getQuotes(WATCHLIST),
  ]);

  const stamp = indexQuotes.find((q) => q)?.at;

  return (
    <main className="mx-auto max-w-5xl px-6 py-8">
      <header className="flex items-center justify-between border-b border-line pb-5">
        <div className="flex items-baseline gap-3">
          <h1 className="text-xl text-gold">Market Intel</h1>
          <span className="text-xs text-ink-muted">שוק ההון האמריקאי</span>
        </div>
        {stamp && (
          <div className="flex items-center gap-2 text-xs text-up">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" />
            <span className="num">עודכן {fmtTime(stamp)}</span>
          </div>
        )}
      </header>

      <section className="mt-6" aria-labelledby="indices">
        <h2 id="indices" className="sr-only">
          מדדים מובילים
        </h2>
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-lg bg-line md:grid-cols-4">
          {INDEX_PROXIES.map((idx, i) => {
            const q = indexQuotes[i];
            return (
              <div key={idx.symbol} className="bg-surface px-4 py-3">
                <div className="flex items-baseline justify-between">
                  <span className="text-[11px] tracking-wide text-ink-muted">
                    {idx.label}
                  </span>
                  <span className="num text-[10px] text-ink-faint">
                    {idx.note}
                  </span>
                </div>
                <div className="num mt-1 text-lg">{fmtPrice(q?.price)}</div>
                <div
                  className={`num text-xs ${directionClass(q?.changePercent)}`}
                >
                  {fmtPercent(q?.changePercent)}
                </div>
              </div>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-ink-faint">
          המדדים מוצגים דרך קרנות הסל העוקבות אחריהם.
        </p>
      </section>

      <section className="mt-8" aria-labelledby="watchlist">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="watchlist" className="text-base">
            רשימת מעקב
          </h2>
          <TickerSearch />
        </div>
        <div className="overflow-hidden rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-line bg-surface text-[11px] text-ink-muted">
                <th className="px-4 py-2 text-right font-normal">סימבול</th>
                <th className="px-4 py-2 text-right font-normal">מחיר</th>
                <th className="px-4 py-2 text-right font-normal">שינוי</th>
                <th className="px-4 py-2 text-right font-normal">%</th>
                <th className="hidden px-4 py-2 text-right font-normal sm:table-cell">
                  טווח יומי
                </th>
              </tr>
            </thead>
            <tbody>
              {WATCHLIST.map((symbol, i) => {
                const q: Quote | null = watchQuotes[i];
                return (
                  <tr
                    key={symbol}
                    className="border-b border-line last:border-0 hover:bg-surface"
                  >
                    <td className="num px-4 py-2.5 text-right">
                      <Link
                        href={`/company/${symbol}`}
                        className="hover:text-gold"
                      >
                        {symbol}
                      </Link>
                    </td>
                    <td className="num px-4 py-2.5 text-right">
                      {fmtPrice(q?.price)}
                    </td>
                    <td
                      className={`num px-4 py-2.5 text-right ${directionClass(q?.change)}`}
                    >
                      {fmtChange(q?.change)}
                    </td>
                    <td
                      className={`num px-4 py-2.5 text-right ${directionClass(q?.changePercent)}`}
                    >
                      {fmtPercent(q?.changePercent)}
                    </td>
                    <td className="num hidden px-4 py-2.5 text-right text-ink-muted sm:table-cell">
                      {q ? `${fmtPrice(q.low)} – ${fmtPrice(q.high)}` : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
