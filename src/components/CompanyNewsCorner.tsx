import Link from "next/link";
import { getCompanyNews } from "@/lib/sources/finnhub";
import { mentionsCompany } from "@/lib/company-names";
import { feedSignature, getLiveFeed } from "@/lib/live-news";
import { getSummaries } from "@/lib/news-store";
import { TRIAGE_CAVEAT, triage } from "@/lib/news-triage";
import {
  CATALYST_LABELS,
  SIGNIFICANCE_LABELS,
  catalystMeaning,
  type EnrichedArticle,
} from "@/lib/news-shape";
import { AnalyzeArticleButton } from "@/components/AnalyzeArticleButton";
import { NewsAutoRefresh } from "@/components/NewsAutoRefresh";
import { ReadAt } from "@/components/ReadAt";
import { hasGeminiKey } from "@/lib/sources/gemini";
import { AiBlock, Empty, ErrorState } from "@/components/ui";
import { fmtRelative } from "@/lib/format";

/**
 * The company's news, in the corner of its own page.
 *
 * What was here before was the site's stored feed, filtered for the ticker:
 * `content/news/latest.json`, written by a scheduled workflow and committed
 * to the repository. That file is the one thing on a company page that does
 * not expire — it changes when a deployment lands, not when a story breaks —
 * so the news was the stalest thing on a page whose quote is thirty seconds
 * old. It was also rendered last, under twenty-three metric cells, which is
 * where a reader stops looking.
 *
 * So the corner now reads two live sources and states which one each story
 * came from:
 *
 *   The per-symbol wire. Finnhub's company-news endpoint, asked about this
 *   ticker over a fourteen-day window. This is the half that actually
 *   answers "news about this stock" — the general wire only ever carries
 *   companies large enough to make a market headline, and a page for one
 *   that did not would have shown nothing while coverage existed.
 *
 *   The site's own sector feed, filtered to the ticker. Already triaged and
 *   already carrying whatever reading the scheduled job has written, and it
 *   is what keeps this corner and /news telling the same story.
 *
 * Both are deduplicated by URL and by headline, because one press release
 * reaches a dozen outlets under the same words and a different link.
 *
 * ---- How fresh it is ----
 *
 * The page revalidates every ten minutes. The sector feed behind it is
 * rebuilt every two, and the per-symbol wire is asked for with a revalidate
 * of the same two minutes — `getCompanyNews` defaults to fifteen, which is
 * right for the scheduled sweep that reads a dozen symbols at once and longer
 * than the page that renders this.
 *
 * That window lives on the request itself and not on a wrapper around it.
 * An earlier version of this file wrapped the call in `unstable_cache` with a
 * two-minute revalidate and news tags, which read as the same thing and was
 * not: the wrapper only re-runs the callback, the request inside it kept its
 * own fifteen minutes, and Next does not pass a wrapper's tags down to a
 * fetch — it collects fetch tags onto a parent cache or prerender store and
 * skips an `unstable-cache` store deliberately. So the wrapper expired, the
 * callback re-ran, and the same quarter-hour-old payload came back out of the
 * data cache; a refresh with scope `news` dropped the wrapper and changed
 * nothing. One cache with the window and the tags on it is both honest and
 * fewer moving parts, and because the tags now reach the page's own cache
 * entry, a news refresh invalidates the rendered page as well instead of
 * leaving ten minutes of HTML in front of a wire that was just re-read.
 *
 * On top of that the corner carries `NewsAutoRefresh`, the same client that
 * keeps /news current: it polls a signature of the feed and pulls the page
 * again only when a story has actually moved, so an open tab keeps up
 * without re-rendering an expensive page on a timer.
 *
 * ---- The relevance test, and why it exists ----
 *
 * A provider tag is not a subject. Measured on this page: the two sources
 * returned 225 stories filed under NVDA over a fortnight, and 55 of them
 * mention Nvidia at all. The first corner built without the test led with a
 * Walmart price target, an IonQ-versus-D-Wave comparison and an Acuity
 * Brands earnings call — syndicated columns that list a dozen tickers in a
 * sidebar, which the wire then files under all twelve.
 *
 * So a story reaches the corner only if it names the company: the ticker as
 * a word, one of the company's known names, or a model that read the article
 * and listed the company in it. The naming half is `mentionsCompany` in
 * lib/company-names, which is where the site's alias table already lives and
 * where /news asks the same question of the same text — this file had its own
 * copy of the test for one commit, and two implementations of "is this about
 * Nvidia" is how a company page and the feed start disagreeing.
 *
 * Everything the test rejects is counted rather than silently dropped, and
 * both counts are printed under the corner — which is also what explains to a
 * reader why a busy wire produced eight rows.
 *
 * ---- What it never does ----
 *
 * It does not rank. Stories are newest first and nothing else, because the
 * question a reader brings to a company page is "what is the latest", and a
 * corner that reorders by importance hides whether anything happened today.
 * Each story carries its own catalyst-or-noise verdict instead, in the same
 * words the rest of the site uses, and the verdict is a claim about the
 * mechanism — never a recommendation to do anything about it.
 */

