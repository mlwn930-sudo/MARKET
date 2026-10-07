import { getArticleText } from "@/lib/sources/article";
import { generateJson } from "@/lib/sources/gemini";
import { ARTICLE_SYSTEM } from "@/lib/analysis/prompts";
import type { ArticleSummary } from "@/lib/news-shape";

/**
 * One article, read through the site's three lenses.
 *
 * Extracted from the API route because it now has a second caller. The
 * route is what a reader presses on a card; the watchlist agent needs the
 * same reading for a story it is about to put in somebody's inbox, and an
 * email carrying an English headline and nothing else is the thing the
 * owner asked not to receive.
 *
 * Two callers, one prompt, one shape. The alternative — the agent writing
 * its own version — is how a story reads one way on the site and another
 * way in the mail about it, with no way to tell which is the site's
 * opinion.
 *
 * NO CACHING HERE, DELIBERATELY. `unstable_cache` is a Next primitive and
 * this has to run under plain Node in a scheduled script. The route keeps
 * its own wrapper, which is where caching belongs anyway: it is the only
 * model call a visitor can trigger by clicking, and the agent's calls are
 * budgeted by the queue that makes them.
 */

type ModelAnswer = Partial<ArticleSummary> & { skip?: boolean };

export async function analyseArticle(
  url: string,
  title: string,
): Promise<ArticleSummary | null> {
  const text = await getArticleText(url);

  const answer = await generateJson<ModelAnswer>({
    system: ARTICLE_SYSTEM,
    prompt: `כותרת: ${title}\n\n${text}`,
    temperature: 0.2,
    maxOutputTokens: 900,
  });

  /* A model that returns neither a summary nor an impact has not read the
     article, whatever else it produced. Returning the fragment would put a
     half-reading on a page and in an inbox, and nothing downstream could
     tell it from a complete one. */
  if (answer.skip || !answer.summary || !answer.impact) return null;

  return {
    summary: answer.summary,
    impact: answer.impact,
    catalyst: answer.catalyst,
    catalystKind: answer.catalystKind,
    reaction: answer.reaction,
    chain: answer.chain,
    tickers: Array.isArray(answer.tickers)
      ? answer.tickers.filter((t) => typeof t === "string").slice(0, 6)
      : [],
    significance: answer.significance ?? "medium",
    writtenAt: new Date().toISOString(),
  };
}
