/**
 * Automatic Hebrew analysis of the news feed.
 *
 * Runs after every news refresh: finds articles that have no analysis yet,
 * fetches the article text, and asks a language model to read it through a
 * fixed set of lenses in Hebrew. Writes content/news/summaries.json.
 *
 * The lenses are the point. Left to itself a model will summarise a story
 * and call the summary analysis; the prompt forces three specific questions
 * instead — is this a catalyst or noise, what has the price already done
 * about it, and who else in the value chain is affected. The first of those
 * is the one that earns its place: most of what reaches a news feed changes
 * nothing about a business, and a tool that treats every headline as
 * meaningful trains the reader to do the same.
 *
 * Designed to need no attention. Anything it cannot do — a paywalled
 * article, a missing key, a model that returns nonsense — it records and
 * moves past, rather than failing the run.
 *
 *   node scripts/summarize-news.mjs
 *
 * Needs GEMINI_API_KEY. Google's free tier issues one without a credit card
 * at aistudio.google.com and allows hundreds of requests a day, which is far
 * more than this needs: only new articles are analysed, so a normal cycle is
 * a handful of calls.
 */

import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const FEED = resolve(ROOT, "content/news/latest.json");
const OUT = resolve(ROOT, "content/news/summaries.json");

const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-lite-latest";
const API_KEY = process.env.GEMINI_API_KEY;

/**
 * Kept well under the free tier, and raised when the schedule was thinned.
 *
 * The workflow used to run every twenty minutes, so twenty-five new stories
 * a run was more than the feed ever produced. It now runs every half hour
 * during the session and twice a day outside it, which means a run has more
 * ground to cover — and a backlog that never clears is the same as no
 * analysis at all.
 *
 * Still a cap, because a flood of articles should not be able to spend the
 * day's model quota in a single run.
 */
const MAX_PER_RUN = 45;
const GAP_MS = 2_500;
const FETCH_TIMEOUT_MS = 20_000;

/** An article that could not be fetched is not retried for this long.
 *  Paywalls do not open on their own, and re-requesting every twenty
 *  minutes forever is rude to the publisher and pointless for us. */
const UNFETCHABLE_COOLDOWN_DAYS = 7;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * The whole editorial policy, in one place.
 *
 * Two rules here are not style preferences and must not be softened. The
 * model is told to explain the mechanism rather than assert a correlation,
 * because "bad news for chips" is not information. And it is forbidden to
 * recommend buying or selling: a recommendation built on a single headline
 * is exactly the failure this tool exists to help someone see past.
 */
