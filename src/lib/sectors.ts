/**
 * A sector, assembled.
 *
 * Everything here already existed in pieces — the universe file knows who
 * belongs where and what the medians are, the quote source knows what
 * moved, the feed knows what was written. What was missing is the obvious
 * question: how is this whole part of the market doing, and which of its
 * members is carrying or dragging it.
 *
 * The sector's performance is the plain average of its members' moves, not
 * a cap-weighted index. That is a deliberate difference from how the
 * financial press reports a sector: cap weighting tells you what happened
 * to the money, and the equal-weight average tells you what happened to
 * the companies. On a day when one giant rises and nine members fall, the
 * cap-weighted number says the sector rose, which is true and useless to
 * someone deciding what to research next.
 *
 * The news mapping is by hand because the two vocabularies were built for
 * different jobs: the feed sorts stories into subjects a reader browses
 * ("AI", "defence", "oil"), and the universe sorts companies into groups
 * with enough members to have a meaningful median. Neither is wrong, and
 * no automatic mapping between them would be right.
 */

import { getFundamentalsFile } from "@/lib/fundamentals-store";
import {
  getBoardQuotes,
  type BoardQuote,
} from "@/lib/sources/board-quotes";
import { getLiveFeed } from "@/lib/live-news";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";
import type { EnrichedArticle } from "@/lib/news-shape";
import { unstable_cache } from "next/cache";

/** Universe sector → the feed subjects that cover it. */
const NEWS_SUBJECTS: Record<SectorKey, string[]> = {
  semis: ["semis", "ai"],
  software: ["ai", "trade"],
  internet: ["ai", "consumer"],
  healthcare: ["health"],
  financials: ["finance"],
  energy: ["oil", "power"],
  consumer: ["consumer", "trade"],
  industrials: ["defense", "trade"],
  telecom: ["consumer"],
};

/** The one-line explanation of what the group actually is. Without it a
 *  sector page is a table with a heading. */
export const SECTOR_NOTES: Record<SectorKey, string> = {
  semis: "מי שמייצר את השבבים ואת הציוד לייצורם. הסקטור המחזורי ביותר בטכנולוגיה: ההזמנות מגיעות בגלים, וכשהן מתהפכות המרווחים זזים מהר.",
  software: "הכנסה חוזרת, מרווח גולמי גבוה, והשקעה שנרשמת כהוצאה שוטפת ולא כהון. לכן מכפילי הרווח כאן נראים גבוהים בהשוואה לתעשייה.",
  internet: "פרסום, מסחר ותוכן. ההכנסה תלויה בתקציבי פרסום ובהוצאה פרטית, ושתיהן מגיבות למחזור הכלכלי לפני הדוחות.",
  healthcare: "תרופות, ביטוח רפואי וציוד. הרגולציה כאן היא לא רקע — אישור או שלילה של תרופה משנים תזרים לשנים.",
  financials: "בנקים וברוקרים. הסקטור היחיד שבו מרווח גולמי ו-EV/EBITDA אינם אומרים דבר, ולכן חלק מהמדדים באתר אינם מחושבים עבורו.",
  energy: "נפט, גז והפקה. הרווח נגזר ממחיר סחורה שאף חברה לא שולטת בו, ולכן המכפילים נמוכים גם בשנים טובות.",
  consumer: "קמעונאות וצריכה. מרווחים דקים ומחזור מהיר — עסק שנמדד בשולי אחוז ובניהול מלאי.",
  industrials: "תעשייה, ביטחון ותשתיות תחבורה. מחזורי הזמנות ארוכים, וצבר שמגן על ההכנסה בהאטה.",
  telecom: "תקשורת. השקעה הונית כבדה מראש, הכנסה יציבה אחריה, וצמיחה נמוכה מבנית.",
};

