"use client";

import { useCallback, useRef, useState } from "react";
import { CHART_QUESTIONS } from "@/lib/analysis/chart-evidence";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";
import { isPrivateBuild } from "@/lib/private-mode";

/**
 * The questions a reader has once the chart has been explained to them.
 *
 * Every panel above this one answers a question the site chose. This one
 * answers the question the reader actually has, which after any
 * explanation is some form of "so what is going on" — what is this
 * pattern, what usually follows it, where is the opportunity, what should
 * I wait for.
 *
 * Those get asked whatever the site does. The only thing it controls is
 * whether they are answered over the measurements on this page or over a
 * model's imagination, and that is settled server-side: the answer is
 * generated from a block assembled in code out of the same panels the
 * reader can see, and the prompt forbids adding a figure to it.
 *
 * THE ENTRY-POINT QUESTION IS OFFERED, NOT AVOIDED. It is what everybody
 * wants to ask and the one thing this project will not answer — rule 7 is
 * that the site never sends an order and rule 8 is that it analyses
 * rather than rates. But refusing to engage would be its own dishonesty,
 * because there is a real answer under the question: not "buy at 204" but
 * "here is the observable event you could wait for, here is how often it
 * has happened on this name, and here is the baseline that makes the
 * number mean anything". So the suggested question is phrased that way,
 * and the disclaimer under the box says plainly which half is missing.
 *
 * It streams, because a four-line answer arriving all at once after six
 * seconds reads as a page that hung.
 */

type State =
  | { phase: "idle" }
  | { phase: "asking"; question: string; answer: string }
  | { phase: "done"; question: string; answer: string }
  | { phase: "error"; question: string; message: string };

export function ChartAsk({ checked }: { checked: Corroboration | null }) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [draft, setDraft] = useState("");
  const inFlight = useRef(false);

  const ask = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || inFlight.current || !checked) return;
      inFlight.current = true;
      setState({ phase: "asking", question: text, answer: "" });

      try {
        const res = await fetch("/api/chart-ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: text, corroboration: checked }),
        });

        if (!res.ok || !res.body) {
          const payload = await res.json().catch(() => null);
          setState({
            phase: "error",
            question: text,
            message: payload?.error ?? "התשובה לא נוצרה.",
          });
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let answer = "";

        /* Server-sent events arrive split across chunks at arbitrary
           points, so the buffer is drained only on complete frames. */
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const frames = buffer.split("\n\n");
          buffer = frames.pop() ?? "";
          for (const frame of frames) {
            const line = frame.trim();
            if (!line.startsWith("data:")) continue;
            let payload: { type?: string; text?: string; message?: string };
            try {
              payload = JSON.parse(line.slice(5).trim());
            } catch {
              continue;
            }
            if (payload.type === "delta" && payload.text) {
              answer += payload.text;
              setState({ phase: "asking", question: text, answer });
            } else if (payload.type === "error") {
              setState({
                phase: "error",
                question: text,
                message: payload.message ?? "התשובה נקטעה.",
              });
              return;
            }
          }
        }

        setState({ phase: "done", question: text, answer });
      } catch {
        setState({
          phase: "error",
          question: text,
          message: "התשובה נקטעה. אפשר לנסות שוב.",
        });
      } finally {
        inFlight.current = false;
      }
    },
    [checked],
  );

  if (!checked) return null;

  const busy = state.phase === "asking";

  return (
    <section className="read-block">
      <h3>
        לשאול על הגרף
        <span className="read-check-sym num" dir="ltr">
          {checked.ticker}
        </span>
      </h3>
      <p className="read-check-note">
        התשובות נשענות אך ורק על מה שנמדד בעמוד הזה — הרמות שאומתו מול הנרות,
        התצפיות שהתכנסו, קריאת המחזור ושיעורי הבסיס. שאלה שדורשת מספר שלא
        נמדד תיענה בכך שהוא לא נמדד.
      </p>

      <div className="ask-suggestions">
        {CHART_QUESTIONS.map((q) => (
          <button
            key={q}
            type="button"
            className="ask-chip"
            disabled={busy}
            onClick={() => ask(q)}
          >
            {q}
          </button>
        ))}
      </div>

      <form
        className="ask-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(draft);
          setDraft("");
        }}
      >
        <input
          className="ask-input"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="לשאול משהו אחר על הגרף הזה"
          disabled={busy}
          aria-label="שאלה על הגרף"
        />
        <button type="submit" className="btn btn-primary" disabled={busy || !draft.trim()}>
          {busy ? "כותב…" : "לשאול"}
        </button>
      </form>

      {state.phase !== "idle" && (
        <div className="ask-answer">
          <p className="ask-question">{state.question}</p>
          {state.phase === "error" ? (
            <p className="ask-error">{state.message}</p>
          ) : (
            <p className="ask-text">
              {state.answer}
              {busy && <span className="ask-caret" aria-hidden="true" />}
            </p>
          )}
        </div>
      )}

      {/* The private build's answer may state a direction, so the public
          sentence here would be describing a different box. What does not
          change is the half that is still true: the answer comes from the
          counted block, and it is not an entry, a stop or a size. */}
      {isPrivateBuild() ? (
        <p className="ask-disclaimer">
          התשובה יכולה לאמר לאיזה כיוון הרשומה נוטה, והכיוון הזה חושב בקוד
          משיעורי הבסיס של הנייר עצמו ומגיע עם מה שיפריך אותו. אין כאן נקודת
          כניסה, מחיר יעד, סטופ או גודל פוזיציה — ואין כאן המלצה. ההחלטה שלך.
        </p>
      ) : (
        <p className="ask-disclaimer">
          זו אינה המלצה ואינה ייעוץ השקעות. האתר לא ייתן נקודת כניסה, מחיר יעד
          או סטופ — לשאלה ״איפה להיכנס״ יש תשובה אחת שנשענת על מדידה, והיא מה
          האירוע הנצפה שאפשר להמתין לו וכמה פעמים הוא קרה כאן בעבר.
        </p>
      )}
    </section>
  );
}
