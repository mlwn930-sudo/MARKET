/**
 * The text of one article, fetched from the publisher.
 *
 * scripts/summarize-news.mjs does the same thing on a schedule for the whole
 * feed. This is the on-demand half: a reader presses "analyse" on a story
 * the scheduled run has not reached yet, and the text has to arrive now.
 *
 * Deliberately conservative about what it takes. One request, a short
 * timeout, a size ceiling, and only http(s) — the URL arrives from a page,
 * and a fetcher that will follow any string it is handed is a way to make
 * the server request things on a stranger's behalf.
 *
 * Extraction is a tag strip rather than a readability parse. The result is
 * imperfect — navigation and cookie banners survive — and that is
 * acceptable, because what reads it is told the text may be partial and is
 * forbidden from filling gaps from memory.
 */

const TIMEOUT_MS = 15_000;
const MAX_BYTES = 1_500_000;
const MAX_CHARS = 6_000;
const MIN_USABLE_CHARS = 400;

export class ArticleFetchError extends Error {
  constructor(
    readonly reason: "bad-url" | "blocked" | "too-short",
    message: string,
  ) {
    super(message);
    this.name = "ArticleFetchError";
  }
}

function assertSafeUrl(url: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new ArticleFetchError("bad-url", "not a URL");
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new ArticleFetchError("bad-url", "unsupported protocol");
  }
  // Nothing on the machine itself, and nothing on a private network.
  if (
    /^(localhost|127\.|10\.|192\.168\.|169\.254\.|\[?::1\]?)/i.test(
      parsed.hostname,
    )
  ) {
    throw new ArticleFetchError("bad-url", "not a public host");
  }
  return parsed;
}

/** Same strip as the scheduled script. Kept in step with it by hand; the
 *  script is ESM run by node and cannot import from src/. */
export function extractText(html: string): string {
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

export async function getArticleText(url: string): Promise<string> {
  const target = assertSafeUrl(url);

  let res: Response;
  try {
    res = await fetch(target, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: {
        // Many publishers reject a request with no user agent outright.
        "User-Agent":
          "Mozilla/5.0 (compatible; MarketIntelBot/1.0; research use)",
        Accept: "text/html",
      },
      cache: "no-store",
    });
  } catch {
    throw new ArticleFetchError("blocked", "request failed or timed out");
  }

  if (!res.ok) {
    throw new ArticleFetchError("blocked", `HTTP ${res.status}`);
  }

  const raw = await res.text();
  if (raw.length > MAX_BYTES) {
    throw new ArticleFetchError("blocked", "page too large");
  }

  const text = extractText(raw);
  if (text.length < MIN_USABLE_CHARS) {
    // Almost always a paywall or a page that renders its body in the
    // browser. Either way there is nothing here to analyse.
    throw new ArticleFetchError("too-short", "too little text");
  }

  return text.slice(0, MAX_CHARS);
}

export const ARTICLE_FAILURE_TEXT: Record<
  ArticleFetchError["reason"],
  string
> = {
  "bad-url": "הכתובת אינה תקינה.",
  blocked:
    "האתר לא מוסר את הכתבה לשרת — לרוב חומת תשלום או חסימת בוטים. אפשר לפתוח את הכתבה ישירות.",
  "too-short":
    "לא נמצא די טקסט בעמוד כדי לנתח אותו. זה קורה כשהכתבה נטענת בדפדפן או יושבת מאחורי חומת תשלום.",
};
