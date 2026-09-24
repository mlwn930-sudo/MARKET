/**
 * Google Gemini — the only language model this project calls.
 *
 * Chosen for one reason that outranks quality: the free tier issues a key
 * without a credit card, which is the project's first iron rule. Everything
 * below exists to keep the site inside that free tier, and honest about what
 * happens when it cannot.
 *
 * Three limits are enforced here and nowhere else:
 *
 *   1. A rolling minute window. The free tier allows roughly fifteen
 *      requests a minute; we run at ten to leave room for the scheduled
 *      news job, which draws on the same key.
 *   2. A daily ceiling, so one afternoon of research cannot spend the
 *      quota the nightly news analysis needs.
 *   3. One request at a time. Concurrency buys nothing here — a chat reply
 *      is a single call — and serialising makes the window above exact.
 *
 * Per serverless instance, like the SEC limiter, and for the same reason:
 * a handful of readers never reach the cap, and a shared counter would need
 * a database this project does not have.
 *
 * Every caller must handle this module refusing to run. A missing key is
 * the normal state of a fresh clone, not a crash — the pages that use a
 * model say so on the page instead of failing.
 */

const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models";

/** Same default as scripts/summarize-news.mjs. The two must move together,
 *  or the feed and the site start reading stories with different models. */
const MODEL = process.env.GEMINI_MODEL ?? "gemini-flash-latest";

const MAX_PER_MINUTE = 10;
const MAX_PER_DAY = 600;
const MIN_GAP_MS = 400;

/** Why a call could not be made. The UI shows a different sentence for
 *  each, because "try again in a minute" and "add a key to .env.local" are
 *  not the same problem. */
export type GeminiFailure = "no-key" | "rate-limit" | "quota" | "upstream";

export class GeminiError extends Error {
  constructor(
    readonly reason: GeminiFailure,
    message: string,
  ) {
    super(message);
    this.name = "GeminiError";
  }
}

export const GEMINI_FAILURE_TEXT: Record<GeminiFailure, string> = {
  "no-key":
    "מפתח GEMINI_API_KEY אינו מוגדר בסביבה הזו. הנתונים בעמוד אמיתיים; הניתוח המילולי לא ייווצר עד שהמפתח יתווסף.",
  "rate-limit":
    "יותר מדי בקשות למודל בדקה האחרונה. הנתונים בעמוד לא נפגעו — נסה שוב בעוד רגע.",
  quota:
    "מכסת המודל היומית נוצלה. הנתונים בעמוד ממשיכים לעבוד; הניתוח המילולי יחזור מחר.",
  upstream: "המודל לא החזיר תשובה תקינה. הנתונים בעמוד אינם תלויים בו.",
};

export function hasGeminiKey(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

/* ------------------------------------------------------------------ */
/* The limiter                                                         */
/* ------------------------------------------------------------------ */

let minuteWindow: number[] = [];
let dayCount = 0;
let dayStartedAt = Date.now();
let lastCallAt = 0;
let chain: Promise<unknown> = Promise.resolve();

function reserve(): void {
  const now = Date.now();

  if (now - dayStartedAt > 86_400_000) {
    dayStartedAt = now;
    dayCount = 0;
  }
  if (dayCount >= MAX_PER_DAY) {
    throw new GeminiError("quota", "daily model budget spent");
  }

  minuteWindow = minuteWindow.filter((at) => now - at < 60_000);
  if (minuteWindow.length >= MAX_PER_MINUTE) {
    throw new GeminiError("rate-limit", "minute budget spent");
  }

  minuteWindow.push(now);
  dayCount++;
}

/** Serialises calls and spaces them, the way sources/sec.ts does. */
function schedule<T>(task: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    reserve();
    const waitFor = lastCallAt + MIN_GAP_MS - Date.now();
    if (waitFor > 0) await new Promise((r) => setTimeout(r, waitFor));
    lastCallAt = Date.now();
    return task();
  });
  chain = run.catch(() => undefined);
  return run;
}

function apiKey(): string {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    throw new GeminiError("no-key", "GEMINI_API_KEY is not set");
  }
  return key;
}

/** What is left of the budget. Pages print it rather than hide it, so a
 *  reader who hits the ceiling can see why. */
