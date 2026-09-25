import { unstable_cache } from "next/cache";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import {
  getBoardQuotes,
  type BoardQuote,
} from "@/lib/sources/board-quotes";
import { SECTOR_LABELS, type SectorKey } from "@/lib/universe";
import {
  Heatmap,
  HeatmapLegend,
  type HeatSector,
} from "@/components/Heatmap";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { describeStatus, marketStatus } from "@/lib/market-hours";

export const revalidate = 120;

export const metadata = {
  title: "מפת השוק",
  description:
    "היקום של האתר לפי סקטור: גודל המשבצת הוא שווי השוק, הצבע הוא תנועת היום.",
};

/**
 * The map refreshes every two minutes, and that number is a rate limit
 * rather than a design choice.
 *
 * Forty-eight companies is forty-eight quote requests — Finnhub's free tier
 * allows sixty a minute, across the whole site. At a thirty-second refresh
 * one reader with this page open would spend the entire allowance and the
 * company pages would start failing. The shared cache below means any
 * number of readers cost one set of requests every two minutes.
 */
const loadMap = unstable_cache(
  async (): Promise<HeatSector[]> => {
    const { companies } = await getFundamentalsFile();
    const tickers = companies.map((company) => company.ticker);
    const quotes = await getBoardQuotes(tickers).catch((): Record<string, BoardQuote> => ({}));

    const bySector = new Map<string, HeatSector>();

    companies.forEach((company, index) => {
      const key = company.sector;
      const sector =
        bySector.get(key) ??
        ({
          key,
          label: SECTOR_LABELS[key as SectorKey] ?? key,
          tiles: [],
        } satisfies HeatSector);

      sector.tiles.push({
        ticker: company.ticker,
        name: company.name,
        marketCap: company.marketCap,
        changePercent: quotes[company.ticker]?.changePercent ?? null,
      });

      bySector.set(key, sector);
    });

    // Largest company first inside a sector, largest sector first overall.
    // A map that reorders itself with the market is impossible to scan
    // twice, so the order is by size and stays put.
    const sectors = [...bySector.values()];
    for (const sector of sectors) {
      sector.tiles.sort((a, b) => (b.marketCap ?? 0) - (a.marketCap ?? 0));
    }
    return sectors.sort(
      (a, b) =>
        b.tiles.reduce((sum, tile) => sum + (tile.marketCap ?? 0), 0) -
        a.tiles.reduce((sum, tile) => sum + (tile.marketCap ?? 0), 0),
    );
  },
  ["market-heatmap", "v1"],
  { revalidate: 120, tags: ["quotes"] },
);

export default async function HeatmapPage() {
  const sectors = await loadMap();
  const status = marketStatus();

  const moved = sectors
    .flatMap((sector) => sector.tiles)
    .filter((tile) => tile.changePercent !== null);

  const advancing = moved.filter((tile) => (tile.changePercent ?? 0) > 0).length;

  return (
    <Page tint="#06b6d4" width="wide">
      <Hero
        eyebrow="מפת השוק"
        title="מי זז, וכמה ממנו יש"
        lede="ארבעים ושמונה החברות שהאתר מחשב עליהן מדדים, מסודרות לפי סקטור. הגודל הוא שווי השוק והצבע הוא תנועת היום — שני הדברים היחידים שמפה כזאת יכולה למסור ביושר. כל מה שמעבר לזה נמצא בעמוד החברה."
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        {describeStatus(status)} ·{" "}
        <span className="num">
          {advancing}/{moved.length}
        </span>{" "}
        חברות בירוק · מתעדכן כל שתי דקות
      </p>

      <Section eyebrow="המפה" title="לפי סקטור" className="mt-10">
        <div className="mb-5">
          <HeatmapLegend />
        </div>
        <Heatmap sectors={sectors} />
      </Section>

      <Disclaimer extra="הצבע מתאר את תנועת המחיר היום בלבד ואינו אומר דבר על איכות העסק. יום ירוק ועסק מתדרדר נראים כאן אותו דבר." />
    </Page>
  );
}
