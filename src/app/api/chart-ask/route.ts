import { NextResponse } from "next/server";
import { CHART_ASK_SYSTEM } from "@/lib/analysis/prompts";
import {
  chartEvidence,
  lengthRejectedOnce,
} from "@/lib/analysis/chart-evidence";
import { watchlistFor } from "@/lib/analysis/watchlist-context";
import { readPositionFrom } from "@/lib/analysis/position";
import { buildTradePlan } from "@/lib/analysis/trade-plan";
import { buildChartStance } from "@/lib/analysis/stance";
import {
  GEMINI_FAILURE_TEXT,
  GeminiError,
  hasGeminiKey,
  generateText,
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

  let body: {
    question?: unknown;
    corroboration?: unknown;
    watchlist?: unknown;
    position?: unknown;
  };
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

  /* THE READER'S OWN LIST, WHICH IS WHAT MAKES A CHART A DECISION.
     Supplied by the page rather than stored here: the watchlist lives
     in the browser and the server keeps a copy only for the alert mail.
     It is a query and never an assertion — every figure is looked up
     server-side in the site's own files. See `watchlist-context.ts`. */
  const followed = Array.isArray(body.watchlist)
    ? (body.watchlist as unknown[]).filter(
        (t): t is string => typeof t === "string",
      )
    : [];

  /* THE ONE NUMBER CANDLES CANNOT SUPPLY, and the reason it arrives
     from the page instead of being derived. A cost basis changes what
     every figure above it means — a stop is protection at one entry and
     a profit give-back at another — and it is the most personal number
     on the site, so it lives in the reader's browser and is forgotten
     as soon as this answer is written. Validated as a price, not
     trusted as one: an entry outside a plausible band around the
     instrument's own close is dropped rather than used. */
  const stance = buildChartStance({
    setup: checked.setup,
    baseRates: checked.baseRates,
    lastClose: checked.lastClose,
  });
  const lead =
    stance?.swing.agreeing[0] ?? stance?.position.agreeing[0] ?? null;
  const position = readPositionFrom(
    body.position,
    checked,
    buildTradePlan({
      lastClose: checked.lastClose,
      asOf: checked.baseRates?.to ?? "",
      levels: checked.realLevels,
      atr: checked.atr,
      lead,
    }),
    lead?.medianPct ?? null,
  );

  const evidence = chartEvidence(
    checked,
    await watchlistFor(checked, followed),
    position,
  );

  const stream = new ReadableStream({
    async start(controller) {
      const encode = new TextEncoder();
      const send = (payload: unknown) =>
        controller.enqueue(
          encode.encode(`data: ${JSON.stringify(payload)}\n\n`),
        );

      try {
        /* GENERATED WHOLE, THEN STREAMED — NOT STREAMED FROM THE MODEL.
         *
         * The obvious shape is to pipe the model's stream straight
         * through, and this did until the Arabic guard landed. A
         * multilingual model drops Arabic letters into Hebrew often
         * enough to matter; `generateText` answers that by rejecting the
         * response and retrying, and a stream cannot — by the time the
         * character arrives, the sentences before it are already on the
         * reader's screen. So one stray letter killed the whole answer
         * and the reader got "the model did not return a valid answer",
         * which is exactly what the first person to use this saw.
         *
         * These answers are two to five lines. Generating one whole costs
         * a second of waiting and buys the retry; chunking the finished
         * text back out keeps the typing, which is the only part of
         * streaming the reader was ever getting.
         */
        const answer = await generateText({
          system: CHART_ASK_SYSTEM,
          turns: [
            {
              role: "user",
              text:
                `בלוק נתונים (זה כל מה שידוע לך; אל תוסיף מספרים משלך):\n\n${evidence}` +
                `\n\n---\n\nהשאלה: ${question}`,
            },
          ],
          /* A base rate is a count of times price closed higher. It is
             not a success rate, nobody succeeded at anything, and the
             difference is the whole distance between a measurement and
             a promise. The prompt has said so since it was written and
             the answer came back "70% הצלחה" anyway — a rule stated
             once in a long system prompt is a rule that survives until
             the model is busy. Rejected and asked again instead. */
          /* THE TWO REJECTIONS ARE NOT THE SAME KIND, and treating them
             alike cost a reader their answer. Calling a base rate a
             success rate is wrong, and no answer beats a wrong one — so
             it rejects every time. Running long is a style failure, and
             an answer that is correct but wordy beats no answer at all.
             Measured: "how far from the high, and what happened in the
             last month" is a question whose honest answer is a list; it
             was rejected on every attempt until the chain ran out and
             the reader got the upstream error instead. So length costs
             exactly one retry and then stands. */
          reject: lengthRejectedOnce(),
          temperature: 0.3,
          maxOutputTokens: 900,
          /* The same ceiling as the read, and the same arithmetic: no
             per-attempt timeout meant the default 60 seconds times
             three models against a route cut at 60. One clock. */
          timeoutMs: 20_000,
          budgetMs: 45_000,
        });

        /* Word by word, not character by character: a Hebrew word
           assembled letter by letter reflows as it grows and the line
           jitters. */
        for (const chunk of answer.split(/(\s+)/)) {
          if (!chunk) continue;
          send({ type: "delta", text: chunk });
          await new Promise((resolve) => setTimeout(resolve, 12));
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
