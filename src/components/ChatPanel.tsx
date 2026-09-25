"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

/**
 * The chat.
 *
 * Three decisions worth stating.
 *
 * It streams. The evidence block is assembled before the model is called,
 * which costs a second or two before the first word appears; without
 * streaming the reader would watch a still page for eight seconds and
 * conclude it had broken.
 *
 * It shows its sources. Every answer carries the list of what was in the
 * evidence block — SEC with the filing date, Finnhub for the quote, the
 * site's own news analysis. An answer whose provenance is invisible is
 * indistinguishable from one that was invented, and this is the one page on
 * the site where that risk is real.
 *
 * It does not render Markdown. The model is asked for prose and the few
 * emphasis marks that slip through are stripped rather than styled — a
 * research answer full of bold phrases reads as a sales page.
 */

type Message = {
  role: "user" | "model";
  text: string;
  sources?: string[];
  tickers?: string[];
  failed?: boolean;
};

const STARTERS = [
  "מה המצב של NVDA מול חציון הסקטור?",
  "מה קרה היום בשוק, ומה מזה בכלל משנה?",
  "השווה בין AMD לאינטל — איפה ההבדל האמיתי?",
  "איזה נתון היה שובר את התזה של TTWO?",
];

/** Emphasis markers the model sometimes adds despite being asked for prose. */
function clean(text: string): string {
  return text.replace(/\*\*(.+?)\*\*/g, "$1").replace(/^#+\s*/gm, "");
}

function Bubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  return (
    <div className={isUser ? "flex justify-start" : ""}>
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-lg border border-line-strong bg-raised px-4 py-2.5"
            : "w-full"
        }
      >
        {!isUser && (
          <div className="mb-2 flex items-center gap-2">
            <span className="section-mark" aria-hidden="true" />
            <span className="eyebrow">התשובה</span>
          </div>
        )}

        <div
          className={`space-y-2.5 text-[14px] leading-relaxed ${
            message.failed ? "text-ink-faint" : isUser ? "text-ink" : "text-ink-muted"
          }`}
        >
          {clean(message.text)
            .split("\n")
            .filter((line) => line.trim().length > 0)
            .map((line, i) => (
              <p key={i} dir="auto">
                {line}
              </p>
            ))}
          {message.role === "model" && message.text.length === 0 && (
            <p className="text-ink-faint">קורא את הנתונים…</p>
          )}
        </div>

        {message.tickers && message.tickers.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            {message.tickers.map((ticker) => (
              <Link
                key={ticker}
                href={`/company/${ticker}`}
                className="num rounded border border-line px-1.5 py-0.5 text-[10px] text-ink-faint transition-colors hover:border-line-strong hover:text-ink"
              >
                {ticker}
              </Link>
            ))}
          </div>
        )}

        {message.sources && message.sources.length > 0 && (
          <details className="mt-3 border-t border-line pt-2">
            <summary className="cursor-pointer text-[11px] text-ink-ghost transition-colors hover:text-ink-muted">
              על מה התשובה נשענת ({message.sources.length} מקורות)
            </summary>
            <ul className="mt-2 space-y-1">
              {message.sources.map((source) => (
                <li key={source} className="text-[11px] text-ink-faint">
                  {source}
                </li>
              ))}
            </ul>
          </details>
        )}
      </div>
    </div>
  );
}

export function ChatPanel({
  enabled,
  initialQuestion,
}: {
  enabled: boolean;
  /** Sent once on mount. The command palette hands a typed question
   *  straight to the chat rather than dropping the reader into an empty
   *  box with their sentence lost. */
  initialQuestion?: string;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const abort = useRef<AbortController | null>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  useEffect(() => () => abort.current?.abort(), []);

  const asked = useRef(false);
  useEffect(() => {
    if (!enabled || asked.current || !initialQuestion?.trim()) return;
    asked.current = true;
    void send(initialQuestion);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, initialQuestion]);

  async function send(question: string) {
    const text = question.trim();
    if (!text || busy) return;

    const history = [...messages, { role: "user" as const, text }];
    setMessages([...history, { role: "model", text: "" }]);
    setDraft("");
    setBusy(true);

    const controller = new AbortController();
    abort.current = controller;

    /** Updates the answer in place. The reply is always the last message. */
    const patch = (update: (message: Message) => Message) =>
      setMessages((current) =>
        current.map((message, i) =>
          i === current.length - 1 ? update(message) : message,
        ),
      );

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: history.map(({ role, text }) => ({ role, text })),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        patch((message) => ({
          ...message,
          failed: true,
          text: payload?.error ?? "הבקשה נכשלה. הנתונים בשאר האתר לא הושפעו.",
        }));
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

          let event: {
            type: string;
            text?: string;
            sources?: string[];
            tickers?: string[];
            message?: string;
          };
          try {
            event = JSON.parse(line.slice(5).trim());
          } catch {
            continue;
          }

          if (event.type === "meta") {
            patch((message) => ({
              ...message,
              sources: event.sources ?? [],
              tickers: event.tickers ?? [],
            }));
          } else if (event.type === "delta" && event.text) {
            patch((message) => ({ ...message, text: message.text + event.text }));
          } else if (event.type === "error") {
            patch((message) => ({
              ...message,
              failed: true,
              text: event.message ?? "הבקשה נכשלה.",
            }));
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") return;
      patch((message) => ({
        ...message,
        failed: true,
        text: "החיבור נקטע. הנתונים בשאר האתר לא הושפעו.",
      }));
    } finally {
      setBusy(false);
      abort.current = null;
    }
  }

  return (
    <div className="space-y-6">
      {messages.length === 0 && (
        <div className="grid gap-2 sm:grid-cols-2">
          {STARTERS.map((starter) => (
            <button
              key={starter}
              type="button"
              disabled={!enabled}
              onClick={() => send(starter)}
              className="surface interactive px-4 py-3 text-start text-[13px] text-ink-muted disabled:cursor-not-allowed disabled:opacity-50"
            >
              {starter}
            </button>
          ))}
        </div>
      )}

      {messages.length > 0 && (
        <div className="space-y-8">
          {messages.map((message, i) => (
            <Bubble key={i} message={message} />
          ))}
          <div ref={endRef} />
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          send(draft);
        }}
        className="sticky bottom-4 z-10"
      >
        <div className="surface flex items-end gap-2 p-2 backdrop-blur-xl">
          <label htmlFor="chat-input" className="sr-only">
            שאלה
          </label>
          <textarea
            id="chat-input"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              // Enter sends, Shift+Enter breaks a line. The other way round
              // costs a click on every single question.
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                send(draft);
              }
            }}
            rows={2}
            disabled={!enabled || busy}
            placeholder={
              enabled
                ? "שאל על חברה, על סקטור, או על מה שקרה היום"
                : "הצ׳אט כבוי — חסר מפתח מודל"
            }
            className="min-h-[52px] flex-1 resize-none bg-transparent px-2 py-2 text-[14px] text-ink placeholder:text-ink-faint focus:outline-none disabled:cursor-not-allowed"
          />
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
              disabled={!enabled || draft.trim().length === 0}
              className="btn btn-primary px-4 py-2 text-[13px] disabled:opacity-40"
            >
              שאל
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