const SYSTEM_PROMPT = `אתה אנליסט שוק ההון שכותב לקוראים ישראלים.

קיבלת כתבה. החזר JSON בלבד, בלי טקסט נוסף ובלי סימוני קוד, במבנה:
{"summary": "...", "impact": "...", "catalyst": "...", "catalystKind": "catalyst|noise|unclear", "reaction": "...", "chain": "...", "tickers": ["NVDA"], "significance": "high|medium|low"}

summary — שתי שורות לכל היותר, בעברית. מה קרה בפועל לפי הכתבה.
בלי תארים ובלי דרמה. "אינטל הודיעה על קיצוץ של 15% בכוח האדם"
ולא "אינטל בצעד דרמטי". צטט מספרים מהכתבה כפי שהם.

impact — שתיים עד שלוש שורות, בעברית. הסבר את המנגנון, לא רק את
הקשר. "מגבלות יצוא על ציוד ליתוגרפיה פוגעות ב-ASML כי כ-40%
מהכנסותיה מגיעות מאסיה" — ולא "חדשות רעות למגזר השבבים".
אם ההשפעה אינה ברורה, כתוב שהיא אינה ברורה. זו תשובה לגיטימית.

שלוש העדשות הבאות הן הליבה. כל אחת שורה עד שתיים, בעברית.

catalyst — האם זה זרז או רעש. זרז הוא אירוע שמשנה את התזרים העתידי
של החברה, את מבנה התחרות או את הרגולציה שהיא פועלת בה. רעש הוא אירוע
שמייצר כותרת ומשאיר את העסק כפי שהיה. מינוי מנהל שיווק הוא רעש; אובדן
לקוח שהוא 20% מההכנסות הוא זרז. כתוב איזה מהשניים ולמה — המנגנון, לא
התווית.

catalystKind — catalyst אם האירוע משנה את התזרים, התחרות או הרגולציה.
noise אם לא. unclear אם הכתבה לא נותנת די כדי להכריע. unclear היא
תשובה לגיטימית ועדיפה על ניחוש.

reaction — מה המחיר כבר עשה, ומה זה מלמד על הציפיות. אם הכתבה מציינת
תגובת מחיר, ציין אותה והסבר מה היא מגלה: מניה שעולה על דוח חלש אומרת
שהשוק ציפה לגרוע יותר, ומניה שיורדת על דוח טוב אומרת שהטוב כבר תומחר.
אם הכתבה לא מציינת תגובת מחיר, כתוב "הכתבה אינה מציינת תגובת מחיר"
ואל תשלים מהזיכרון.

chain — מי עוד בשרשרת הערך. ספק, לקוח, מתחרה, תחליף. מי מרוויח ומי
מפסיד מהאירוע הזה, ודרך איזה מנגנון. אם האירוע לא נוגע לאף אחד מעבר
לחברה עצמה, כתוב זאת.

tickers — טיקרים של חברות אמריקאיות שהכתבה נוגעת בהן ישירות.
רק חברות שמוזכרות בכתבה או שהקשר אליהן ישיר וברור. מערך ריק זה בסדר.

significance — high אם זה משנה את התמונה לסקטור שלם או לחברה גדולה,
medium אם רלוונטי אך אינו משנה תזה, low אם זה רעש שהגיע לפיד.

כללי ברזל:
- אסור להמליץ לקנות או למכור. לא במפורש ולא ברמז.
- אסור להמציא עובדה שלא מופיעה בכתבה. זה כולל תגובות מחיר, מספרים
  ושמות חברות. "לא מופיע בכתבה" היא תשובה נכונה.
- הטקסט שתקבל הוא לעיתים תקציר של הכתבה ולא הכתבה המלאה. זה בסדר —
  נתח את מה שיש, ואל תשלים פרטים שאינם בו.
- אם אין די מידע אפילו לסיכום קצר, החזר {"skip": true} ותו לא.
- עברית, אבל טיקרים ומונחים מקצועיים באנגלית.`;

async function readJson(path, fallback) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return fallback;
  }
}

/** Article text, roughly. Good enough to summarise from, and it avoids
 *  pulling a parser dependency in for what is a one-way extraction. */