/** How far back the per-symbol wire is asked. Two weeks is long enough that
 *  a quiet fortnight reads as a quiet fortnight rather than as a gap, and
 *  short enough that nothing in the corner is old news.
 *
 *  What the provider actually returns is capped, and for a crowded symbol the
 *  cap bites long before the window does: measured on NVDA, a fourteen-day
 *  request came back with 249 items spanning thirty-two hours. So the window
 *  is a ceiling and not a promise — on a quiet company it is honoured, and on
 *  a loud one the wire half of the corner is the last day or two. */
const WINDOW_DAYS = 14;

/** Eight fills four rows of two on a desktop and stays scrollable on a
 *  phone. The corner is a corner; the whole feed is at /news. */
const LIMIT = 8;

/**
 * How long the per-symbol wire may be reused, in seconds.
 *
 * Two minutes, for three reasons that happen to agree. The page itself
 * revalidates every ten, so anything longer than that would make the wire —
 * not the page — the thing holding the corner back. The sector feed in the
 * other half of the corner is rebuilt every two, and two halves ageing at the
 * same rate is what lets the corner state one freshness rather than two. And
 * the cost is bounded: the entry is shared by every reader and every open tab,
 * so a symbol someone is reading costs at most one request per two minutes
 * against a free tier of sixty per minute — the same page already spends
 * seven Finnhub calls before it renders.
 */
const WIRE_SECONDS = 120;

/** Enough of a headline to recognise the same story under another byline. */
const SYNDICATION_KEY = 90;

export type CompanyNewsItem = EnrichedArticle & {
  /** Which of the two sources produced this story. Shown to the reader,
   *  because "Finnhub filed this under NVDA" and "our sector feed mentions
   *  NVDA somewhere in it" are different strengths of claim. */
  origin: "wire" | "feed";
};

export type CompanyNews = {
  ticker: string;
  /** What the corner renders: the newest `LIMIT` of them. A count taken off
   *  this array is a count of what is on screen and nothing else. */
  items: CompanyNewsItem[];
  /** Every story that passed the screen, newest first — the list, not the
   *  view of it. The page's other readers take this one: the connection index
   *  prints how many stories mention the company, and "why is it moving"
   *  counts the ones filed in the last thirty-six hours. Both read `items`
   *  once and both reported eight, which is the display limit wearing a
   *  total's clothes. */
  all: CompanyNewsItem[];
  windowDays: number;
  /** False only when the per-symbol wire itself failed. An empty corner and
   *  a provider that did not answer are different sentences, and the reader
   *  gets the right one. */
  wireOk: boolean;
  /** The signature and the analysed count of the *whole* feed, which is what
   *  the status route reports and therefore what the poller compares. */
  feedSignature: string;
  feedAnalysed: number;
  /** How many stories the two sources returned between them, after
   *  deduplication. Printed against `all.length`: the gap between them is the
   *  provider's tagging, and a reader looking at three rows deserves to know
   *  that eleven arrived. */
  returned: number;
  /** When this corner was assembled, as an ISO string — which is all a server
   *  can honestly say about it. Formatting it here would measure the render
   *  against itself and print "הרגע" into HTML the page then caches for ten
   *  minutes, so the string is handed to `ReadAt` and turned into a figure in
   *  the reader's browser. */
  readAt: string;
};

function isoDaysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/* ------------------------------------------------------------------ */
/* Is this story about this company                                    */
/* ------------------------------------------------------------------ */

/**
 * Whether the article itself supports the tag it arrived under.
 *
 * Two strengths, and only the second is about words. A model that read the
 * article and listed the company is corroboration in itself and needs no
 * text test. Everything else has to name the company, and that question is
 * `mentionsCompany` — the site's one answer to it, over the same alias table
 * the search box and the feed filter use.
 */
function isAbout(
  item: CompanyNewsItem,
  symbol: string,
  name: string | null,
): boolean {
  if (item.analysis?.tickers.includes(symbol)) return true;
  return mentionsCompany(`${item.title} ${item.excerpt}`, symbol, name);
}

/**
 * The per-symbol wire.
 *
 * `WIRE_SECONDS` and the news tags travel on the request itself, which is the
 * only place they do anything: a wrapper around this call cannot shorten the
 * window of the fetch inside it and cannot tag it either. With the tags on the
 * request, a refresh with scope `news` drops this payload and the page that
 * rendered it together, and the symbol's own tag keeps one reader refreshing
 * NVDA from re-fetching the wire for every other company someone is reading.
 *
 * The reading is deliberately *not* attached in here. Analysis is written by
 * a separate job into a separate file, and caching the two together would
 * mean a story keeps the "not analysed yet" line for two minutes after its
 * reading has been written. The cache holds the wire; the file is read fresh
 * and merged on top of it.
 */
async function readWire(
  symbol: string,
): Promise<{ ok: boolean; items: CompanyNewsItem[] }> {
  try {
    const raw = await getCompanyNews(
      symbol,
      isoDaysAgo(WINDOW_DAYS),
      new Date().toISOString().slice(0, 10),
      { revalidate: WIRE_SECONDS, tags: ["news", `news:${symbol}`] },
    );

    const items: CompanyNewsItem[] = [];
    for (const item of raw) {
      if (!item.url || !item.headline) continue;

      /* The same rules the feed uses. Service journalism is dropped rather
         than labelled: a company page carrying "3 chip stocks to buy now"
         next to an earnings warning teaches the reader to skim past both. */
      const read = triage(item.headline, item.summary ?? "");
      if (read.drop) continue;

      items.push({
        url: item.url,
        title: item.headline,
        excerpt: item.summary ?? "",
        image: null,
        domain: item.source || hostOf(item.url),
        country: null,
        seenAt: item.publishedAt.toISOString(),
        /* The symbol it was filed under. The provider's `related` field
           carries more, but only the ones the site has a page for are
           worth printing, and the sector feed below is where those come
           from with their sector attached. */
        tickers: [symbol],
        analysis: null,
        triage: read,
        origin: "wire",
      });
    }

    return { ok: true, items };
  } catch {
    /* No key, a 403, or a shape the schema rejected. The corner falls back
       to the sector feed and says the wire went quiet. */
    return { ok: false, items: [] };
  }
}

/**
 * Everything written about one company, from both sources, newest first.
 *
 * Returned to the page rather than fetched inside the view, because the
 * page's "why is it moving" panel and its connection index read the same
 * list. One fetch and one list means the corner and the panel above it
 * cannot disagree about whether anything was written.
 */
