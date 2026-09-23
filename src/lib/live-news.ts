/**
 * The news feed, assembled live.
 *
 * Until now the site only ever showed a file that a scheduled workflow wrote
 * and committed. That works, and it has one flaw the reader feels
 * immediately: between runs the page is frozen, and if the workflow is late
 * or the deployment has not caught up, the feed can be hours stale while
 * saying nothing about it.
 *
 * So the wire is now read on every visit, through a two-minute shared cache,
 * and the stored file becomes the fallback rather than the source. Stories
 * appear while they are still news.
 *
 * The analysis still comes from the file, and that asymmetry is deliberate.
 * Fetching a headline is one request; reading it through the three lenses
 * costs a language-model call, which belongs in a scheduled job and not in a
 * page render. So a story typically arrives unanalysed and gains its reading
 * on the next cycle — which the card states plainly rather than hiding.
 *
 * Classification is imported from the same module the refresh script uses.
 * A second copy of the rules here would drift from it within a month.
 */

import { unstable_cache } from "next/cache";
import { getGeneralNews } from "@/lib/sources/finnhub";
import {
  getEnrichedFeed,
  getSummaries,
  type EnrichedArticle,
  type EnrichedFeed,
  type EnrichedSector,
} from "@/lib/news-store";
import { SECTORS, classify, isRelevant, tickersIn } from "@/lib/news-sectors.mjs";

/** Per sector. Enough to fill a row on a wide screen without the page
 *  turning into an endless scroll of near-duplicates. */
const PER_SECTOR = 12;

function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

async function build(): Promise<EnrichedFeed> {
  const [items, summaries, stored] = await Promise.all([
    getGeneralNews().catch(() => []),
    getSummaries(),
    // Kept as the floor. A wire that returns nothing should leave the reader
    // with the last good feed, not with an empty page.
    getEnrichedFeed(),
  ]);

  const bySector = new Map<string, EnrichedArticle[]>();
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.url || seen.has(item.url)) continue;
    if (!isRelevant(item)) continue;

    const sectors = classify(item);
    if (sectors.length === 0) continue;

    seen.add(item.url);

    const article: EnrichedArticle = {
      url: item.url,
      title: item.headline,
      excerpt: item.summary ?? "",
      image: null,
      domain: item.source || hostOf(item.url),
      country: null,
      seenAt: item.publishedAt.toISOString(),
      tickers: tickersIn(item),
      analysis: summaries[item.url] ?? null,
    };

    for (const sector of sectors) {
      const list = bySector.get(sector) ?? [];
      list.push(article);
      bySector.set(sector, list);
    }
  }

  // Nothing usable came back. Hand over the stored feed unchanged rather
  // than a well-formed empty one.
  if (seen.size === 0) return stored;

  const storedBySector = new Map(
    stored.sectors.map((sector) => [sector.sector, sector]),
  );

  const sectors: EnrichedSector[] = [];
  let analysedCount = 0;
  let totalCount = 0;

  for (const config of SECTORS) {
    const live = bySector.get(config.sector) ?? [];

    // A quiet sector keeps whatever the last refresh found for it, so a slow
    // news hour does not blank a column that had perfectly good stories in it.
    const previous = storedBySector.get(config.sector)?.articles ?? [];
    const merged: EnrichedArticle[] = [...live];
    for (const article of previous) {
      if (merged.length >= PER_SECTOR) break;
      if (merged.some((a) => a.url === article.url)) continue;
      merged.push({
        ...article,
        analysis: summaries[article.url] ?? article.analysis ?? null,
      });
    }

    merged.sort((a, b) => (b.seenAt ?? "").localeCompare(a.seenAt ?? ""));
    const articles = merged.slice(0, PER_SECTOR);

    totalCount += articles.length;
    analysedCount += articles.filter((a) => a.analysis).length;

    sectors.push({
      sector: config.sector,
      label: config.label,
      blurb: config.blurb,
      accent: config.accent,
      ok: true,
      refreshedAt: new Date().toISOString(),
      articles,
    });
  }

  return {
    refreshedAt: new Date().toISOString(),
    sectors: sectors.filter((s) => s.articles.length > 0),
    analysedCount,
    totalCount,
  };
}

/**
 * A signature of which stories a feed contains.
 *
 * Used by the page and by the status route so the browser can ask "is this
 * still the list I am showing" without downloading the list. Both sides have
 * to compute it identically, which is why it lives here rather than in
 * either of them.
 *
 * Not a security boundary — it never leaves the same origin — so a small
 * fast hash is the right tool.
 */
export function feedSignature(feed: EnrichedFeed): string {
  const urls = feed.sectors
    .flatMap((sector) => sector.articles.map((article) => article.url))
    .sort();

  let hash = 5381;
  for (const url of urls) {
    for (let i = 0; i < url.length; i++) {
      hash = ((hash << 5) + hash + url.charCodeAt(i)) | 0;
    }
  }
  return (hash >>> 0).toString(36);
}

/** Two minutes, shared across every reader and every tab. */
export function getLiveFeed(): Promise<EnrichedFeed> {
  return unstable_cache(build, ["live-news-feed", "v1"], {
    revalidate: 120,
    tags: ["news"],
  })();
}