function extractText(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
    .replace(/<footer[\s\S]*?<\/footer>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&[a-z]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function fetchArticle(url) {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    headers: {
      // Many publishers reject requests with no user agent outright.
      "User-Agent":
        "MarketIntelBot/1.0 (+mailto:mlwn930@gmail.com; reads one article to summarise it)",
      Accept: "text/html",
    },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const text = extractText(await res.text());
  if (text.length < 400) throw new Error("too little text");
  return text.slice(0, 6000);
}

async function analyse(title, text) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": API_KEY,
    },
    signal: AbortSignal.timeout(60_000),
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [
        { role: "user", parts: [{ text: `כותרת: ${title}\n\n${text}` }] },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: "application/json",
        maxOutputTokens: 900,
      },
    }),
  });

  const body = await res.text();
  if (!res.ok) throw new Error(`Gemini ${res.status}: ${body.slice(0, 120)}`);

  const payload = JSON.parse(body);
  const raw = payload?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!raw) throw new Error("empty response");

  /* ARABIC IN THE HEBREW, CHECKED HERE TOO.
   *
   * The shared client in src/lib/sources/gemini.ts rejects an answer
   * carrying Arabic and retries, because a multilingual model runs the
   * two right-to-left scripts together: "היקף" comes back as "היقף", and
   * fourteen per cent of the stored readings were affected before anyone
   * noticed.
   *
   * This script does not use that client. It is plain Node with its own
   * fetch, so the guard has to be stated again — and this is the file
   * that writes the readings the whole site displays, which makes it the
   * worse place to have missed. Found by watching a run: "אילון מאسك"
   * reached the watchlist page an hour after the guard shipped.
   *
   * Rejected rather than repaired, for the same reason as there.
   * Stripping the characters leaves a word that no longer exists and no
   * longer looks wrong to anything scanning for it. The caller treats a
   * throw as a failed analysis and the article is queued again next
   * cycle.
   */
  if (
    /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/.test(
      raw,
    )
  ) {
    throw new Error("model returned Arabic inside Hebrew text");
  }

  const parsed = JSON.parse(raw);
  if (parsed.skip) return null;

  if (
    typeof parsed.summary !== "string" ||
    typeof parsed.impact !== "string" ||
    parsed.summary.length < 20 ||
    parsed.impact.length < 20
  ) {
    throw new Error("response missing summary or impact");
  }

  const significance = ["high", "medium", "low"].includes(parsed.significance)
    ? parsed.significance
    : "medium";

  const tickers = Array.isArray(parsed.tickers)
    ? parsed.tickers
        .filter((t) => typeof t === "string" && /^[A-Z.\-]{1,6}$/.test(t))
        .slice(0, 6)
    : [];

  // The three lenses are optional rather than required. A model that
  // returns four good fields and drops the fifth should not cost us the
  // whole analysis — the article would then be retried every cycle
  // forever, and the summary we already had is worth keeping.
  const lens = (value) =>
    typeof value === "string" && value.trim().length >= 15
      ? value.trim()
      : undefined;

  const catalystKind = ["catalyst", "noise", "unclear"].includes(
    parsed.catalystKind,
  )
    ? parsed.catalystKind
    : undefined;

  return {
    summary: parsed.summary.trim(),
    impact: parsed.impact.trim(),
    catalyst: lens(parsed.catalyst),
    catalystKind,
    reaction: lens(parsed.reaction),
    chain: lens(parsed.chain),
    tickers,
    significance,
    writtenAt: new Date().toISOString(),
  };
}

/**
 * Who is followed, and what was written about them.
 *
 * Both read their source directly rather than importing from src/lib:
 * this script runs under plain Node with no bundler, so the path aliases
 * and the TypeScript modules behind them are not available here.
 *
 * Both are also allowed to return nothing. A missing database or an
 * unreachable wire means the queue falls back to the market feed it has
 * always used — a run that analyses the general news is worth far more
 * than a run that fails because a watchlist could not be read.
 */
async function followedTickers() {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) return [];
  try {
    const { neon } = await import("@neondatabase/serverless");
    const sql = neon(url);
    const rows = await sql`
      SELECT DISTINCT w.ticker
        FROM alert_watchlist w
        JOIN alert_subscribers s ON s.email = w.email
       WHERE s.state = 'approved'
    `;
    return rows.map((r) => String(r.ticker).toUpperCase()).filter(Boolean);
  } catch {
    return [];
  }
}

async function companyNews(symbol, from, to) {
  const key = process.env.FINNHUB_API_KEY?.trim();
  if (!key) return [];
  try {
    const res = await fetch(
      `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}` +
        `&from=${from}&to=${to}&token=${key}`,
      { signal: AbortSignal.timeout(20_000) },
    );
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json) ? json : [];
  } catch {
    return [];
  }
}