export async function loadCompanyNews(
  ticker: string,
  /** The company's registered name, for the relevance test. Null is allowed
   *  and costs only the name half of it — the ticker test still applies. */
  name: string | null,
  limit = LIMIT,
): Promise<CompanyNews> {
  const symbol = ticker.toUpperCase();

  /* getSummaries swallows its own failures and returns an empty record, so
     there is nothing to catch here; getLiveFeed can throw and the wire alone
     is still a corner worth rendering. */
  const [wire, feed, summaries] = await Promise.all([
    readWire(symbol),
    getLiveFeed().catch(() => null),
    getSummaries(),
  ]);

  const fromFeed: CompanyNewsItem[] = [];
  for (const sector of feed?.sectors ?? []) {
    for (const article of sector.articles) {
      const mentioned =
        article.tickers.includes(symbol) ||
        Boolean(article.analysis?.tickers.includes(symbol));
      if (mentioned) fromFeed.push({ ...article, origin: "feed" });
    }
  }

  /* The wire goes in first, so when the same story arrives from both it
     keeps the stronger label: the provider filed it under this symbol. */
  const seen = new Set<string>();
  const unique: CompanyNewsItem[] = [];

  for (const item of [...wire.items, ...fromFeed]) {
    const headline = item.title.trim().toLowerCase().slice(0, SYNDICATION_KEY);
    if (seen.has(item.url) || seen.has(headline)) continue;
    seen.add(item.url);
    seen.add(headline);

    /* The feed arrives with its reading already merged; the wire does not,
       and gets it here from the same file keyed by the same URL. */
    unique.push(
      item.analysis ? item : { ...item, analysis: summaries[item.url] ?? null },
    );
  }

  const about = unique.filter((item) => isAbout(item, symbol, name));

  about.sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""));

  return {
    ticker: symbol,
    items: about.slice(0, limit),
    /* The whole screened list, not a second count of it. Anything that wants
       to know how much was written reads this and takes its length, so the
       figure on the corner and the figure in the connection index are the
       same figure rather than two that agree by luck. */
    all: about,
    windowDays: WINDOW_DAYS,
    wireOk: wire.ok,
    feedSignature: feed ? feedSignature(feed) : "",
    feedAnalysed: feed?.analysedCount ?? 0,
    returned: unique.length,
    readAt: new Date().toISOString(),
  };
}

/* ------------------------------------------------------------------ */
/* The corner                                                          */
/* ------------------------------------------------------------------ */

