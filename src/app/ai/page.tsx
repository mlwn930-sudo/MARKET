import Link from "next/link";
import { getQuotes } from "@/lib/sources/finnhub";
import { getLiveFeed } from "@/lib/live-news";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { identityFor } from "@/lib/company-identity";
import { ArticleCard } from "@/components/ArticleCard";
import { Disclaimer, Hero, MoreLink, Page, Section } from "@/components/ui";
import {
  directionClass,
  fmtMetric,
  fmtPercent,
  fmtPrice,
  fmtRelative,
} from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "שרשרת ה-AI",
  description:
    "מי מייצר את השבבים, מי בונה את התשתית, ומי מוכר את המודלים — ומה זה אומר על החשיפה של כל אחד.",
};

/**
 * The AI trade, laid out as a supply chain rather than as a watchlist.
 *
 * Grouping by layer is the point: "AI stocks" as a single bucket hides that
 * these companies sit at different distances from the money. A foundry
 * sells capacity whoever wins; a model company needs its own product to
 * win. They are exposed to the same theme through completely different
 * mechanisms, and a list sorted by market cap would never show that.
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
  const allTickers = LAYERS.flatMap((layer) => layer.tickers);

  const [quotes, feed, fundamentals] = await Promise.all([
    getQuotes(allTickers).catch(() => []),
    getLiveFeed(),
    getFundamentalsFile(),
  ]);

  const quoteMap = new Map(allTickers.map((ticker, i) => [ticker, quotes[i]]));
  const metricsFor = (ticker: string) =>
    fundamentals.companies.find((c) => c.ticker === ticker)?.metrics ?? null;

  const aiSector = feed.sectors.find((sector) => sector.sector === "ai");

  return (
    <Page tint="#7b6fd4">
      <Hero
        eyebrow="שרשרת ערך"
        title="שלוש חוליות, שלוש חשיפות שונות"
        lede="&quot;מניות AI&quot; זו לא קטגוריה אחת. החברות כאן חשופות לאותו נושא דרך מנגנונים שונים לגמרי — יצרן שבבים מוכר חומרה לכל מי שמשקיע, וחברת מודלים צריכה שהמוצר שלה עצמו ינצח."
        image="/hero/research.webp"
        imageAlt=""
      />

      {feed.refreshedAt && (
        <p className="mt-8 text-[11px] text-ink-ghost">
          חדשות עודכנו {fmtRelative(new Date(feed.refreshedAt))}
        </p>
      )}

      {LAYERS.map((layer) => (
        <Section
          key={layer.id}
          eyebrow={`חוליה ${LAYERS.indexOf(layer) + 1}`}
          title={layer.title}
          description={layer.explainer}
        >
          <div className="surface overflow-hidden">
            {layer.tickers.map((ticker) => {
              const quote = quoteMap.get(ticker);
              const metrics = metricsFor(ticker);
              const identity = identityFor(ticker);

              return (
                <Link
                  key={ticker}
                  href={`/company/${ticker}`}
                  className="row grid-cols-[1fr_auto] gap-6 sm:grid-cols-[1.2fr_auto_auto_auto_auto]"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className="h-7 w-[3px] shrink-0 rounded-full"
                      style={{ background: identity.accent }}
                      aria-hidden="true"
                    />
                    <span className="num text-[13px] font-medium text-ink">
                      {ticker}
                    </span>
                  </span>

                  <span className="text-end">
                    <span className="num block text-[14px] text-ink">
                      {fmtPrice(quote?.price ?? null)}
                    </span>
                    <span
                      className={`num block text-[11px] ${directionClass(quote?.changePercent ?? null)}`}
                    >
                      {fmtPercent(quote?.changePercent ?? null)}
                    </span>
                  </span>

                  {[
                    { label: "P/E", value: metrics?.pe ?? null, unit: "x" as const },
                    {
                      label: "מרווח תפעולי",
                      value: metrics?.operating_margin ?? null,
                      unit: "%" as const,
                    },
                    {
                      label: "ROIC",
                      value: metrics?.roic ?? null,
                      unit: "%" as const,
                    },
                  ].map((item) => (
                    <span key={item.label} className="hidden text-end sm:block">
                      <span className="block text-[10px] text-ink-ghost">
                        {item.label}
                      </span>
                      <span className="num block text-[13px] text-ink-muted">
                        {fmtMetric(item.value, item.unit)}
                      </span>
                    </span>
                  ))}
                </Link>
              );
            })}
          </div>
        </Section>
      ))}

      <Section
        eyebrow="חדשות"
        title="מה קורה עכשיו ב-AI"
        action={<MoreLink href="/news">כל החדשות</MoreLink>}
      >
        {!aiSector || aiSector.articles.length === 0 ? (
          <p className="surface px-5 py-5 text-[13px] text-ink-muted">
            אין כרגע כתבות בסקטור הזה.
          </p>
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {aiSector.articles.slice(0, 6).map((article) => (
              <ArticleCard key={article.url} article={article} />
            ))}
          </div>
        )}
      </Section>

      <Disclaimer extra="חלוקת החברות לחוליות היא פרשנות של האתר, לא סיווג רשמי." />
    </Page>
  );
}
