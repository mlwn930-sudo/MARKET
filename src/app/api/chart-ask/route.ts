import { NextResponse } from "next/server";
import { CHART_ASK_SYSTEM } from "@/lib/analysis/prompts";
import { chartEvidence } from "@/lib/analysis/chart-evidence";
import {
  GEMINI_FAILURE_TEXT,
  GeminiError,
  hasGeminiKey,
  streamText,
} from "@/lib/sources/gemini";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";

/**
 * A question about the chart in front of the reader.
 *
 * The read explains what a chart shows. It does not answer what somebody
 * asks next, which is always a version of "so what is going on" — what is
 * this pattern, what usually follows it, where would the opportunity be,
 * what should I wait for. Those questions get asked whatever this site
 * does. The only choice is whether they are answered over measurements or
 * over a model's imagination.
 *
 * THE CORROBORATION IS POSTED BACK RATHER THAN RECOMPUTED, and that is
 * worth stating because it looks like a shortcut. It is the opposite: the
 * block the model answers from has to be the same evidence the reader can
 * see on the page, or an answer could cite something nobody can check.
 * Recomputing it here would also mean a second ten-year pull per question
 * and a block that quietly drifts from the panels above it as prices move
 * mid-session.
 *
 * It is not a trust boundary either way. Nothing in the posted object is
 * written anywhere or acted on; it is turned into text and handed to a
 * model that is forbidden from adding figures to it. The worst a tampered
 * body can do is produce an answer about a chart that does not exist, for
 * the person who tampered with it.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** Long enough for a real question, short enough that the body cannot be
 *  used as a channel for a prompt of somebody else's design. */
const MAX_QUESTION = 400;

export async function POST(request: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: GEMINI_FAILURE_TEXT["no-key"], reason: "no-key" },
      { status: 503 },
    );
  }

  let body: { question?: unknown; corroboration?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const question =
    typeof body.question === "string"
      ? body.question.trim().slice(0, MAX_QUESTION)
      : "";
  const checked = body.corroboration as Corroboration | null;

  if (!question) {
    return NextResponse.json({ error: "missing question" }, { status: 400 });
  }
  if (!checked?.ticker) {
    return NextResponse.json(
      {
        error:
          "אין קריאה מאומתת לשאול עליה. השאלות נענות רק על גרף שהאתר הצליח לזהות ולהצליב מול נרות אמיתיים.",
        reason: "no-context",
      },
      { status: 422 },
    );
  }

  const evidence = chartEvidence(checked);

  const stream = new ReadableStream({
    async start(controller) {
      const encode = new TextEncoder();
      const send = (payload: unknown) =>
        controller.enqueue(
          encode.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );

      try {
        for await (const delta of streamText({
          system: CHART_ASK_SYSTEM,
          turns: [
            {
              role: "user",
              text:
                `בלוק נתונים (זה כל מה שידוע לך; אל תוסיף מספרים משלך):\n\n${evidence}` +
                `\n\n---\n\nהשאלה: ${question}`,
            },
          ],
          temperature: 0.3,
          maxOutputTokens: 900,
        })) {
          send({ type: "delta", text: delta });
        }
        send({ type: "done" });
      } catch (error) {
        const reason = error instanceof GeminiError ? error.reason : "upstream";
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
      /* Without this a proxy can hold the whole stream and deliver it at
         once, which looks exactly like a page that hung. */
      "X-Accel-Buffering": "no",
    },
  });
}
