import { NextResponse } from "next/server";
import { normaliseTicker } from "@/lib/company-names";
import { companyEvidence } from "@/lib/analysis/context";
import {
  RESEARCH_PLAN_SYSTEM,
  RESEARCH_SECTION_SYSTEM,
  RESEARCH_SYNTHESIS_SYSTEM,
  RESEARCH_CONTRARIAN_SYSTEM,
} from "@/lib/analysis/prompts";
import {
  GEMINI_FAILURE_TEXT,
  GeminiError,
  generateJson,
  hasGeminiKey,
} from "@/lib/sources/gemini";

/**
 * Deep research: plan, answer, synthesise.
 *
 * Three stages, in that order, because the order is what makes the output
 * different from a long chat reply.
 *
 *   Plan — the question is broken into sub-questions BEFORE any evidence is
 *   read. A plan written after the evidence only ever asks what the
 *   evidence already answers, and the gaps never surface.
 *
 *   Answer — each sub-question is answered against the evidence block on
 *   its own, in its own call. One call answering three questions produces
 *   three paragraphs that agree with each other; three calls produce three
 *   answers that can disagree, which is the point.
 *
 *   Synthesise — the answers are handed back with the original question,
 *   and the model is asked where they conflict. That section is the
 *   product. Anything that only summarises is available from the chat.
 *
 * Capped at three sub-questions. Five model calls at roughly six seconds
 * each is already most of the function's time budget, and the minute
 * window in sources/gemini.ts allows ten calls — two researches a minute,
 * which is more than one reader needs and less than the quota can lose.
 */

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_QUESTIONS = 3;

type PlanQuestion = { id: string; question: string; why: string };
type Plan = { questions?: PlanQuestion[] };

type SectionAnswer = {
  answer?: string;
  evidence?: string[];
  gaps?: string[];
  confidence?: "high" | "medium" | "low";
  confidenceWhy?: string;
};

type Contrarian = {
  strongestCounter?: string;
  fragileAssumption?: string;
  alreadyPriced?: string;
  contradicting?: string[];
  whatWouldProveYouWrong?: string;
};

type Synthesis = {
  answer?: string;
  tensions?: { between: string; detail: string }[];
  whatWouldChangeIt?: string[];
  gaps?: string[];
};

