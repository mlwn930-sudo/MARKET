"use client";

import Image from "next/image";
import { useCallback, useRef, useState } from "react";
import type {
  ChartControl,
  ChartRead,
  ChartWatch,
} from "@/lib/analysis/chart-reader";
import type { Corroboration } from "@/lib/analysis/chart-corroborate";
import { ChartScenarios } from "@/components/market/ChartScenarios";
import { TapePanel } from "@/components/market/TapePanel";
import { SetupPanel } from "@/components/market/SetupPanel";

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
 *
 * The read below is laid out in the order a desk delivers one: what it is,
 * the one paragraph, the horizon, the pattern and its name, who is working
 * the tape, then the structure and the levels that evidence it, then the
 * observable events that would settle it — and last the three fields that
 * keep it from being advice. Those three are rendered whether or not the
 * model filled them, because a discipline field that disappears when it is
 * empty is a discipline field that can be skipped by saying nothing.
 */

const ACCEPT = "image/png,image/jpeg,image/webp";
const MAX_BYTES = 4.5 * 1024 * 1024;

type State =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "done"; read: ChartRead; checked: Corroboration | null }
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

/* Who is working the tape. Deliberately behavioural rather than
   directional: "buyers absorbing supply" is something a chart can show,
   "going up" is something only the future can. */
const CONTROL_LABEL: Record<ChartControl["side"], string> = {
  buyers: "קונים סופגים היצע",
  sellers: "מוכרים מחלקים סחורה",
  balance: "איזון בין הצדדים",
  unclear: "לא חד־משמעי",
};

const WATCH_LABEL: Record<ChartWatch["direction"], string> = {
  confirms: "יאשר את המבנה",
  breaks: "ישבור את המבנה",
  neutral: "לא יכריע",
};

const LEVEL_LABEL: Record<ChartRead["levels"][number]["kind"], string> = {
  support: "תמיכה",
  resistance: "התנגדות",
  pivot: "ציר",
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
      setState({
        phase: "done",
        read: payload.read,
        checked: payload.corroboration ?? null,
      });
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

      {state.phase === "done" && (
        <ChartReadView read={state.read} checked={state.checked} />
      )}
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone?: string }) {
  if (!items.length) return null;
  return (
    <section className="read-block" data-tone={tone}>
      <h3>{title}</h3>
      <ul>
        {items.map((item, i) => (
          <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
        ))}
      </ul>
    </section>
  );
}

/**
 * One of the three fields that keep the read from being advice.
 *
 * It renders even when the model left it empty, and then it says what the
 * silence costs. That is the point: a conflicts list that vanishes when
 * nothing was found looks like a chart with no counter-evidence, which is
 * almost never what it is.
 */