export function CompanyNewsCorner({
  ticker,
  name,
  news,
}: {
  ticker: string;
  name: string;
  news: CompanyNews;
}) {
  /* Nothing to show, and three different reasons for it. A provider that did
     not answer, a fortnight in which nobody wrote, and a wire that filed
     other companies' columns under this symbol are three different
     sentences, and a reader deciding whether to come back later needs the
     right one. */
  if (news.items.length === 0) {
    return news.wireOk ? (
      <Empty
        title={
          news.returned > 0
            ? `אף אחת מהכתבות שתויקו תחת ${ticker} לא עוסקת בחברה`
            : `לא נמצאה כתבה על ${name} ב-${news.windowDays} הימים האחרונים`
        }
        reason={
          news.returned > 0
            ? `המקורות החזירו ${news.returned} כתבות שתויקו תחת הסימול, ואף אחת מהן לא מזכירה את ${name} בכותרת או בפתיח. זה הדפוס הרגיל של טורי דעה מסונדקים: הם מונים תריסר סימולים בשוליים, והחוט מתייק אותם תחת כולם. כתבה כזו אינה חדשות על החברה ולכן אינה נכנסת לכאן.`
            : `נבדקו שני מקורות: החוט של Finnhub לסימול ${ticker}, והפיד הסקטוריאלי של האתר. שניהם ענו ולא החזירו כלום — כלומר על החברה לא נכתב, לא שהבדיקה נכשלה. חברה שלא הייתה בכותרות שבועיים היא המקרה הרגיל ולא סימן לכלום.`
        }
        links={[
          { href: "/news", label: "כל החדשות" },
          {
            href: `/research?ticker=${ticker}`,
            label: `מחקר עומק על ${ticker}`,
          },
          { href: "/brief", label: "התדריך של היום" },
        ]}
      />
    ) : (
      <ErrorState
        title={`החוט לסימול ${ticker} לא ענה`}
        detail="הפינה נשענת על שני מקורות, והראשון מביניהם לא החזיר תשובה בבקשה הזו. הפיד הסקטוריאלי של האתר גם לא מזכיר את החברה, ולכן אין כאן כתבה להציג. הבקשה נשלחת מחדש בכל רענון של העמוד."
        source="Finnhub company-news"
        links={[
          { href: "/news", label: "כל החדשות" },
          {
            href: `/research?ticker=${ticker}`,
            label: `מחקר עומק על ${ticker}`,
          },
        ]}
      />
    );
  }

  const analysed = news.items.filter((item) => item.analysis).length;
  const newest = news.items[0]?.seenAt;
  const canAnalyse = hasGeminiKey();

  return (
    <div className="news-corner surface">
      {/* The state of the corner, before its contents. Every figure here
          arrives with what it should be read against: how many stories over
          how many days, how many of them carry a model's reading out of the
          total, and when the sources were last asked. */}
      <div className="news-corner-head">
        <span className="news-corner-live">
          <i aria-hidden="true" />
          פינה חיה
        </span>

        {/* The count on screen and the count that exists are not the same
            figure, and printing only the first would have read as "eight
            stories in a fortnight" on a company with fifty-five. */}
        <span>
          {news.all.length > news.items.length ? (
            <>
              <span className="num">{news.items.length}</span> מתוך{" "}
              <span className="num">{news.all.length}</span> כתבות על החברה ב-
            </>
          ) : (
            <>
              <span className="num">{news.all.length}</span> כתבות על החברה ב-
            </>
          )}
          <span className="num">{news.windowDays}</span> הימים האחרונים
        </span>

        <span>
          <span className="num">{analysed}</span> מתוך{" "}
          <span className="num">{news.items.length}</span> נקראו על ידי מודל
        </span>

        {newest && <span>החדשה שבהן {fmtRelative(new Date(newest))}</span>}

        {/* Measured in the browser, not here. A server formatting this would
            be comparing the render to itself. */}
        <span className="news-corner-when">
          <ReadAt
            at={news.readAt}
            title={`הזמן שבו הפינה הורכבה — כלומר הגיל של מה שעל המסך, לא של הכתבות עצמן. החוט של Finnhub שמאחוריה נקרא מחדש כל ${WIRE_SECONDS / 60} דקות, ולכן התוכן יכול להיות ישן בעוד כמה דקות מהמספר הזה.`}
          />
          <NewsAutoRefresh
            signature={news.feedSignature}
            analysedCount={news.feedAnalysed}
          />
        </span>
      </div>

      <div className="news-rows">
        {news.items.map((item) => (
          <NewsRow
            key={item.url}
            item={item}
            ticker={ticker}
            canAnalyse={canAnalyse}
          />
        ))}
      </div>

      {/* Where it came from and how it stays current, in one line, because
          a live corner that does not say what it is reading is a corner the
          reader has to take on trust. */}
      <p className="news-corner-foot">
        מהחוט של Finnhub לסימול <span className="num">{ticker}</span> ומהפיד
        הסקטוריאלי של האתר, שמתרענן כל שתי דקות. מתוך{" "}
        <span className="num">{news.returned}</span> כתבות שתויקו תחת הסימול,{" "}
        <span className="num">{news.all.length}</span> מזכירות את החברה בכותרת או
        בפתיח ורק הן נכנסות לכאן — טור מסונדק שמונה תריסר סימולים בשוליים אינו
        חדשות על החברה. הפינה נטענת מחדש מעצמה כשמגיעה כתבה, בלי לאבד את המקום
        שבו אתה קורא.{" "}
        <Link href="/news" className="underline underline-offset-2">
          כל החדשות
        </Link>
      </p>
    </div>
  );
}

/**
 * One story.
 *
 * No image, for the same reason the feed's card has none: publisher
 * thumbnails expire, arrive at unusable crops, and on a page where the
 * useful signal is "did this change the business" a photograph is the least
 * informative thing in the row.
 *
 * The verdict is a label and never a colour. Green and red mean price
 * direction everywhere on this site, and a consequential story is neither
 * good nor bad until you know which side of it you are on.
 */