function sse(payload: unknown): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`);
}

const strings = (value: unknown, limit = 6): string[] =>
  Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string").slice(0, limit)
    : [];

export async function POST(request: Request) {
  if (!hasGeminiKey()) {
    return NextResponse.json(
      { error: GEMINI_FAILURE_TEXT["no-key"], reason: "no-key" },
      { status: 503 },
    );
  }

  let body: { ticker?: string; question?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  }

  const ticker = normaliseTicker(body.ticker ?? "");
  if (!ticker) {
    return NextResponse.json({ error: "bad ticker" }, { status: 400 });
  }

  const question =
    (body.question ?? "").trim().slice(0, 500) ||
    `מה צריך להבין על ${ticker} לפני החלטת השקעה לטווח בינוני-ארוך?`;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (payload: unknown) => controller.enqueue(sse(payload));

      try {
        /* ---- Evidence ---- */
        send({ type: "status", step: "evidence", label: `אוסף נתונים על ${ticker}` });

        const evidence = await companyEvidence(ticker);
        if (!evidence) {
          send({
            type: "error",
            reason: "no-company",
            message: `לא נמצאו נתונים על ${ticker}. ייתכן שהסימבול שגוי או שהחברה אינה מגישה דוחות ל-SEC.`,
          });
          controller.close();
          return;
        }
        send({ type: "evidence", sources: evidence.sources });

        /* ---- Plan ---- */
        send({ type: "status", step: "plan", label: "מפרק את השאלה" });

        const plan = await generateJson<Plan>({
          system: RESEARCH_PLAN_SYSTEM,
          prompt: `החברה: ${ticker}\nשאלת המחקר: ${question}`,
          temperature: 0.4,
          maxOutputTokens: 700,
        });

        const questions = (plan.questions ?? [])
          .filter((q) => q && typeof q.question === "string")
          .slice(0, MAX_QUESTIONS)
          .map((q, index) => ({
            id: q.id || `q${index + 1}`,
            question: q.question,
            why: typeof q.why === "string" ? q.why : "",
          }));

        if (questions.length === 0) {
          send({
            type: "error",
            reason: "upstream",
            message: "לא הצלחתי לפרק את השאלה לשאלות משנה. נסה לנסח אותה אחרת.",
          });
          controller.close();
          return;
        }

        send({ type: "plan", questions });

        /* ---- Answers ---- */
        const answers: { question: string; answer: string }[] = [];

        for (const [index, item] of questions.entries()) {
          send({
            type: "status",
            step: "section",
            label: `עונה על שאלה ${index + 1} מתוך ${questions.length}`,
          });

          const section = await generateJson<SectionAnswer>({
            system: RESEARCH_SECTION_SYSTEM,
            prompt: `בלוק נתונים (זה כל מה שידוע לך):\n\n${evidence.text}\n\n---\n\nשאלת המשנה: ${item.question}`,
            temperature: 0.3,
            maxOutputTokens: 900,
          });

          const payload = {
            type: "section" as const,
            id: item.id,
            question: item.question,
            why: item.why,
            answer: section.answer ?? "",
            evidence: strings(section.evidence, 4),
            gaps: strings(section.gaps, 4),
            confidence: section.confidence ?? "medium",
            confidenceWhy: section.confidenceWhy ?? "",
          };

          if (payload.answer) {
            answers.push({ question: item.question, answer: payload.answer });
            send(payload);
          }
        }

        if (answers.length === 0) {
          send({
            type: "error",
            reason: "upstream",
            message: "אף שאלת משנה לא קיבלה תשובה שנשענת על הנתונים.",
          });
          controller.close();
          return;
        }

        /* ---- Synthesis ---- */
        send({ type: "status", step: "synthesis", label: "מחפש איפה הממצאים לא מסכימים" });

        const synthesis = await generateJson<Synthesis>({
          system: RESEARCH_SYNTHESIS_SYSTEM,
          prompt:
            `שאלת המחקר: ${question}\n\nהתשובות לשאלות המשנה:\n\n` +
            answers
              .map((a, i) => `${i + 1}. ${a.question}\n${a.answer}`)
              .join("\n\n"),
          temperature: 0.35,
          maxOutputTokens: 1_200,
        });

        send({
          type: "synthesis",
          answer: synthesis.answer ?? "",
          tensions: Array.isArray(synthesis.tensions)
            ? synthesis.tensions
                .filter(
                  (t) =>
                    t &&
                    typeof t.between === "string" &&
                    typeof t.detail === "string",
                )
                .slice(0, 4)
            : [],
          whatWouldChangeIt: strings(synthesis.whatWouldChangeIt, 4),
          gaps: strings(synthesis.gaps, 4),
        });

        /* ---- The attack ----

           Runs last, is told what the synthesis concluded, and is asked to
           break it rather than to balance it. Kept as its own call and its
           own section: merged into the synthesis, a model softens its own
           conclusion into "interesting, but there are risks", which is
           what every analysis says and no analysis means. */
        if (synthesis.answer) {
          send({
            type: "status",
            step: "contrarian",
            label: "תוקף את המסקנה",
          });

          const contrarian = await generateJson<Contrarian>({
            system: RESEARCH_CONTRARIAN_SYSTEM,
            prompt:
              `המסקנה שנוסחה:\n${synthesis.answer}\n\n---\n\nהנתונים שעליהם היא נשענת:\n\n${evidence.text}`,
            temperature: 0.45,
            maxOutputTokens: 900,
          }).catch(() => null);

          if (contrarian?.strongestCounter) {
            send({
              type: "contrarian",
              strongestCounter: contrarian.strongestCounter,
              fragileAssumption: contrarian.fragileAssumption ?? "",
              alreadyPriced: contrarian.alreadyPriced ?? "",
              contradicting: strings(contrarian.contradicting, 4),
              whatWouldProveYouWrong: contrarian.whatWouldProveYouWrong ?? "",
            });
          }
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
      "X-Accel-Buffering": "no",
    },
  });
}
