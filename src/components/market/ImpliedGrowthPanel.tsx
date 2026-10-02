import Link from "next/link";
import { CompanyMark } from "@/components/CompanyMark";
import { Section } from "@/components/ui";
import { demandGap, impliedGrowth } from "@/lib/metrics/implied-growth";

/**
 * The five-year question, asked the only way this site can answer it.
 *
 * A forecast of where these companies trade in 2031 would be a guess with
 * a decimal point on it. The inverse question is arithmetic: what does the
 * price already assume, and how does that compare with what the business
 * has actually done? One is prophecy and the other is a reading of the
 * quote, and only the second belongs here.
 *
 * Every column is checkable. The multiple is reported, the terminal
 * multiple is stated rather than hidden, the horizon is stated, and the
 * delivered figure is the company's own three-year revenue CAGR from its
 * filings. A reader who disagrees with the terminal multiple can redo the
 * sum — which is the point of printing it.
 *
 * No row is called cheap or expensive. A price demanding less than the
 * business has delivered is not automatically a bargain, and more is not
 * automatically a warning: both depend on whether the delivery continues,
 * which is the one thing nobody here can measure (rule 8).
 */

export type GrowthRow = {
  ticker: string;
  name: string;
  /** Trailing P/E from the filings. */
  pe: number | null;
  /** Three-year revenue CAGR from the filings. */
  delivered: number | null;
};

/* A mature, profitable business has historically been paid somewhere
   around the high teens for its earnings. Eighteen is a convention, not a
   measurement, which is exactly why it is printed on the page instead of
   buried here — the reader can disagree and redo the arithmetic. */
const TERMINAL = 18;
const YEARS = 5;

const pct = (n: number) => `${n >= 0 ? "" : "−"}${Math.abs(n).toFixed(1)}%`;

export function ImpliedGrowthPanel({ rows }: { rows: GrowthRow[] }) {
  const computed = rows
    .map((row) => {
      const implied = impliedGrowth(row.pe, TERMINAL, YEARS);
      return { ...row, implied, gap: demandGap(implied, row.delivered) };
    })
    /* A company with no earnings has no multiple to invert, and a row of
       dashes teaches nothing. They are named underneath instead. */
    .filter((row) => row.implied !== null);

  const absent = rows.filter((row) => impliedGrowth(row.pe, TERMINAL, YEARS) === null);

  if (computed.length === 0) return null;

  const ordered = [...computed].sort(
    (a, b) => (b.implied!.annualPercent ?? 0) - (a.implied!.annualPercent ?? 0),
  );

  return (
    <Section
      eyebrow="חמש שנים"
      title="מה המחיר כבר מניח"
      description="לא תחזית לאן המניה תגיע — חשבון של מה שהמחיר של היום כבר דורש. אם בעוד חמש שנים השוק ישלם מכפיל רגיל, בכמה הרווחים צריכים לגדול בכל שנה רק כדי שהמחיר יישאר במקום."
    >
      <div className="implied-table">
        <div className="implied-head">
          <span>חברה</span>
          <span>מכפיל היום</span>
          <span>הצמיחה שהמחיר דורש</span>
          <span>מה החברה סיפקה</span>
          <span>הפרש</span>
        </div>

        {ordered.map((row) => (
          <Link
            key={row.ticker}
            href={`/company/${row.ticker}`}
            className="implied-row"
          >
            <span className="implied-company">
              <CompanyMark ticker={row.ticker} size="sm" />
              <span>
                <strong dir="ltr">{row.name}</strong>
                <small className="num" dir="ltr">
                  {row.ticker}
                </small>
              </span>
            </span>
            <span className="num" dir="ltr">
              {row.pe!.toFixed(1)}x
            </span>
            <span className="num implied-need" dir="ltr">
              {pct(row.implied!.annualPercent)}
            </span>
            <span className="num" dir="ltr">
              {row.delivered === null ? "—" : pct(row.delivered)}
            </span>
            <span className="num" dir="ltr">
              {row.gap === null
                ? "—"
                : `${row.gap >= 0 ? "+" : "−"}${Math.abs(row.gap).toFixed(1)}`}
            </span>
          </Link>
        ))}
      </div>

      {/* The assumption, beside the result rather than under the code. */}
      <p className="data-caption">
        ההנחות, במפורש: מכפיל יציאה של{" "}
        <span className="num" dir="ltr">
          {TERMINAL}x
        </span>{" "}
        בעוד <span className="num">{YEARS}</span> שנים, ומחיר שנשאר במקום.
        הנוסחה היא{" "}
        <span className="num" dir="ltr">
          g = (P/E ÷ {TERMINAL})^(1/{YEARS}) − 1
        </span>{" "}
        — הרווח הנוכחי מצטמצם משני האגפים, ולכן אין כאן צורך לדעת כמה החברה
        מרוויחה בדולרים. &quot;מה שסופק&quot; הוא קצב צמיחת ההכנסות התלת-שנתי
        מהדוחות. הפרש חיובי אומר שהמחיר דורש יותר ממה שהעסק עשה עד היום — לא
        שהוא יקר, כי זה תלוי אם הקצב נמשך, וזה בדיוק מה שאי אפשר למדוד כאן.
        {absent.length > 0 && (
          <>
            {" "}
            ללא מכפיל חיובי בדוחות, ולכן מחוץ לטבלה:{" "}
            <span className="num" dir="ltr">
              {absent.map((a) => a.ticker).join(" · ")}
            </span>
            .
          </>
        )}
      </p>
    </Section>
  );
}