async function main() {
  if (!API_KEY) {
    console.log(
      "GEMINI_API_KEY is not set — skipping analysis.\n" +
        "Get a free key at https://aistudio.google.com/apikey (no card needed)\n" +
        "and add it as a repository secret named GEMINI_API_KEY.",
    );
    // Not an error. The feed is still valid without analysis, and failing
    // the workflow over a missing optional key would be noise.
    return;
  }

  const feed = await readJson(FEED, { sectors: [] });
  const store = await readJson(OUT, { summaries: {}, unfetchable: {} });
  const summaries = store.summaries ?? {};
  const unfetchable = store.unfetchable ?? {};

  const cooldownMs = UNFETCHABLE_COOLDOWN_DAYS * 86_400_000;
  const now = Date.now();

  const seen = new Set();
  const queue = [];
  const consider = (article) => {
    if (!article?.url || !article?.title) return;
    if (seen.has(article.url) || summaries[article.url]) return;
    const failedAt = unfetchable[article.url];
    if (failedAt && now - new Date(failedAt).getTime() < cooldownMs) return;
    seen.add(article.url);
    queue.push(article);
  };

  /* THE FOLLOWED COMPANIES GO FIRST, AND THEY USED TO BE ABSENT.
   *
   * This queue was built only from content/news/latest.json, the general
   * market wire — a hundred stories about everything. A watchlist page
   * showing a company's own news therefore showed stories with no reading
   * under them, because the articles came from the per-symbol endpoint and
   * nothing had ever put them in front of the model.
   *
   * They are queued ahead of the market feed rather than behind it. The
   * run is capped, and when the cap bites it should bite on a story about
   * a company nobody here follows rather than on the one somebody is
   * waiting to read.
   *
   * The wire is read directly rather than through src/lib, because this
   * script runs under plain Node with no bundler and no path aliases.
   */
  const followed = await followedTickers();
  if (followed.length) {
    const from = new Date(Date.now() - 14 * 86_400_000).toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);
    let added = 0;
    for (const ticker of followed) {
      const items = await companyNews(ticker, from, to);
      for (const item of items.slice(0, 8)) {
        const before = queue.length;
        consider({
          url: item.url,
          title: item.headline,
          excerpt: item.summary ?? "",
          domain: item.source ?? "",
          tickers: [ticker],
        });
        if (queue.length > before) added++;
      }
    }
    console.log(
      `${followed.length} followed companies · ${added} of their articles queued first`,
    );
  }

  for (const sector of feed.sectors ?? []) {
    for (const article of sector.articles ?? []) consider(article);
  }

  if (queue.length === 0) {
    console.log("nothing new to analyse");
    return;
  }

  const batch = queue.slice(0, MAX_PER_RUN);
  console.log(
    `${queue.length} unanalysed, processing ${batch.length} this run\n`,
  );

  let written = 0;
  let skipped = 0;

  for (const article of batch) {
    const label = article.title.slice(0, 60);
    process.stdout.write(`${label}... `);

    // The feed already carries the publisher's own summary, so the common
    // path needs no network call at all. Fetching the page is only a
    // fallback for the rare item that arrives without one — and a failure
    // there is not fatal, because the excerpt is usually enough.
    let text = (article.excerpt ?? "").trim();

    if (text.length < 180) {
      try {
        text = await fetchArticle(article.url);
      } catch (err) {
        if (text.length < 60) {
          console.log(`no text available (${err.message})`);
          unfetchable[article.url] = new Date().toISOString();
          skipped++;
          continue;
        }
      }
    }

    try {
      const analysis = await analyse(article.title, text);
      if (!analysis) {
        console.log("model declined - not an article");
        unfetchable[article.url] = new Date().toISOString();
        skipped++;
      } else {
        summaries[article.url] = analysis;
        console.log(`ok (${analysis.significance})`);
        written++;
      }
    } catch (err) {
      console.log(`analysis failed (${err.message})`);
      skipped++;
    }

    await sleep(GAP_MS);
  }

  await mkdir(dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    JSON.stringify(
      { writtenAt: new Date().toISOString(), summaries, unfetchable },
      null,
      2,
    ) + "\n",
    "utf8",
  );

  console.log(`\nwrote ${OUT}`);
  console.log(`${written} analysed, ${skipped} skipped`);
  console.log(`${Object.keys(summaries).length} analyses stored in total`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
