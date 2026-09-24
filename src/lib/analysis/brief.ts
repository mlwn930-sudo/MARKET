/**
 * The daily brief.
 *
 * Two halves, and the order matters. The snapshot is assembled from the
 * site's own sources and is what the page renders — index moves, the
 * largest moves inside the universe the site has fundamentals for, and the
 * stories the feed has already read through the three lenses. It stands on
 * its own with no model involved.
 *
 * The narrative is written over that snapshot afterwards, and only over it.
 * A brief a model wrote from memory would describe a plausible trading day
 * that did not happen, in confident Hebrew, and nothing on the page would
 * mark it as fiction. So the model gets the same figures the reader can see
 * above it and is forbidden from adding any.
 *
 * Cached for half an hour. The figures move faster than that during the
 * session — which is why they are also on the dashboard, live — but a brief
 * that is rewritten every time someone opens it costs a model call per view
 * and says roughly the same thing.
 */

import { unstable_cache } from "next/cache";
import { getQuotes } from "@/lib/sources/finnhub";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { getLiveFeed } from "@/lib/live-news";
import { getSeries } from "@/lib/sources/fred";
import { describeStatus, marketStatus } from "@/lib/market-hours";
import { fmtMetric, fmtPercent, fmtPrice } from "@/lib/format";
import { BRIEF_SYSTEM } from "@/lib/analysis/prompts";
import {
  GeminiError,
  generateJson,
  hasGeminiKey,
  type GeminiFailure,
} from "@/lib/sources/gemini";

const INDEX_PROXIES = [
  { symbol: "SPY", label: "S&P 500" },
  { symbol: "QQQ", label: "Nasdaq 100" },
  { symbol: "IWM", label: "Russell 2000" },
  { symbol: "DIA", label: "Dow Jones" },
];

export type BriefMove = {
  ticker: string;
  name: string | null;
  changePercent: number | null;
  price: number | null;
  pe: number | null;
};

export type BriefStory = {
  title: string;
  url: string;
  sector: string;
  summary: string;
  impact: string;
  significance: "high" | "medium" | "low";
  tickers: string[];
};

export type MarketSnapshot = {
  statusText: string;
  indexes: { symbol: string; label: string; price: number | null; changePercent: number | null }[];
  up: BriefMove[];
  down: BriefMove[];
  stories: BriefStory[];
  macro: { label: string; value: string; asOf: string }[];
  builtAt: string;
};

export type BriefNarrative = {
  headline: string;
  lede: string;
  sections: { title: string; body: string }[];
  watch: string[];
};

export type Brief = {
  snapshot: MarketSnapshot;
  narrative: BriefNarrative | null;
  /** Why there is no narrative, when there is none. The page says it out
   *  loud rather than quietly rendering half a brief. */
  failure: GeminiFailure | null;
};

/* ------------------------------------------------------------------ */
/* The figures                                                         */
/* ------------------------------------------------------------------ */

const MOVERS = 5;

async function buildSnapshot(): Promise<MarketSnapshot> {
  const { companies } = await getFundamentalsFile();

  // The twenty largest, not the first twenty in the file. A brief built
  // from an arbitrary slice of the universe would report a quiet day
  // whenever the movers happened to sit outside it — and twenty is a rate
  // limit, not a judgement: sixty quote requests a minute is the whole
  // site's budget.
  const universe = companies
    .slice()
    .sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0))
    .slice(0, 20)
    .map((company) => company.ticker);

  const [indexQuotes, universeQuotes, feed, tenYear] = await Promise.all([
    getQuotes(INDEX_PROXIES.map((p) => p.symbol)).catch(() => []),
    getQuotes(universe).catch(() => []),
    getLiveFeed().catch(() => null),
    // Five points, because only the latest is printed — and the six-hour
    // cache is shared with the WACC calculation, which asks for the same.
    getSeries("DGS10", 5).catch(() => null),
  ]);

  const moves: BriefMove[] = universe
    .map((ticker, index) => {
      const quote = universeQuotes[index];
      const company = companies.find((c) => c.ticker === ticker);
      return {
        ticker,
        name: company?.name ?? null,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        pe: company?.metrics.pe ?? null,
      };
    })
    .filter((move) => move.changePercent !== null);

  const sorted = [...moves].sort(
    (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0),
  );

  const stories: BriefStory[] = (feed?.sectors ?? [])
    .flatMap((sector) =>
      sector.articles
        .filter((article) => article.analysis)
        .map((article) => ({
          title: article.title,
          url: article.url,
          sector: sector.label,
          summary: article.analysis!.summary,
          impact: article.analysis!.impact,
          significance: article.analysis!.significance,
          tickers: article.analysis!.tickers,
        })),
    )
    .sort((a, b) => {
      const rank = { high: 0, medium: 1, low: 2 } as const;
      return rank[a.significance] - rank[b.significance];
    })
    .slice(0, 8);

  const macro: MarketSnapshot["macro"] = [];
  if (tenYear?.latest) {
    macro.push({
      label: tenYear.label,
      value: `${tenYear.latest.value.toFixed(2)}%`,
      asOf: tenYear.latest.date,
    });
  }

  return {
    statusText: describeStatus(marketStatus()),
    indexes: INDEX_PROXIES.map((proxy, index) => ({
      symbol: proxy.symbol,
      label: proxy.label,
      price: indexQuotes[index]?.price ?? null,
      changePercent: indexQuotes[index]?.changePercent ?? null,
    })),
    // Split by sign rather than by position. Taking the top five and the
    // bottom five of one sorted list puts the same company in both columns
    // on a day when fewer than ten quotes came back, which reads as a bug
    // and is one.
    up: sorted.filter((move) => (move.changePercent ?? 0) > 0).slice(0, MOVERS),
    down: sorted
      .filter((move) => (move.changePercent ?? 0) < 0)
      .slice(-MOVERS)
      .reverse(),
    stories,
    macro,
    builtAt: new Date().toISOString(),
  };
}