function NewsRow({
  item,
  ticker,
  canAnalyse,
}: {
  item: CompanyNewsItem;
  ticker: string;
  canAnalyse: boolean;
}) {
  const { analysis } = item;
  const read = item.triage;

  /* A model's reading wins where one exists; the rule-based pass is the
     floor, and it is labelled as a weaker claim rather than dressed up as
     the same one. */
  const verdict = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].label
    : read
      ? read.kind === "catalyst"
        ? "זרז אפשרי"
        : read.kind === "noise"
          ? "רעש"
          : "לא הוכרע"
      : null;

  const verdictNote = analysis?.catalystKind
    ? CATALYST_LABELS[analysis.catalystKind].note
    : TRIAGE_CAVEAT;

  /* Other companies the story names. The page's own ticker is dropped — the
     reader is already on it — and what is left is the part of the story that
     is navigable: who else this touches. */
  const others = [...new Set([...(analysis?.tickers ?? []), ...item.tickers])]
    .filter((symbol) => symbol !== ticker)
    .slice(0, 4);

  return (
    <article className="news-row">
      <div className="news-row-meta">
        {/* The feed's card sets this one in the accent. Here it stays the
            badge's own neutral: on the night ground the brand blue measures
            3.2:1, which is a border colour and not a word, and a 10.5px
            label is the smallest word on the page. */}
        {analysis && (
          <span className="badge">
            {SIGNIFICANCE_LABELS[analysis.significance]}
          </span>
        )}
        {verdict && (
          <span className="badge" title={verdictNote}>
            {verdict}
          </span>
        )}
        <span
          className="news-row-origin"
          title={
            item.origin === "wire"
              ? `הכתבה הגיעה מהחוט של Finnhub תחת הסימול ${ticker}`
              : "הכתבה הגיעה מהפיד הסקטוריאלי של האתר ומזכירה את החברה"
          }
        >
          {item.origin === "wire" ? `החוט של ${ticker}` : "פיד הסקטור"}
        </span>

        <span className="news-row-source" dir="auto">
          {item.domain}
          {item.seenAt && ` · ${fmtRelative(new Date(item.seenAt))}`}
        </span>
      </div>

      <a
        className="news-row-title"
        href={item.url}
        target="_blank"
        rel="noopener noreferrer"
        dir="auto"
      >
        {item.title}
      </a>

      {analysis ? (
        /* Model text, inside the frame the site requires for it: what it is,
           how confident it is, which source it was written against, and when.
           The publisher's own blurb is dropped here — the reading replaces
           it, and printing both turns a row into a wall. */
        <AiBlock
          title="קריאת מודל"
          confidence={analysis.catalystKind === "unclear" ? "low" : "medium"}
          sources={[item.domain]}
          at={
            analysis.writtenAt
              ? fmtRelative(new Date(analysis.writtenAt))
              : undefined
          }
        >
          <p className="news-read">{analysis.summary}</p>
          <p className="news-read-impact">
            <span>השפעה: </span>
            {analysis.impact}
          </p>

          {(catalystMeaning(analysis.catalystKind) ||
            analysis.catalyst ||
            analysis.reaction ||
            analysis.chain) && (
            <details className="news-lenses">
              <summary>מה זה אומר, ובשלוש עדשות</summary>

              {catalystMeaning(analysis.catalystKind) && (
                <p className="news-read-meaning">
                  {catalystMeaning(analysis.catalystKind)}
                </p>
              )}

              <dl>
                {[
                  { label: "זרז או רעש", body: analysis.catalyst },
                  { label: "תגובת מחיר מול ציפיות", body: analysis.reaction },
                  { label: "שרשרת הערך", body: analysis.chain },
                ]
                  .filter((lens) => lens.body)
                  .map((lens) => (
                    <div key={lens.label}>
                      <dt>{lens.label}</dt>
                      <dd>{lens.body}</dd>
                    </div>
                  ))}
              </dl>
            </details>
          )}
        </AiBlock>
      ) : (
        <>
          {item.excerpt && (
            <p className="news-row-excerpt" dir="auto">
              {item.excerpt}
            </p>
          )}

          {/* Rule 9, applied to a sentence rather than to a figure: the
              reading does not exist yet, so the row says so instead of
              implying the headline was understood. */}
          <p className="news-row-floor">
            {read ? (
              <>
                <span>סיווג ראשוני לפי כללים: </span>
                {read.reason}
                {". "}
              </>
            ) : null}
            קריאת מודל עדיין לא נכתבה לכתבה הזו.
          </p>

          {canAnalyse && (
            <AnalyzeArticleButton url={item.url} title={item.title} />
          )}
        </>
      )}

      {others.length > 0 && (
        <div className="news-row-tickers">
          <span>מוזכרות גם</span>
          {others.map((symbol) => (
            <Link key={symbol} href={`/company/${symbol}`} className="num">
              {symbol}
            </Link>
          ))}
        </div>
      )}
    </article>
  );
}
