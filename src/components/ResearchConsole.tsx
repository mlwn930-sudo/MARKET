"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { CONFIDENCE_LABELS } from "@/lib/agents/types";
import { normaliseTicker } from "@/lib/company-names";

/**
 * Deep research, watched while it runs.
 *
 * The steps are shown rather than hidden behind a spinner because they are
 * the argument for trusting the output: the reader sees the question being
 * broken into sub-questions, each one answered against the evidence, and
 * the conflicts found last. A spinner followed by four paragraphs asks for
 * the same trust and gives nothing to base it on.
 *
 * The finished report is kept in localStorage. There is no database, so a
 * reload would otherwise throw away a minute of model calls — and the model
 * budget is the scarcest thing this project has.
 */

type Section = {
  id: string;
  question: string;
  why: string;
  answer: string;
  evidence: string[];
  gaps: string[];
  confidence: "high" | "medium" | "low";
  confidenceWhy: string;
};

type Synthesis = {
  answer: string;
  tensions: { between: string; detail: string }[];
  whatWouldChangeIt: string[];
  gaps: string[];
};

type Contrarian = {
  strongestCounter: string;
  fragileAssumption: string;
  alreadyPriced: string;
  contradicting: string[];
  whatWouldProveYouWrong: string;
};

type Report = {
  ticker: string;
  question: string;
  sources: string[];
  plan: { id: string; question: string; why: string }[];
  sections: Section[];
  synthesis: Synthesis | null;
  contrarian: Contrarian | null;
  finishedAt: string | null;
};

const STORE_KEY = "market-intel:research:v1";

const EMPTY: Report = {
  ticker: "",
  question: "",
  sources: [],
  plan: [],
  sections: [],
  synthesis: null,
  contrarian: null,
  finishedAt: null,
};

