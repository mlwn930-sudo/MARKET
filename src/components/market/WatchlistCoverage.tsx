"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { WATCHLIST_EVENT, getWatchlist } from "@/lib/watchlist";

import { SIGNIFICANCE_LABELS } from "@/lib/news-shape";
import type { CoverageRow } from "@/app/api/watchlist-coverage/route";

/**
 * The watchlist's own news and its own charts.
 *
 * What a watchlist is for is knowing what happened to the companies on
 * it, and this page could not answer either half. The news was filtered
 * out of the site's general market wire — a hundred stories about
 * everything, of which five were tagged NVDA and one TTWO — so following
 * two companies produced two headlines and the reasonable conclusion that
 * the feature was broken. And the chart was absent entirely: the page
 * knew a price had moved and said nothing about what the chart was doing,
 * while the agent was emailing exactly that.
 *
 * Both now come from the same places the rest of the site uses. The news
 * is the company's own wire; the chart is `readSetup`, the same read that
 * produces the alerts, so the page and the inbox describe one situation
 * rather than two.
 *
 * THE READINGS ARE THE ONES ALREADY WRITTEN. A story the scheduled queue
 * has not reached yet says so rather than being analysed on a page
 * render: generating on render would put the model's daily budget at the
 * mercy of how often somebody refreshes, and the queue reaches it within
 * the half hour anyway.
 */

type State =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "ready"; rows: CoverageRow[] }
  | { phase: "error"; message: string };

const relative = (iso: string) => {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  const minutes = Math.round((Date.now() - at) / 60_000);
  if (minutes < 60) return `לפני ${Math.max(1, minutes)} דק׳`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `לפני ${hours} שע׳`;
  return `לפני ${Math.round(hours / 24)} ימים`;
};

function Article({ article }: { article: CoverageRow["articles"][number] }) {
  const reading = article.analysis;
  return (
    <li className="cover-article">
      <a href={article.url} target="_blank" rel="noopener noreferrer">
        {article.title}
      </a>
      <div className="cover-meta">
        <span dir="ltr">{article.source}</span>
        {article.at && <span>· {relative(article.at)}</span>}
        {reading && (
          <span className="cover-badge">
            {SIGNIFICANCE_LABELS[reading.significance]}
          </span>
        )}
      </div>
      {reading ? (
        <p className="cover-reading">{reading.summary}</p>
      ) : (
        /* Said rather than hidden. A story with no reading looks exactly
           like a story the site chose not to care about, and the
           difference matters to somebody deciding whether to click it. */
        <p className="cover-reading cover-reading--pending">
          הקריאה לכתבה הזו עוד לא נכתבה. התור מגיע אליה בתוך חצי שעה.
        </p>
      )}
    </li>
  );
}

function Setup({ setup }: { setup: NonNullable<CoverageRow["setup"]> }) {
  const all = [...setup.observations, ...setup.tension];
  if (all.length === 0) {
    return (
      <p className="cover-quiet">
        אף תנאי נמדד אינו נכון על הנייר הזה כרגע. רוב הימים אינם אירוע.
      </p>
    );
  }
  return (
    <>
      <ul className="cover-signals">
        {all.slice(0, 5).map((o) => (
          <li key={o.key} className={`cover-signal cover-signal--${o.side}`}>
            <span className="cover-signal-label">{o.label}</span>
            {o.record && (
              <span className="cover-signal-record num">
                {o.record.occurrences} מופעים · {Math.round(o.record.upRate * 100)}%
                {" מול "}
                {Math.round(o.record.baselineRate * 100)}%
                {Math.abs(o.record.liftPp) < 10 ? " — לא הוסיף מידע" : ""}
              </span>
            )}
          </li>
        ))}
      </ul>
      {setup.tension.length > 0 && (
        <p className="cover-tension">
          הקריאות לא מסכימות — {setup.tension.length} מהן מושכות לכיוון השני.
        </p>
      )}
    </>
  );
}

export function WatchlistCoverage() {
  const [tickers, setTickers] = useState<string[]>([]);
  const [state, setState] = useState<State>({ phase: "idle" });

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

  useEffect(() => {
    if (tickers.length === 0) {
      setState({ phase: "idle" });
      return;
    }
    let live = true;
    setState({ phase: "loading" });
    fetch("/api/watchlist-coverage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ tickers }),
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error())))
      .then((payload) => {
        if (live) setState({ phase: "ready", rows: payload.rows ?? [] });
      })
      .catch(() => {
        if (live)
          setState({
            phase: "error",
            message: "לא הצלחנו למשוך את הכיסוי לחברות שברשימה.",
          });
      });
    return () => {
      live = false;
    };
  }, [tickers]);

  if (state.phase === "idle") {
    return (
      <p className="cover-quiet">
        הרשימה ריקה. חברה שתתווסף תקבל כאן את החדשות שלה, מנותחות, ואת מה
        שהגרף שלה עושה.
      </p>
    );
  }
  if (state.phase === "loading") {
    return <p className="cover-quiet">נמשך…</p>;
  }
  if (state.phase === "error") {
    return <p className="cover-quiet">{state.message}</p>;
  }

  return (
    <div className="cover-grid">
      {state.rows.map((row) => (
        <section key={row.ticker} className="cover-card">
          <div className="cover-head">
            <Link href={`/company/${row.ticker}`} className="num cover-ticker" dir="ltr">
              {row.ticker}
            </Link>
            <span className="cover-count num">
              {row.articles.length} כתבות · 14 ימים
            </span>
          </div>

          <h4 className="cover-section">מה הגרף עושה</h4>
          {row.error ? (
            <p className="cover-quiet">{row.error}</p>
          ) : row.setup ? (
            <Setup setup={row.setup} />
          ) : (
            <p className="cover-quiet">אין קריאה זמינה.</p>
          )}

          <h4 className="cover-section">מה נכתב עליה</h4>
          {row.articles.length === 0 ? (
            <p className="cover-quiet">
              לא נמצאו כתבות על הנייר הזה בשבועיים האחרונים.
            </p>
          ) : (
            <ul className="cover-articles">
              {row.articles.map((a) => (
                <Article key={a.url} article={a} />
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}
