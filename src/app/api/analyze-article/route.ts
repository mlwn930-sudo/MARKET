import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import {
  ARTICLE_FAILURE_TEXT,
  ArticleFetchError,
  getArticleText,
} from "@/lib/sources/article";
import { ARTICLE_SYSTEM } from "@/lib/analysis/prompts";
import {
  GEMINI_FAILURE_TEXT,
  GeminiError,
  generateJson,
  hasGeminiKey,
} from "@/lib/sources/gemini";
import type { ArticleSummary } from "@/lib/news-store";

/**
 * One story, read on demand.
 *
 * The scheduled job analyses the feed every cycle, and it will reach this
 * story eventually — the button exists because "eventually" is up to half
 * an hour, and the story a reader is looking at now is the one they want
 * read now.
 *
 * Cached by URL for a day. Two readers pressing the button on the same
 * headline cost one model call, and a reader who presses it twice costs
 * none. That matters more here than anywhere else on the site: this is the
 * only model call a visitor can trigger by clicking.
 *
 * The result is NOT written into content/news/summaries.json. The
 * filesystem is read-only on Vercel, and a half-written analysis file would
 * be worse than none. The scheduled job remains the only writer.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

type ModelAnswer = Partial<ArticleSummary> & { skip?: boolean };

const analyse = (url: string, title: string) =>
  unstable_cache(
    async () => {
      const text = await getArticleText(url);

      const answer = await generateJson<ModelAnswer>({
        system: ARTICLE_SYSTEM,
        prompt: `כותרת: ${title}\n\n${text}`,
        temperature: 0.2,
        maxOutputTokens: 900,
      });

      if (answer.skip || !answer.summary || !answer.impact) return null;

      const summary: ArticleSummary = {
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
      return summary;
    },
    ["article-analysis", url],
    { revalidate: 86_400, tags: ["news"] },
  )();

export async function POST(request: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: GEMINI_FAILURE_TEXT["no-key"], reason: "no-key" },
      { status: 503 },
    );
  }

  let body: { url?: string; title?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const url = (body.url ?? "").trim();
  const title = (body.title ?? "").trim().slice(0, 300);

  if (!url || !title) {
    return NextResponse.json({ error: "missing url or title" }, { status: 400 });
  }

  try {
    const analysis = await analyse(url, title);

    if (!analysis) {
      return NextResponse.json(
        {
          error:
            "אין בכתבה די מידע לניתוח. זה קורה כשהעמוד הוא בעיקר כותרת וקישורים.",
          reason: "too-short",
        },
        { status: 422 },
      );
    }

    return NextResponse.json(
      { analysis },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof ArticleFetchError) {
      return NextResponse.json(
        { error: ARTICLE_FAILURE_TEXT[error.reason], reason: error.reason },
        { status: 422 },
      );
    }
    if (error instanceof GeminiError) {
      return NextResponse.json(
        { error: GEMINI_FAILURE_TEXT[error.reason], reason: error.reason },
        { status: error.reason === "no-key" ? 503 : 429 },
      );
    }
    return NextResponse.json(
      { error: "הניתוח נכשל מסיבה לא צפויה.", reason: "upstream" },
      { status: 500 },
    );
  }
}
