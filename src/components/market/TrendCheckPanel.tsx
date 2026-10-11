import { TREND_LABELS } from "@/lib/metrics/technical";
import type { TrendCheck } from "@/lib/analysis/chart-corroborate";

/**
 * The headline claim of any chart read, with a test attached.
 *
 * Every other claim on this page already had one. The levels are
 * matched against bands the real candles support, the volume is ranked
 * inside the instrument's own trailing year, the conditions are counted
 * over ten years — and the sentence a reader actually carries away,
 * *which way this thing is trending*, was printed as the model said it
 * and never checked.
 *
 * It is also the claim a picture is worst at. A screenshot cropped to
 * six months of a two-year decline shows a clean advance; the axis can
 * be log or linear; the window can end on a bounce. None of that is in
 * the image and all of it is in the candles.
 *
 * DISAGREEMENT IS NOT AN ACCUSATION, and the copy has to hold that
 * line. The image may be a different timeframe, a different instrument,
 * or a window the site does not carry. So both readings are named with
 * what each measured, and the reader decides which one answers their
 * question — rule 8, on the one claim where it matters most.
 */

const READ_LABEL: Record<TrendCheck["read"], string> = {
  uptrend: "מגמה עולה",
  downtrend: "מגמה יורדת",
  range: "טווח",
  unclear: "לא ברור",
};

const AGREEMENT: Record<
  TrendCheck["agreement"],
  { title: string; note: string }
> = {
  agrees: {
    title: "התמונה והנרות מסכימים",
    note: "מה שנקרא מהצילום הוא גם מה שהנרות של הנייר מראים. זה לא הופך את הקריאה לנכונה — זה אומר שהיא לא נשענת על חיתוך של התמונה.",
  },
  qualified: {
    title: "הנרות מסייגים",
    note: "הנרות לא סותרים את מה שנקרא, אבל הם לא נותנים מגמה נקייה: הממוצע הארוך והמחיר לא מצביעים לאותו כיוון. זה בדיוק המצב שצילום מראה כמגמה.",
  },
  contradicts: {
    title: "הנרות אומרים אחרת",
    note: "הקריאה מהתמונה והמדידה מהנרות לא מתארות את אותו מבנה. לפני שמכריעים — ייתכן שהצילום הוא של אופק זמן אחר, של נייר אחר, או של חלון שהאתר לא מחזיק.",
  },
  unclear: {
    title: "אין מספיק כדי להשוות",
    note: "אין די נרות כדי למדוד מגמה, או שהקריאה עצמה לא קבעה כיוון. אין כאן הסכמה ואין מחלוקת.",
  },
};

const pct = (value: number) => `${value >= 0 ? "+" : "−"}${Math.abs(value).toFixed(1)}%`;

const DIRECTION: Record<string, string> = {
  rising: "עולה",
  falling: "יורד",
  flat: "שטוח",
};

export function TrendCheckPanel({ trend }: { trend: TrendCheck }) {
  const state = AGREEMENT[trend.agreement];

  return (
    <section
      className="read-block read-check trend-check"
      data-agreement={trend.agreement}
    >
      <h3>המגמה — מה שנקרא מול מה שנמדד</h3>

      <div className="trend-sides">
        <div className="trend-side">
          <span className="trend-side-who">מהתמונה</span>
          <b>{READ_LABEL[trend.read] ?? trend.read}</b>
          <small>כפי שהמודל קרא את הצילום</small>
        </div>
        <div className="trend-side">
          <span className="trend-side-who">מהנרות</span>
          <b>
            {trend.measured
              ? TREND_LABELS[trend.measured].he
              : "אין די היסטוריה"}
          </b>
          <small>
            {trend.measured
              ? TREND_LABELS[trend.measured].note
              : "נדרשים נרות רבים יותר"}
          </small>
        </div>
      </div>

      <p className="trend-verdict">
        <strong>{state.title}.</strong> {state.note}
      </p>

      {/* The figures behind the measured side. A verdict with no numbers
          under it is the same object as the model's word — an assertion
          — and the only reason to prefer this one is that it can be
          checked. */}
      <dl className="trend-figures">
        {trend.vsAveragePercent !== null && (
          <div>
            <dt>מול ממוצע 200</dt>
            <dd className="num" dir="ltr">
              {pct(trend.vsAveragePercent)}
            </dd>
          </div>
        )}
        {trend.averageDirection && (
          <div>
            <dt>כיוון הממוצע</dt>
            <dd>{DIRECTION[trend.averageDirection] ?? trend.averageDirection}</dd>
          </div>
        )}
        {trend.fromHighPercent !== null && (
          <div>
            <dt>משיא 52 שבועות</dt>
            <dd className="num" dir="ltr">
              {pct(trend.fromHighPercent)}
            </dd>
          </div>
        )}
        {trend.fromLowPercent !== null && (
          <div>
            <dt>מתחתית 52 שבועות</dt>
            <dd className="num" dir="ltr">
              {pct(trend.fromLowPercent)}
            </dd>
          </div>
        )}
      </dl>

      {/* Weinstein's stage as the second, independent reading. It asks a
          different question from the average comparison — where in the
          cycle, rather than which way — and the two can disagree, which
          is worth seeing rather than resolving. */}
      {trend.stage.stage !== null && (
        <div className="read-check-extra">
          <strong>{trend.stage.label}</strong>
          <p>{trend.stage.note}</p>
          {trend.stage.daysInStage !== null && (
            <small>
              מחזיק כבר <span className="num">{trend.stage.daysInStage}</span>{" "}
              ימי מסחר, עד כמה שההיסטוריה שהאתר מחזיק מגיעה.
            </small>
          )}
        </div>
      )}
    </section>
  );
}
