import Link from "next/link";
import { getQuotes } from "@/lib/sources/finnhub";
import { getEnrichedFeed } from "@/lib/news-store";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { identityFor, tint } from "@/lib/company-identity";
import { ArticleCard } from "@/components/ArticleCard";
import { AccentTheme } from "@/components/AccentTheme";
import {
  directionClass,
  fmtCompact,
  fmtMetric,
  fmtPercent,
  fmtPrice,
  fmtRelative,
} from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "בינה מלאכותית — Market Intel",
  description:
    "שרשרת הערך של ה-AI: מי מייצר את השבבים, מי בונה את התשתית, ומי מוכר את המודלים.",
};

const ACCENT = "#7f77dd";

/**
 * The AI trade, laid out as a supply chain rather than a watchlist.
 *
 * Grouping by layer is the point: "AI stocks" as a single bucket hides that
 * these companies sit at different distances from the money. A foundry sells
 * capacity whoever wins; a model company needs its own product to win. They
 * are exposed to the same theme through completely different mechanisms, and
 * a list sorted by market cap would never show that.
 */
const LAYERS = [
  {
    id: "chips",
    title: "שבבים",
    explainer:
      "מי שמייצר את החומרה שהאימון והריצה רצים עליה. החוליה הכי קרובה לכסף כרגע, וגם הכי חשופה אם קצב ההשקעה יאט.",
    tickers: ["NVDA", "AMD", "AVGO", "TSM", "MU"],
  },
  {
    id: "infra",
    title: "תשתית וענן",
    explainer:
      "מרכזי הנתונים, הענן והחשמל שמאחוריהם. ההכנסה כאן חוזרת וצפויה יותר, אבל דורשת השקעה הונית כבדה מראש.",
    tickers: ["MSFT", "GOOGL", "AMZN", "ORCL", "VST"],
  },
  {
    id: "models",
    title: "מודלים ומוצר",
    explainer:
      "מי שמוכר את היכולת עצמה למשתמש הסופי. הפוטנציאל הגדול ביותר, וגם התחרות הקשה ביותר — מודל מתיישן מהר.",
    tickers: ["META", "PLTR", "NOW", "CRM", "ADBE"],
  },
];

export default async function AiPage() {
  const allTickers = LAYERS.flatMap((l) => l.tickers);

  const [quotes, feed, fundamentals] = await Promise.all([
    getQuotes(allTickers),
    getEnrichedFeed(),
    getFundamentalsFile(),
  ]);

  const quoteMap = new Map(
    allTickers.map((ticker, i) => [ticker, quotes[i]]),
  );
  const metricsFor = (ticker: string) =>
    fundamentals.companies.find((c) => c.ticker === ticker)?.metrics ?? null;

  const aiSector = feed.sectors.find((s) => s.sector === "ai");

  return (
    <>
      <AccentTheme accent="#7f77dd" />
    <main className="mx-auto max-w-6xl px-6 py-8">
      <header
        className="overflow-hidden rounded-2xl border border-line"
        style={{
          background: `linear-gradient(135deg, ${tint(ACCENT, 0.2)}, transparent 65%)`,
        }}
      >
        <div
          className="h-1 w-full"
          style={{ background: ACCENT }}
          aria-hidden="true"
        />
        <div className="p-6">
          <h1 className="text-2xl">בינה מלאכותית</h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-muted">
            &quot;מניות AI&quot; זו לא קטגוריה אחת. החברות כאן חשופות לאותו
            נושא דרך מנגנונים שונים לגמרי — יצרן שבבים מוכר חומרה לכל מי
            שמשקיע, וחברת מודלים צריכה שהמוצר שלה עצמו ינצח. לכן הן מסודרות
            לפי החוליה בשרשרת ולא לפי שווי שוק.
          </p>
          {feed.refreshedAt && (
            <p className="mt-3 flex items-center gap-2 text-[11px] text-ink-faint">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-up" />
              <span>
                חדשות עודכנו {fmtRelative(new Date(feed.refreshedAt))}
              </span>
            </p>
          )}
        </div>
      </header>

      {LAYERS.map((layer) => (
        <section key={layer.id} className="mt-10">
          <div
            className="border-b-2 pb-2"
            style={{ borderColor: tint(ACCENT, 0.35) }}
          >
            <h2 className="text-lg" style={{ color: ACCENT }}>
              {layer.title}
            </h2>
            <p className="mt-1 max-w-2xl text-[11px] leading-relaxed text-ink-muted">
              {layer.explainer}
            </p>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {layer.tickers.map((ticker) => {
              const quote = quoteMap.get(ticker);
              const metrics = metricsFor(ticker);
              const identity = identityFor(ticker);

              return (
                <Link
                  key={ticker}
                  href={`/company/${ticker}`}
                  className="panel panel-interactive p-3"
                  style={{ borderInlineStartWidth: 2, borderInlineStartColor: identity.accent }}
                >
                  <div className="flex items-baseline justify-between">
                    <span
                      className="num text-sm font-medium"
                      style={{ color: identity.accent }}
                    >
                      {ticker}
                    </span>
                    <span
                      className={`num text-[11px] ${directionClass(quote?.changePercent ?? null)}`}
                    >
                      {fmtPercent(quote?.changePercent ?? null)}
                    </span>
                  </div>

                  <div className="num mt-1 text-lg">
                    {fmtPrice(quote?.price ?? null)}
                  </div>

                  <dl className="mt-2 space-y-1 border-t border-line pt-2 text-[10px]">
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">P/E</dt>
                      <dd className="num text-ink-muted">
                        {fmtMetric(metrics?.pe ?? null, "x")}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">מרווח תפעולי</dt>
                      <dd className="num text-ink-muted">
                        {fmtMetric(metrics?.operating_margin ?? null, "%")}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-ink-faint">ROIC</dt>
                      <dd className="num text-ink-muted">
                        {fmtMetric(metrics?.roic ?? null, "%")}
                      </dd>
                    </div>
                  </dl>
                </Link>
              );
            })}
          </div>
        </section>
      ))}

      <section className="mt-12">
        <div
          className="border-b-2 pb-2"
          style={{ borderColor: tint(ACCENT, 0.35) }}
        >
          <h2 className="text-lg" style={{ color: ACCENT }}>
            מה קורה עכשיו ב-AI
          </h2>
        </div>

        {!aiSector || aiSector.articles.length === 0 ? (
          <p className="mt-4 text-xs text-ink-faint">
            אין כרגע כתבות בסקטור הזה.
          </p>
        ) : (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {aiSector.articles.map((article) => (
              <ArticleCard
                key={article.url}
                article={article}
                accent={ACCENT}
              />
            ))}
          </div>
        )}
      </section>

      <p className="mt-10 text-xs leading-relaxed text-ink-faint">
        חלוקת החברות לחוליות היא פרשנות שלנו למבנה השוק, לא סיווג רשמי.
        חברה יכולה לשבת בכמה חוליות בו-זמנית. מדד המוצג כ-&quot;—&quot;
        אינו זמין בדוחות. אין באמור ייעוץ השקעות.
      </p>

      <p className="mt-4 text-xs">
        <Link href="/" className="text-ink-muted hover:text-ink">
          ← חזרה לדשבורד
        </Link>
      </p>
    </main>
    </>
  );
}