export function ResearchConsole({
  enabled,
  initialTicker = "",
}: {
  enabled: boolean;
  initialTicker?: string;
}) {
  const [ticker, setTicker] = useState(initialTicker);
  const [question, setQuestion] = useState("");
  const [report, setReport] = useState<Report>(EMPTY);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);

  // The last report, restored. Only when nothing is running, so a restore
  // cannot land on top of a live run.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORE_KEY);
      if (raw) setReport(JSON.parse(raw) as Report);
    } catch {
      /* Storage off. The console works, it just forgets. */
    }
  }, []);

  useEffect(() => () => abort.current?.abort(), []);

  async function run() {
    const symbol = normaliseTicker(ticker);
    if (!symbol || busy) return;

    const controller = new AbortController();
    abort.current = controller;

    setBusy(true);
    setError(null);
    setStatus("מתחיל");
    setReport({ ...EMPTY, ticker: symbol, question: question.trim() });

    let live: Report = { ...EMPTY, ticker: symbol, question: question.trim() };
    const update = (next: Partial<Report>) => {
      live = { ...live, ...next };
      setReport(live);
    };

    try {
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticker: symbol, question: question.trim() }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? "הבקשה נכשלה.");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const frames = buffer.split("\n\n");
        buffer = frames.pop() ?? "";

        for (const frame of frames) {
          const line = frame.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;

          let event: Record<string, unknown>;
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          switch (event.type) {
            case "status":
              setStatus(String(event.label ?? ""));
              break;
            case "evidence":
              update({ sources: (event.sources as string[]) ?? [] });
              break;
            case "plan":
              update({ plan: (event.questions as Report["plan"]) ?? [] });
              break;
            case "section":
              update({
                sections: [...live.sections, event as unknown as Section],
              });
              break;
            case "synthesis":
              update({ synthesis: event as unknown as Synthesis });
              break;
            case "contrarian":
              update({ contrarian: event as unknown as Contrarian });
              break;
            case "done":
              update({ finishedAt: new Date().toISOString() });
              setStatus(null);
              try {
                window.localStorage.setItem(STORE_KEY, JSON.stringify(live));
              } catch {
                /* Nothing to do. The report is on screen either way. */
              }
              break;
            case "error":
              setError(String(event.message ?? "הבקשה נכשלה."));
              setStatus(null);
              break;
          }
        }
      }
    } catch (err) {
      if ((err as Error).name !== "AbortError") {
        setError("החיבור נקטע לפני שהמחקר הסתיים.");
      }
    } finally {
      setBusy(false);
      setStatus(null);
      abort.current = null;
    }
  }

  return (
    <div className="space-y-8">
      {/* The request */}
      <form
        onSubmit={(event) => {
          event.preventDefault();
          run();
        }}
        className="surface space-y-3 p-4"
      >
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label htmlFor="research-ticker" className="block text-[11px] text-ink-faint">
              חברה
            </label>
            <input
              id="research-ticker"
              value={ticker}
              onChange={(event) => setTicker(event.target.value)}
              placeholder="NVDA"
              autoComplete="off"
              spellCheck={false}
              className="num mt-1 w-32 rounded-md border border-line bg-base px-3 py-2 text-[13px] text-ink placeholder:font-sans placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>
          <div className="min-w-[240px] flex-1">
            <label htmlFor="research-question" className="block text-[11px] text-ink-faint">
              שאלת המחקר (אפשר להשאיר ריק)
            </label>
            <input
              id="research-question"
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="למשל: האם המרווח שנשמר השנה בר-קיימא?"
              className="mt-1 w-full rounded-md border border-line bg-base px-3 py-2 text-[13px] text-ink placeholder:text-ink-faint focus:border-line-strong focus:outline-none"
            />
          </div>
          {busy ? (
            <button
              type="button"
              onClick={() => abort.current?.abort()}
              className="btn btn-ghost px-4 py-2 text-[13px]"
            >
              עצור
            </button>
          ) : (
            <button
              type="submit"
              disabled={!enabled || ticker.trim().length === 0}
              className="btn btn-primary px-5 py-2 text-[13px] disabled:opacity-40"
            >
              הרץ מחקר
            </button>
          )}
        </div>

        <p className="text-[11px] leading-relaxed text-ink-ghost">
          המחקר רץ בשלושה שלבים: פירוק השאלה, מענה על כל שאלת משנה מול
          הנתונים, ואיתור המקומות שבהם הממצאים לא מסכימים. חמש קריאות מודל,
          כשלושים שניות.
        </p>
      </form>

      {status && (
        <p className="flex items-center gap-2 text-[13px] text-ink-muted">
          <span className="live-dot inline-block h-[5px] w-[5px] rounded-full bg-accent" aria-hidden="true" />
          {status}…
        </p>
      )}

      {error && (
        <p className="surface px-5 py-4 text-[13px] leading-relaxed text-ink-faint">
          {error}
        </p>
      )}

      {/* The plan */}
      {report.plan.length > 0 && (
        <section>
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">התוכנית</span>
          </div>
          <ol className="surface divide-y divide-line">
            {report.plan.map((item, index) => {
              const answered = report.sections.some((s) => s.id === item.id);
              return (
                <li key={item.id} className="flex gap-3 px-5 py-3">
                  <span className="num text-[12px] text-ink-ghost">
                    {index + 1}
                  </span>
                  <span className="flex-1">
                    <span className="block text-[13px] text-ink">
                      {item.question}
                    </span>
                    {item.why && (
                      <span className="mt-0.5 block text-[11px] text-ink-faint">
                        {item.why}
                      </span>
                    )}
                  </span>
                  <span className="text-[11px] text-ink-ghost">
                    {answered ? "נענה" : busy ? "ממתין" : "—"}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {/* The answers */}
      {report.sections.map((section) => (
        <section key={section.id} className="surface p-5">
          <h3 className="title text-[17px]">{section.question}</h3>

          <div className="mt-3 space-y-2.5 text-[14px] leading-relaxed text-ink-muted">
            {section.answer
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <p key={i} dir="auto">
                  {line}
                </p>
              ))}
          </div>

          {section.evidence.length > 0 && (
            <dl className="mt-4 border-t border-line pt-3">
              <dt className="text-[11px] text-ink-ghost">הנתונים שמאחורי התשובה</dt>
              {section.evidence.map((item, i) => (
                <dd key={i} className="mt-1 text-[12px] leading-relaxed text-ink-faint">
                  {item}
                </dd>
              ))}
            </dl>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-3">
            <span className="badge">{CONFIDENCE_LABELS[section.confidence]}</span>
            {section.confidenceWhy && (
              <span className="text-[11px] text-ink-faint">
                {section.confidenceWhy}
              </span>
            )}
          </div>

          {section.gaps.length > 0 && (
            <ul className="mt-3 space-y-1">
              {section.gaps.map((gap, i) => (
                <li key={i} className="text-[11px] text-ink-ghost">
                  חסר: {gap}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}

      {/* The synthesis */}
      {report.synthesis && (
        <section className="surface p-5">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">סינתזה</span>
          </div>

          <div className="space-y-2.5 text-[14px] leading-relaxed text-ink">
            {report.synthesis.answer
              .split("\n")
              .filter((line) => line.trim())
              .map((line, i) => (
                <p key={i} dir="auto">
                  {line}
                </p>
              ))}
          </div>

          {report.synthesis.tensions.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="eyebrow mb-2">איפה המסגרות לא מסכימות</h4>
              <ul className="space-y-2">
                {report.synthesis.tensions.map((tension, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-ink-muted">
                    <span className="text-ink">{tension.between}: </span>
                    {tension.detail}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.synthesis.whatWouldChangeIt.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="eyebrow mb-2">מה היה משנה את התשובה</h4>
              <ul className="space-y-1.5">
                {report.synthesis.whatWouldChangeIt.map((item, i) => (
                  <li key={i} className="text-[13px] leading-relaxed text-ink-muted">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {report.synthesis.gaps.length > 0 && (
            <div className="mt-5 border-t border-line pt-4">
              <h4 className="eyebrow mb-2">מה נשאר לא ידוע</h4>
              <ul className="space-y-1.5">
                {report.synthesis.gaps.map((gap, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-ink-faint">
                    {gap}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* The attack on the conclusion above it */}
      {report.contrarian && (
        <section
          className="surface p-5"
          style={{ borderColor: "color-mix(in oklab, var(--color-insight) 35%, transparent)" }}
        >
          <div className="mb-3 flex items-center gap-2.5">
            <span
              className="block h-[2px] w-7 rounded-full"
              style={{ background: "var(--color-insight)" }}
              aria-hidden="true"
            />
            <span className="eyebrow">הצד השני</span>
          </div>

          <p className="text-[14px] leading-relaxed text-ink">
            {report.contrarian.strongestCounter}
          </p>

          <dl className="mt-4 space-y-3 border-t border-line pt-4">
            {[
              {
                label: "ההנחה השברירית ביותר",
                body: report.contrarian.fragileAssumption,
              },
              {
                label: "מה כנראה כבר מתומחר",
                body: report.contrarian.alreadyPriced,
              },
              {
                label: "מה היה מפריך דווקא את ההתנגדות הזאת",
                body: report.contrarian.whatWouldProveYouWrong,
              },
            ]
              .filter((row) => row.body)
              .map((row) => (
                <div key={row.label}>
                  <dt className="text-[11px] text-ink-ghost">{row.label}</dt>
                  <dd className="mt-0.5 text-[13px] leading-relaxed text-ink-muted">
                    {row.body}
                  </dd>
                </div>
              ))}
          </dl>

          {report.contrarian.contradicting.length > 0 ? (
            <div className="mt-4 border-t border-line pt-4">
              <h4 className="eyebrow mb-2">ראיות בנתונים שסותרות את המסקנה</h4>
              <ul className="space-y-1.5">
                {report.contrarian.contradicting.map((item, i) => (
                  <li key={i} className="text-[12px] leading-relaxed text-ink-faint">
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 border-t border-line pt-4 text-[12px] leading-relaxed text-ink-faint">
              לא נמצאה בנתונים ראיה שסותרת את המסקנה. זה ממצא בפני עצמו — הוא
              אומר שהמסקנה לא נתקלת בהתנגדות בתוך מה שנמדד, ולא שהיא נכונה.
            </p>
          )}
        </section>
      )}

      {/* Provenance */}
      {report.sources.length > 0 && (
        <section className="border-t border-line pt-4">
          <h4 className="eyebrow mb-2">מקורות הנתונים במחקר הזה</h4>
          <ul className="space-y-1">
            {report.sources.map((source) => (
              <li key={source} className="text-[11px] text-ink-faint">
                {source}
              </li>
            ))}
          </ul>
          {report.ticker && (
            <p className="mt-3 text-[12px]">
              <Link
                href={`/company/${report.ticker}`}
                className="text-ink-muted transition-colors hover:text-ink"
              >
                כל הנתונים על {report.ticker} בעמוד החברה ←
              </Link>
            </p>
          )}
        </section>
      )}
    </div>
  );
}
