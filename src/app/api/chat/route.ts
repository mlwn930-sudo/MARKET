import { NextResponse } from "next/server";
import { detectTickers } from "@/lib/company-names";
import { evidenceFor } from "@/lib/analysis/context";
import { CHAT_SYSTEM } from "@/lib/analysis/prompts";
import {
  GEMINI_FAILURE_TEXT,
  GeminiError,
  hasGeminiKey,
  streamText,
  type Turn,
} from "@/lib/sources/gemini";

/**
 * The chat, streamed.
 *
 * The order of operations here is the whole design. The question is read by
 * code first, the companies in it are resolved to tickers by a table, the
 * real figures for those companies are fetched from the site's own analysis
 * layer, and only then does the model see anything. It answers from a block
 * it cannot add to.
 *
 * That is slower than handing the question straight to a model, by roughly
 * the time it takes to read a cached analysis — and it is the difference
 * between an answer built on this morning's filings and an answer built on
 * whatever the model remembers.
 *
 * The evidence is attached to the last user turn rather than to the system
 * prompt, so a long conversation does not carry three stale copies of the
 * same figures. Earlier turns keep only what was said.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_TURNS = 12;
const MAX_CHARS = 2_000;

type Incoming = { role: "user" | "model"; text: string };

function sse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

export async function POST(request: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: GEMINI_FAILURE_TEXT["no-key"], reason: "no-key" },
      { status: 503 },
    );
  }

  let body: { messages?: Incoming[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const messages = (body.messages ?? [])
    .filter(
      (message): message is Incoming =>
        (message?.role === "user" || message?.role === "model") &&
        typeof message.text === "string" &&
        message.text.trim().length > 0,
    )
    .slice(-MAX_TURNS)
    .map((message) => ({
      role: message.role,
      text: message.text.slice(0, MAX_CHARS),
    }));

  const question = [...messages].reverse().find((m) => m.role === "user");
  if (!question) {
    return NextResponse.json({ error: "no question" }, { status: 400 });
  }

  // The last two user turns, because a follow-up rarely repeats the name:
  // "ומה עם המרווח שלה?" carries no ticker at all.
  const recentUserText = messages
    .filter((m) => m.role === "user")
    .slice(-2)
    .map((m) => m.text)
    .join(" ");

  const tickers = detectTickers(recentUserText);

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(sse(payload));

      try {
        const evidence = await evidenceFor(tickers, { includeMarket: true });

        send({
          type: "meta",
          tickers: evidence.tickers,
          sources: evidence.sources,
        });

        const turns: Turn[] = messages.map((message, index) =>
          index === messages.length - 1 && message.role === "user"
            ? {
                role: "user",
                text: `בלוק נתונים (זה כל מה שידוע לך; אל תוסיף מספרים משלך):\n\n${evidence.text}\n\n---\n\nהשאלה: ${message.text}`,
              }
            : message,
        );

        for await (const delta of streamText({
          system: CHAT_SYSTEM,
          turns,
          temperature: 0.35,
          maxOutputTokens: 1_400,
        })) {
          send({ type: "delta", text: delta });
        }

        send({ type: "done" });
      } catch (error) {
        const reason =
          error instanceof GeminiError ? error.reason : "upstream";
        send({ type: "error", reason, message: GEMINI_FAILURE_TEXT[reason] });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      Connection: "keep-alive",
      // Without this a proxy can hold the whole stream and deliver it at
      // once, which looks exactly like a page that hung.
      "X-Accel-Buffering": "no",
    },
  });
}