/** The snapshot as the model reads it. Same figures, same order, with the
 *  source of each one attached so they survive being quoted. */
function snapshotToText(snapshot: MarketSnapshot): string {
  const lines: string[] = [];

  lines.push(`מצב המסחר: ${snapshot.statusText}`);
  lines.push(
    `תאריך ושעה (ישראל): ${new Date(snapshot.builtAt).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem" })}`,
  );

  lines.push("\nמדדים (דרך תעודות סל, Finnhub):");
  for (const index of snapshot.indexes) {
    lines.push(
      `- ${index.label} (${index.symbol}): ${fmtPrice(index.price)} ${fmtPercent(index.changePercent)}`,
    );
  }

  if (snapshot.macro.length > 0) {
    lines.push("\nמאקרו (FRED):");
    for (const item of snapshot.macro) {
      lines.push(`- ${item.label}: ${item.value} (נכון ל-${item.asOf})`);
    }
  }

  lines.push("\nעליות ביקום שהאתר עוקב אחריו (Finnhub, מחיר חי):");
  for (const move of snapshot.up) {
    lines.push(
      `- ${move.ticker}${move.name ? ` (${move.name})` : ""}: ${fmtPercent(move.changePercent)}, ${fmtPrice(move.price)}${move.pe !== null ? `, P/E ${fmtMetric(move.pe, "x")}` : ""}`,
    );
  }

  lines.push("\nירידות:");
  for (const move of snapshot.down) {
    lines.push(
      `- ${move.ticker}${move.name ? ` (${move.name})` : ""}: ${fmtPercent(move.changePercent)}, ${fmtPrice(move.price)}`,
    );
  }

  if (snapshot.stories.length > 0) {
    lines.push("\nכותרות שהאתר כבר ניתח (פיד החדשות):");
    for (const story of snapshot.stories) {
      lines.push(
        `- [${story.sector} · ${story.significance}] ${story.title}\n  ${story.summary}\n  השפעה: ${story.impact}${story.tickers.length > 0 ? `\n  נוגע ל: ${story.tickers.join(", ")}` : ""}`,
      );
    }
  }

  return lines.join("\n");
}

/* ------------------------------------------------------------------ */
/* The brief                                                           */
/* ------------------------------------------------------------------ */

function cleanNarrative(raw: Partial<BriefNarrative>): BriefNarrative | null {
  if (!raw || typeof raw.headline !== "string" || typeof raw.lede !== "string") {
    return null;
  }
  return {
    headline: raw.headline.slice(0, 160),
    lede: raw.lede,
    sections: Array.isArray(raw.sections)
      ? raw.sections
          .filter(
            (section) =>
              section &&
              typeof section.title === "string" &&
              typeof section.body === "string",
          )
          .slice(0, 4)
      : [],
    watch: Array.isArray(raw.watch)
      ? raw.watch.filter((item): item is string => typeof item === "string").slice(0, 4)
      : [],
  };
}

/** Throws on a model failure, deliberately: a rejected promise is not
 *  cached, so a minute of rate limiting does not freeze an empty brief on
 *  the page for the next half hour. */
const buildBrief = unstable_cache(
  async (): Promise<Brief> => {
    const snapshot = await buildSnapshot();

    if (!hasGeminiKey()) {
      return { snapshot, narrative: null, failure: "no-key" };
    }

    const raw = await generateJson<Partial<BriefNarrative>>({
      system: BRIEF_SYSTEM,
      prompt: snapshotToText(snapshot),
      temperature: 0.4,
      maxOutputTokens: 1_200,
    });

    return { snapshot, narrative: cleanNarrative(raw), failure: null };
  },
  ["market-brief", "v1"],
  { revalidate: 1_800, tags: ["brief"] },
);

export async function getMarketBrief(): Promise<Brief> {
  try {
    return await buildBrief();
  } catch (error) {
    // The figures do not depend on the model, so a model failure costs the
    // narrative and nothing else.
    const snapshot = await buildSnapshot();
    return {
      snapshot,
      narrative: null,
      failure: error instanceof GeminiError ? error.reason : "upstream",
    };
  }
}