export type SectorMember = {
  ticker: string;
  name: string;
  marketCap: number | null;
  changePercent: number | null;
  price: number | null;
  pe: number | null;
  roic: number | null;
  operatingMargin: number | null;
  revenueGrowth: number | null;
};

export type SectorView = {
  key: SectorKey;
  label: string;
  note: string;
  members: SectorMember[];
  /** Equal-weight average of the members that returned a quote. */
  averageMove: number | null;
  advancing: number;
  quoted: number;
  medians: Record<string, number | null>;
  peerCount: number;
  totalMarketCap: number;
  leaders: SectorMember[];
  laggards: SectorMember[];
  articles: EnrichedArticle[];
};

async function build(): Promise<SectorView[]> {
  const [file, feed] = await Promise.all([
    getFundamentalsFile(),
    getLiveFeed().catch(() => null),
  ]);

  const tickers = file.companies.map((company) => company.ticker);

  // One request for the whole universe, shared with the map and the
  // brief. See sources/board-quotes.ts for why this is not Finnhub.
  const quotes = await getBoardQuotes(tickers).catch((): Record<string, BoardQuote> => ({}));
  const quoteFor = new Map(
    tickers.map((ticker) => [ticker, quotes[ticker] ?? null]),
  );

  const views: SectorView[] = [];

  for (const [key, label] of Object.entries(SECTOR_LABELS) as [
    SectorKey,
    string,
  ][]) {
    const companies = file.companies.filter(
      (company) => company.sector === key,
    );
    if (companies.length === 0) continue;

    const members: SectorMember[] = companies.map((company) => {
      const quote = quoteFor.get(company.ticker);
      return {
        ticker: company.ticker,
        name: company.name,
        marketCap: company.marketCap,
        price: quote?.price ?? null,
        changePercent: quote?.changePercent ?? null,
        pe: company.metrics.pe ?? null,
        roic: company.metrics.roic ?? null,
        operatingMargin: company.metrics.operating_margin ?? null,
        revenueGrowth: company.metrics.rev_cagr_3 ?? null,
      };
    });

    const moved = members.filter(
      (member) =>
        member.changePercent !== null && Number.isFinite(member.changePercent),
    );

    const averageMove =
      moved.length > 0
        ? moved.reduce((sum, m) => sum + (m.changePercent ?? 0), 0) /
          moved.length
        : null;

    const ranked = [...moved].sort(
      (a, b) => (b.changePercent ?? 0) - (a.changePercent ?? 0),
    );

    const subjects = NEWS_SUBJECTS[key] ?? [];
    const articles = (feed?.sectors ?? [])
      .filter((sector) => subjects.includes(sector.sector))
      .flatMap((sector) => sector.articles)
      .slice(0, 6);

    views.push({
      key,
      label,
      note: SECTOR_NOTES[key],
      members: members.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0)),
      averageMove,
      advancing: moved.filter((m) => (m.changePercent ?? 0) > 0).length,
      quoted: moved.length,
      medians: file.sectors[key]?.medians ?? {},
      peerCount: file.sectors[key]?.count ?? companies.length,
      totalMarketCap: companies.reduce(
        (sum, company) => sum + (company.marketCap ?? 0),
        0,
      ),
      leaders: ranked.slice(0, 3),
      laggards: ranked.slice(-3).reverse(),
      articles,
    });
  }

  // Strongest sector first. A page that always opens on the same sector
  // teaches the reader to scroll past the top of it.
  return views.sort((a, b) => (b.averageMove ?? -99) - (a.averageMove ?? -99));
}

/** Two minutes, shared: this reads a quote for all 48 companies, which is
 *  most of a minute's Finnhub budget on its own. */
export const getSectorViews = unstable_cache(build, ["sector-views", "v1"], {
  revalidate: 120,
  tags: ["quotes", "sectors"],
});

export async function getSectorView(key: string): Promise<SectorView | null> {
  const views = await getSectorViews();
  return views.find((view) => view.key === key) ?? null;
}