function Discipline({
  title,
  tone,
  items,
  silence,
}: {
  title: string;
  tone: "conflict" | "invalidation" | "missing";
  items: string[];
  silence: string;
}) {
  return (
    <section className="read-discipline-cell read-block" data-tone={tone}>
      <h3>{title}</h3>
      {items.length > 0 ? (
        <ul>
          {items.map((item, i) => (
            <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="read-silence">{silence}</p>
      )}
    </section>
  );
}

function ChartReadView({
  read,
  checked,
}: {
  read: ChartRead;
  checked: Corroboration | null;
}) {
  const { pattern, control, horizon } = read;

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

      {horizon && (
        <div className="read-horizon">
          <span className="micro-label" dir="ltr">
            HORIZON
          </span>
          <b>{horizon.label}</b>
          {horizon.why && <small>{horizon.why}</small>}
        </div>
      )}

      {pattern && (
        <section className="read-block read-pattern">
          <h3>הדפוס</h3>
          <div className="read-pattern-head">
            <strong>{pattern.name}</strong>
            {pattern.term && (
              <code className="read-term" dir="ltr">
                {pattern.term}
              </code>
            )}
          </div>

          <dl className="read-pattern-grid">
            {pattern.maturity && (
              <div>
                <dt>כמה ממנו מצויר</dt>
                <dd>{pattern.maturity}</dd>
              </div>
            )}
            {pattern.evidence && (
              <div>
                <dt>הסימן בגרף</dt>
                <dd>{pattern.evidence}</dd>
              </div>
            )}
            {pattern.lookalike && (
              <div>
                <dt>ממה להבדיל אותו</dt>
                <dd>{pattern.lookalike}</dd>
              </div>
            )}
          </dl>

          {pattern.tendency && (
            <div className="read-tendency">
              <span className="micro-label" dir="ltr">
                BASE BEHAVIOUR
              </span>
              <p>{pattern.tendency}</p>
              <small>
                נטיית הדפוס הזה כמחלקה, כפי שהיא מתוארת בספרות הטכנית. לא
                מדידה על הגרף שלפניכם, לא סטטיסטיקה שחושבה כאן, ולא תחזית.
              </small>
            </div>
          )}
        </section>
      )}

      {/* The scale alone is worth drawing once a side is named, so this does
          not wait for the sentence. What it does wait for is anything at
          all: an all-empty control block would render three grey stops that
          claim nothing. */}
      {(control.side !== "unclear" || control.reading || control.evidence.length > 0) && (
        <section className="read-block read-control">
          <h3>מי שולט בסחר</h3>

          <div
            className="read-control-scale"
            data-side={control.side}
            role="img"
            aria-label={`שליטה בסחר: ${CONTROL_LABEL[control.side]}`}
          >
            <span data-stop="buyers">קונים</span>
            <span data-stop="balance">איזון</span>
            <span data-stop="sellers">מוכרים</span>
          </div>

          <p className="read-control-reading">
            <b>{CONTROL_LABEL[control.side]}.</b>
            {control.reading ? ` ${control.reading}` : ""}
          </p>

          {control.evidence.length > 0 && (
            <>
              <h4 className="read-sub">הסימנים שמאחורי הקריאה</h4>
              <ul>
                {control.evidence.map((item, i) => (
                  <li key={`${i}-${item.slice(0, 24)}`}>{item}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* The structure sentence goes through the scrub like everything else,
          and an advisory-only one comes back empty. A heading with nothing
          under it is an unfinished thought, so the section waits for one of
          its two lines, and the phase line carries it alone when the
          structure sentence did not survive. */}
      {(read.structure || read.phase) && (
        <section className="read-block">
          <h3>המבנה</h3>
          {read.structure && <p>{read.structure}</p>}
          {read.phase && <p className="read-phase">{read.phase}</p>}
        </section>
      )}

      {read.levels.length > 0 && (
        <section className="read-block">
          <h3>רמות שנקראות בגרף</h3>
          <div className="read-levels">
            {read.levels.map((level, i) => (
              <div className="read-level" key={`${i}-${level.kind}-${level.price}`}>
                <b className="num" dir="ltr">
                  {level.price}
                </b>
                <span>
                  {LEVEL_LABEL[level.kind] ?? level.kind}
                  {level.touches ? ` · ${level.touches} נגיעות` : ""}
                </span>
                <small>{level.note}</small>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* First, because it is the summary the panels below are the
          evidence for — and a summary printed after its evidence is a
          footnote. */}
      {checked && <SetupPanel setup={checked.setup} />}

      {checked && <Corroborated checked={checked} />}

      {/* Straight after the levels check, and for the same reason it sits
          beside it: both are the site answering a question the picture
          cannot. The levels block asks whether the lines are really there;
          this asks what this instrument has done after the state it is in,
          counted rather than remembered. */}
      {checked && (
        <ChartScenarios read={checked.baseRates} ticker={checked.ticker} />
      )}

      {/* The measured volume, before the model's impression of it and not
          after. A model looking at a screenshot can see that one bar in the
          strip is taller than its neighbours; it cannot say whether that is
          the ninety-eighth percentile of the year or an ordinary Tuesday,
          because that needs the series. Putting the counted reading second
          would invite a reader to treat the prose as the finding and the
          numbers as a footnote on it. */}
      {checked && (
        <TapePanel
          tape={checked.tape}
          rates={checked.baseRates}
          ticker={checked.ticker}
          lastClose={checked.lastClose}
        />
      )}

      {read.volume && (
        <section className="read-block">
          <h3>מה שנראה בתמונה</h3>
          <p className="read-check-note">
            התרשמות המודל מרצועת המחזור בצילום. אין מאחוריה דירוג ואין מדגם —
            הפאנל שמעליה הוא המדידה.
          </p>
          <p>{read.volume}</p>
        </section>
      )}

      <List title="אינדיקטורים בתמונה" items={read.indicators} />

      {read.watch.length > 0 && (
        <section className="read-block">
          <h3>מה יסגור את השאלה</h3>
          <p className="read-watch-note">
            אירועים שאפשר להבחין בהם, לא פעולות. כל שורה כתובה כך שבעוד שבוע
            אפשר לומר עליה &quot;זה קרה&quot; או &quot;זה לא קרה&quot;.
          </p>
          <ol className="read-watch">
            {read.watch.map((item, i) => (
              <li key={`${i}-${item.event.slice(0, 24)}`} data-direction={item.direction}>
                <span className="read-watch-dir">{WATCH_LABEL[item.direction]}</span>
                <strong>{item.event}</strong>
                {item.means && <p>{item.means}</p>}
              </li>
            ))}
          </ol>
        </section>
      )}

      <section className="read-discipline">
        <h3 className="read-discipline-title">משמעת הקריאה</h3>
        <p className="read-discipline-note">
          שלושת השדות האלה הם מה שמפריד קריאה מהבטחה. הם נכתבים גם כשהם לא
          נוחים, ומוצגים כאן גם כשהקריאה השאירה אותם ריקים.
        </p>
        <div className="read-discipline-grid">
          <Discipline
            title="איפה הראיות סותרות"
            tone="conflict"
            items={read.conflicts}
            silence="הקריאה לא מצאה סתירה בגרף. גרף שאין בו שום דבר שמושך לכיוון השני הוא בדרך כלל גרף שלא נקרא עד הסוף."
          />
          <Discipline
            title="מה יפריך את הקריאה"
            tone="invalidation"
            items={read.invalidation}
            /* The second half is a claim about what the code did, so it is
               printed only when the code actually did it. A read that came
               back "medium" with an empty invalidation list was never
               capped, and the page used to tell the reader it was. */
            silence={
              read.confidenceCapped
                ? "הקריאה לא נקבה במה שהיה מפריך אותה. קריאה שאי אפשר להפריך אינה קריאה — ורמת הביטחון למעלה הוגבלה בגלל זה."
                : "הקריאה לא נקבה במה שהיה מפריך אותה. קריאה שאי אפשר להפריך אינה קריאה, וכדאי לקרוא את כל מה שלמעלה בהסתייגות הזאת."
            }
          />
          <Discipline
            title="מה התמונה לא יכולה להכריע"
            tone="missing"
            items={read.notVisible}
            silence="הקריאה לא ציינה מה חסר בתמונה. חסרים בה בכל מקרה דוחות, חדשות, הקשר מאקרו וכל מה שקרה אחרי הצילום."
          />
        </div>
      </section>

      {read.redacted > 0 && (
        <p className="read-redacted">
          <span className="num" dir="ltr">
            {read.redacted}
          </span>{" "}
          {read.redacted === 1 ? "משפט הוסר" : "משפטים הוסרו"} מהקריאה הזאת
          אוטומטית, מפני שהשתמשו באוצר המילים של פעולה — נקודת כניסה, יעד, סטופ
          או תזמון. הסינון מעדיף למחוק משפט תמים מלפרסם המלצה, והאתר לא מוסר
          המלצות גם כשהמודל מציע אותן.
        </p>
      )}

      {read.fabricated > 0 && (
        <p className="read-redacted">
          <span className="num" dir="ltr">
            {read.fabricated}
          </span>{" "}
          {read.fabricated === 1 ? "משפט הוסר" : "משפטים הוסרו"} מנטיית הדפוס,
          בגלל אחוז, שכיחות או מדגם שלא נמדדו כאן. נטיית דפוס היא התנהגות
          המחלקה כפי שהיא מתוארת בספרות הטכנית — לא מדידה על הגרף שלפניכם ולא
          סטטיסטיקה שחושבה כאן, ומספר שאין לו מקור לא מוצג באתר הזה.
        </p>
      )}

      <p className="data-caption">
        הקריאה נוצרה על ידי מודל שפה מתוך התמונה בלבד. היא מתארת את מה שנראה
        בגרף ואינה תחזית, אינה המלצה ואינה מתחשבת בנתונים שאינם בתמונה —
        דוחות, הקשר מאקרו או אירועים שעוד לא קרו.
      </p>
    </div>
  );
}

/**
 * The read, tested against real candles.
 *
 * Everything above this comes from pixels: the model read a number off an
 * axis and reported a level. Whether that level exists is a different
 * question, and it is the one question this site is equipped to answer —
 * it holds the actual closes, and metrics/levels.ts finds the bands price
 * genuinely turned at from swing pivots rather than from a drawing.
 *
 * It does not grade the read. A level the candles do not show is reported
 * as unconfirmed, not wrong: a screenshot can be an index, a pair, an
 * intraday window or a timeframe outside what this site carries, and in
 * every one of those cases the absence is about the data here and not
 * about the picture. Rule 8 — the reader gets the disagreement, not a
 * verdict on it.
 */
function Corroborated({ checked }: { checked: Corroboration }) {
  const pct = (n: number) => `${n.toFixed(2)}%`;

  return (
    <section className="read-block read-check">
      <h3>
        מול הנתונים של האתר
        <span className="read-check-sym num" dir="ltr">
          {checked.ticker}
        </span>
      </h3>
      <p className="read-check-note">
        הרמות שלמעלה נקראו מהתמונה. כאן הן נבדקות מול{" "}
        <span className="num">{checked.candleCount}</span> נרות אמיתיים של{" "}
        <span className="num" dir="ltr">{checked.ticker}</span>, שסגירתם
        האחרונה <span className="num" dir="ltr">{checked.lastClose.toFixed(2)}</span>.
        רמה שהנרות לא מאשרים אינה שגויה — היא לא אושרה, וזה הבדל שחשוב
        לשמור עליו: צילום יכול להיות של מדד, של צמד מט״ח או של טווח שהאתר
        לא מחזיק.
      </p>

      <div className="read-check-rows">
        {checked.levels.map((level, i) => (
          <div
            key={`${i}-${level.read}`}
            className={`read-check-row ${level.matched !== null ? "is-ok" : "is-open"}`}
          >
            <b className="num" dir="ltr">
              {Number.isFinite(level.read) ? level.read.toFixed(2) : "—"}
            </b>
            {level.matched !== null ? (
              <span>
                מאושרת — הנרות מראים רמה ב־
                <span className="num" dir="ltr">{level.matched.toFixed(2)}</span>
                {level.touches ? (
                  <>
                    {" "}עם <span className="num">{level.touches}</span> נגיעות
                  </>
                ) : null}
                {level.driftPercent !== null && (
                  <>
                    , פער <span className="num" dir="ltr">{pct(level.driftPercent)}</span>
                  </>
                )}
              </span>
            ) : (
              <span>לא אושרה בנרות שהאתר מחזיק</span>
            )}
          </div>
        ))}
      </div>

      {checked.missedByRead.length > 0 && (
        <div className="read-check-extra">
          <strong>רמות שהנרות מראים והקריאה לא הזכירה</strong>
          <p>
            {checked.missedByRead
              .map(
                (b) =>
                  `${b.price.toFixed(2)} (${b.touches} נגיעות)`,
              )
              .join(" · ")}
          </p>
          <small>
            לא בהכרח החמצה: צילום שלא חוזר מספיק אחורה פשוט לא מראה אותן.
          </small>
        </div>
      )}
    </section>
  );
}
