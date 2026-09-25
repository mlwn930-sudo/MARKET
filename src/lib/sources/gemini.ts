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

/**
 * The model, and what to do when it will not answer.
 *
 * Three names rather than one, tried in order, because "this model is
 * currently experiencing high demand" is a 503 that arrives on a perfectly
 * valid key — measured here, on this project's key, against the model this
 * file used to hardcode. A research page that goes blank because Google is
 * busy is a worse failure than one that answers from the lighter model.
 *
 * The lite model leads deliberately. Measured on the same prompt: 1.2
 * seconds against 3.2, with Hebrew that is just as usable for reading a
 * news story or answering a question about figures that were handed to it.
 * The site's job is to supply the numbers; the model's job is to explain
 * them, and that does not need the largest model available.
 *
 * GEMINI_MODEL still overrides, and when it does it goes to the front of
 * the queue rather than replacing it — an override should change the
 * preference, not remove the safety net.
 */
const MODEL_CHAIN = [
  ...(process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : []),
  "gemini-flash-lite-latest",
  "gemini-3.1-flash-lite",
  "gemini-flash-latest",
];

const MODEL = MODEL_CHAIN[0];

/**
 * Headroom for models that think before they write.
 *
 * The newer flash models spend hundreds of tokens reasoning, and those
 * tokens come out of the same budget as the answer. Measured: a 400-token
 * cap produced 462 thought tokens and fifteen tokens of visible text, cut
 * mid-sentence. Every cap this module is given is therefore raised by this
 * much before it is sent, so a caller asking for "about 900 tokens of
 * Hebrew" gets 900 tokens of Hebrew.
 */
const THINKING_HEADROOM = 900;

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
      maxOutputTokens: (options.maxOutputTokens ?? 1200) + THINKING_HEADROOM,
      ...(options.json ? { responseMimeType: "application/json" } : {}),
    },
  };
}

/** A failure the next model in the chain might not have. Anything else is
 *  a problem with the request, and retrying it elsewhere just spends the
 *  budget twice to receive the same answer. */
function isRetryable(status: number, body: string): boolean {
  return (
    status === 503 ||
    status === 500 ||
    status === 429 ||
    body.includes("UNAVAILABLE") ||
    body.includes("high demand")
  );
}

export async function generateText(options: GenerateOptions): Promise<string> {
  const key = apiKey();

  return schedule(async () => {
    let lastProblem = "no model answered";

    for (const model of MODEL_CHAIN) {
      let res: Response;
      try {
        res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-goog-api-key": key },
          body: JSON.stringify(bodyFor(options)),
          signal: AbortSignal.timeout(options.timeoutMs ?? 60_000),
          cache: "no-store",
        });
      } catch {
        lastProblem = `${model}: request failed or timed out`;
        continue;
      }

      const raw = await res.text();

      if (!res.ok) {
        lastProblem = `${model}: ${res.status} ${raw.slice(0, 120)}`;
        if (isRetryable(res.status, raw)) continue;
        throw new GeminiError("upstream", lastProblem);
      }

      let payload: {
        candidates?: {
          finishReason?: string;
          content?: { parts?: { text?: string }[] };
        }[];
      };
      try {
        payload = JSON.parse(raw);
      } catch {
        lastProblem = `${model}: unparseable response`;
        continue;
      }

      const candidate = payload?.candidates?.[0];
      const text = candidate?.content?.parts
        ?.map((part) => part?.text ?? "")
        .join("");

      if (text) return text;

      // A thinking model that spent the whole budget reasoning returns a
      // candidate with no text and MAX_TOKENS. Saying so is more useful
      // than "empty response", which sends the next person looking at the
      // network layer.
      lastProblem =
        candidate?.finishReason === "MAX_TOKENS"
          ? `${model}: spent its token budget thinking and produced no text`
          : `${model}: empty response`;
    }

    throw new GeminiError("upstream", lastProblem);
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

  // Same chain as the single call. A busy model is the most common failure
  // on the free tier, and a chat that answers from the lighter model beats
  // one that reports an outage.
  const res = await schedule(async () => {
    let lastStatus = 0;

    for (const model of MODEL_CHAIN) {
      let attempt: Response;
      try {
        attempt = await fetch(
          `${ENDPOINT}/${model}:streamGenerateContent?alt=sse`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": key,
            },
            body: JSON.stringify(bodyFor(options)),
            signal: AbortSignal.timeout(options.timeoutMs ?? 90_000),
            cache: "no-store",
          },
        );
      } catch {
        lastStatus = 0;
        continue;
      }

      if (attempt.ok && attempt.body) return attempt;

      lastStatus = attempt.status;
      if (!isRetryable(attempt.status, "")) break;
    }

    throw new GeminiError(
      lastStatus === 429 ? "rate-limit" : "upstream",
      `no model accepted the stream (last status ${lastStatus})`,
    );
  });

  if (!res.body) {
    throw new GeminiError("upstream", "stream opened with no body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    /* SSE frames are separated by a blank line, and a frame can arrive
       split across two network chunks — so only complete ones are read.

       The separator is matched with \r? on both newlines, and that is not
       defensive programming: Google sends CRLF. Splitting on "\n\n" alone
       never finds a frame boundary, so every token stays in the buffer and
       the stream ends having yielded nothing — which reached the page as a
       chat that answered with silence and then said it was done. */
    const frames = buffer.split(/\r?\n\r?\n/);
    buffer = frames.pop() ?? "";

    for (const frame of frames) {
      const line = frame
        .split(/\r?\n/)
        .find((l) => l.startsWith("data:"));
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