export function geminiBudget(): { minute: number; day: number } {
  const now = Date.now();
  const inWindow = minuteWindow.filter((at) => now - at < 60_000).length;
  return {
    minute: Math.max(0, MAX_PER_MINUTE - inWindow),
    day: Math.max(0, MAX_PER_DAY - dayCount),
  };
}

/* ------------------------------------------------------------------ */
/* Calls                                                               */
/* ------------------------------------------------------------------ */

export type Turn = { role: "user" | "model"; text: string };

export type GenerateOptions = {
  system: string;
  /** A single prompt, or a conversation. */
  prompt?: string;
  turns?: Turn[];
  /** Forces a JSON object back. Set for you by generateJson. */
  json?: boolean;
  temperature?: number;
  maxOutputTokens?: number;
  timeoutMs?: number;
};

function bodyFor(options: GenerateOptions) {
  const contents = options.turns
    ? options.turns.map((turn) => ({
        role: turn.role,
        parts: [{ text: turn.text }],
      }))
    : [{ role: "user", parts: [{ text: options.prompt ?? "" }] }];

  return {
    systemInstruction: { parts: [{ text: options.system }] },
    contents,
    generationConfig: {
      temperature: options.temperature ?? 0.3,
      maxOutputTokens: options.maxOutputTokens ?? 1200,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const key = apiKey();

  return schedule(async () => {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${MODEL}:generateContent`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(bodyFor(options)),
        signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
        cache: "no-store",
      });
    } catch {
      throw new GeminiError("upstream", "request failed or timed out");
    }

    const raw = await res.text();
    if (res.status === 429) {
      throw new GeminiError("rate-limit", "Gemini returned 429");
    }
    if (!res.ok) {
      throw new GeminiError(
        "upstream",
        `Gemini ${res.status}: ${raw.slice(0, 160)}`,
      );
    }

    let text: string | undefined;
    try {
      const payload = JSON.parse(raw);
      text = payload?.candidates?.[0]?.content?.parts
        ?.map((part: { text?: string }) => part?.text ?? "")
        .join("");
    } catch {
      throw new GeminiError("upstream", "unparseable response");
    }

    if (!text) throw new GeminiError("upstream", "empty response");
    return text;
  });
}

/** A JSON answer, parsed. Throws `upstream` when the model returns prose
 *  where an object was demanded — better than handing a half-parsed shape
 *  to a page that will render "undefined" into it. */
export async function generateJson<T>(options: GenerateOptions): Promise<T> {
  const text = await generateText({ ...options, json: true });
  try {
    return JSON.parse(stripFence(text)) as T;
  } catch {
    throw new GeminiError("upstream", "model did not return valid JSON");
  }
}

/** Models sometimes wrap JSON in a code fence despite being told not to. */
function stripFence(text: string): string {
  const trimmed = text.trim();
  if (!trimmed.startsWith("```")) return trimmed;
  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/```$/, "")
    .trim();
}

/**
 * The same call, streamed.
 *
 * Streaming is not decoration on a chat: the first sentence arrives in
 * under a second while the whole answer takes eight, and a reader who sees
 * nothing for eight seconds assumes the page is broken.
 */
export async function* streamText(
  options: GenerateOptions,
): AsyncGenerator<string> {
  const key = apiKey();

  const res = await schedule(async () => {
    try {
      return await fetch(`${ENDPOINT}/${MODEL}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify(bodyFor(options)),
        signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
        cache: "no-store",
      });
    } catch {
      throw new GeminiError("upstream", "stream failed to open");
    }
  });

  if (res.status === 429) {
    throw new GeminiError("rate-limit", "Gemini returned 429");
  }
  if (!res.ok || !res.body) {
    throw new GeminiError("upstream", `Gemini ${res.status}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line, and a frame can arrive
    // split across two network chunks — so only complete ones are read.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;

      const data = line.slice(5).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const payload = JSON.parse(data);
        const text = payload?.candidates?.[0]?.content?.parts
          ?.map((part: { text?: string }) => part?.text ?? "")
          .join("");
        if (text) yield text;
      } catch {
        // A malformed frame costs that frame, not the answer.
      }
    }
  }
}

export { MODEL as GEMINI_MODEL };
