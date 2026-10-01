"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type { ChartRead } from "@/lib/analysis/chart-reader";

/**
 * Upload a chart, get it read back.
 *
 * Three ways in, because the natural gesture differs by where the picture
 * came from: a file from the disk, a drop from another window, and a paste
 * from the clipboard — which is what anyone who just pressed the snipping
 * tool is going to try first, and the one most tools forget.
 *
 * The image is held as a data URL for the preview and sent as bare base64,
 * which is what the API wants. It is never uploaded anywhere else and never
 * stored.
 */

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 4.5 * 1024 * 1024;

type State =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "done"; read: ChartRead }
  | { phase: "error"; message: string };

const TREND_LABEL: Record<ChartRead["trend"], string> = {
  uptrend: "מגמת עלייה",
  downtrend: "מגמת ירידה",
  range: "טווח",
  unclear: "לא חד־משמעי",
};

const CONFIDENCE_LABEL: Record<ChartRead["confidence"], string> = {
  high: "ביטחון גבוה",
  medium: "ביטחון בינוני",
  low: "ביטחון נמוך",
};

export function ChartReader() {
  const [preview, setPreview] = useState<string | null>(null);
  const [context, setContext] = useState("");
  const [state, setState] = useState<State>({ phase: "idle" });
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const accept = useCallback((file: File | null | undefined) => {
    if (!file) return;
    if (!ACCEPT.split(",").includes(file.type)) {
      setState({ phase: "error", message: "אפשר להעלות PNG, JPEG או WebP." });
      return;
    }
    if (file.size > MAX_BYTES) {
      setState({ phase: "error", message: "הקובץ גדול מדי. עד כ־4.5MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setPreview(String(reader.result));
      setState({ phase: "idle" });
    };
    reader.readAsDataURL(file);
  }, []);

  const run = useCallback(async () => {
    if (!preview) return;
    setState({ phase: "reading" });

    /* The preview is a data URL; the API wants the payload on its own. */
    const [header, data] = preview.split(",");
    const mimeType = header.match(/data:([^;]+)/)?.[1] ?? "image/png";

    try {
      const res = await fetch("/api/chart-read", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mimeType, data, context }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setState({ phase: "error", message: payload.error ?? "הקריאה נכשלה." });
        return;
      }
      setState({ phase: "done", read: payload.read });
    } catch {
      setState({ phase: "error", message: "אין חיבור לשרת." });
    }
  }, [preview, context]);

  return (
    <div
      className="chart-reader"
      onPaste={(event) => {
        const file = [...event.clipboardData.items]
          .find((item) => item.type.startsWith("image/"))
          ?.getAsFile();
        if (file) accept(file);
      }}
    >
      <div
        className="reader-drop"
        data-dragging={dragging ? "true" : undefined}
        data-has-image={preview ? "true" : undefined}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          accept(event.dataTransfer.files?.[0]);
        }}
      >
        {preview ? (
          <Image
            src={preview}
            alt="הגרף שהועלה"
            className="reader-preview"
            width={1200}
            height={700}
            unoptimized
          />
        ) : (
          <div className="reader-empty">
            <strong>גררו צילום מסך של גרף לכאן</strong>
            <span>או הדביקו מהלוח · PNG, JPEG, WebP · עד 4.5MB</span>
            <button type="button" className="btn-primary" onClick={() => input.current?.click()}>
              בחירת קובץ
            </button>
          </div>
        )}

        <input
          ref={input}
          type="file"
          accept={ACCEPT}
          className="sr-only"
          onChange={(event) => accept(event.target.files?.[0])}
        />
      </div>

      {preview && (
        <div className="reader-actions">
          <label className="reader-context">
            <span>הקשר, אם יש (לא חובה)</span>
            <input
              type="text"
              value={context}
              maxLength={200}
              placeholder="למשל: NVDA, יומי, אחרי הדוח"
              onChange={(event) => setContext(event.target.value)}
            />
          </label>

          <div className="reader-buttons">
            <button
              type="button"
              className="btn-primary"
              onClick={run}
              disabled={state.phase === "reading"}
            >
              {state.phase === "reading" ? "קורא את הגרף…" : "לקריאת הגרף"}
            </button>
            <button
              type="button"
              className="reader-clear"
              onClick={() => {
                setPreview(null);
                setContext("");
                setState({ phase: "idle" });
              }}
            >
              ניקוי
            </button>
          </div>
        </div>
      )}

      {state.phase === "error" && <p className="reader-error">{state.message}</p>}

      {state.phase === "done" && <ChartReadView read={state.read} />}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <section className="read-block" data-tone={tone}>
      <h3>{title}</h3>
      <ul>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

function ChartReadView({ read }: { read: ChartRead }) {
  return (
    <div className="chart-read">
      <header className="read-head">
        <div>
          <span className="micro-label" dir="ltr">
            THE READ
          </span>
          <h2>{read.instrument ?? "נייר לא מזוהה בתמונה"}</h2>
          <p className="read-meta">
            {TREND_LABEL[read.trend] ?? read.trend}
            {read.timeframe ? ` · ${read.timeframe}` : ""}
          </p>
        </div>
        <span className="read-confidence" data-level={read.confidence}>
          {CONFIDENCE_LABEL[read.confidence] ?? read.confidence}
          <small>{read.confidenceReason}</small>
        </span>
      </header>

      <p className="read-summary">{read.summary}</p>

      <section className="read-block">
        <h3>המבנה</h3>
        <p>{read.structure}</p>
        {read.phase && <p className="read-phase">{read.phase}</p>}
      </section>

      {read.levels.length > 0 && (
        <section className="read-block">
          <h3>רמות שנקראות בגרף</h3>
          <div className="read-levels">
            {read.levels.map((level) => (
              <div className="read-level" key={`${level.kind}-${level.price}`}>
                <b className="num" dir="ltr">
                  {level.price}
                </b>
                <span>
                  {level.kind === "support"
                    ? "תמיכה"
                    : level.kind === "resistance"
                      ? "התנגדות"
                      : "ציר"}
                  {level.touches ? ` · ${level.touches} נגיעות` : ""}
                </span>
                <small>{level.note}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {read.volume && (
        <section className="read-block">
          <h3>ווליום</h3>
          <p>{read.volume}</p>
        </section>
      )}

      <List title="אינדיקטורים בתמונה" items={read.indicators} />
      <List title="איפה הראיות סותרות" items={read.conflicts} tone="conflict" />
      <List title="מה יפריך את הקריאה" items={read.invalidation} tone="invalidation" />
      <List title="מה התמונה לא יכולה להכריע" items={read.notVisible} tone="missing" />

      <p className="data-caption">
        הקריאה נוצרה על ידי מודל שפה מתוך התמונה בלבד. היא מתארת את מה שנראה
        בגרף ואינה תחזית, אינה המלצה ואינה מתחשבת בנתונים שאינם בתמונה —
        דוחות, הקשר מאקרו או אירועים שעוד לא קרו.
      </p>
    </div>
  );
}
