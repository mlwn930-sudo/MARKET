import {
  getMacroBoard,
  instrumentsOfKind,
  type Instrument,
} from "@/lib/sources/macro";
import { getSeries, FRED_SERIES, type FredSeriesId } from "@/lib/sources/fred";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { directionClass, fmtPercent, fmtRelative } from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "מאקרו",
  description:
    "מדדים עולמיים, תשואות אג״ח, סחורות ומטבעות — ומה כל אחד מהם אומר על תמחור מניות.",
};

/** The value, formatted by what it is. A yield printed with a dollar sign
 *  and an index printed with two decimals are both wrong in the same way. */
function value(instrument: Instrument): string {
  if (instrument.value === null) return "—";
  switch (instrument.unit) {
    case "%":
      return `${instrument.value.toFixed(2)}%`;
    case "$":
      return `$${instrument.value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
    case "₪":
      return `₪${instrument.value.toFixed(3)}`;
    default:
      return instrument.value.toLocaleString("en-US", {
        maximumFractionDigits: 2,
      });
  }
}

function Card({ instrument }: { instrument: Instrument }) {
  const missing = instrument.value === null;

  // A rate moves in points, not percent: "the ten-year rose 2.4%" is
  // meaningless, "rose 12 basis points" is the sentence.
  const move =
    instrument.kind === "rate" && instrument.change !== null
      ? `${instrument.change > 0 ? "+" : "−"}${Math.abs(instrument.change * 100).toFixed(0)} נ.ב.`
      : fmtPercent(instrument.changePercent);

  return (
    <article className="surface flex flex-col p-4">
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-[13px] text-ink">{instrument.name}</h3>
        <span className="num text-[10px] text-ink-ghost" dir="ltr">
          {instrument.symbol}
        </span>
      </div>

      {missing ? (
        <p className="mt-3 text-[12px] text-ink-faint">הנתון לא התקבל כרגע.</p>
      ) : (
        <>
          <div className="num mt-2 text-[22px] text-ink">{value(instrument)}</div>
          <div
            className={`num text-[12px] ${directionClass(instrument.changePercent)}`}
          >
            {move}
          </div>
        </>
      )}

      <p className="mt-3 border-t border-line pt-2 text-[11px] leading-relaxed text-ink-faint">
        {instrument.note}
      </p>
    </article>
  );
}

const FRED_WANTED: FredSeriesId[] = [
  "FEDFUNDS",
  "CPIAUCSL",
  "UNRATE",
  "T10Y2Y",
];

export default async function MacroPage() {
  const [board, fred] = await Promise.all([
    getMacroBoard(),
    Promise.all(
      FRED_WANTED.map((id) => getSeries(id, 24).catch(() => null)),
    ),
  ]);

  const { instruments } = board;

  const groups: { title: string; description: string; items: Instrument[] }[] = [
    {
      title: "מדדים",
      description:
        "המדדים עצמם, לא תעודות הסל שעוקבות אחריהם — כך שהמספר הוא המדד ולא מכשיר שמנסה לחקות אותו.",
      items: instrumentsOfKind(instruments, "index"),
    },
    {
      title: "תנודתיות",
      description:
        "מדד אחד, והוא זה שמספר מה השוק חושב שיקרה ולא מה כבר קרה.",
      items: instrumentsOfKind(instruments, "vol"),
    },
    {
      title: "מחיר הכסף",
      description:
        "תשואות האג״ח הממשלתי. זה המספר שכל היוון של מניה נשען עליו — כשהוא עולה, אותו תזרים עתידי שווה פחות היום, וזה נכון לכל מניה בשוק בלי קשר לביצועי החברה.",
      items: instrumentsOfKind(instruments, "rate"),
    },
    {
      title: "סחורות",
      description: "עלויות הקלט של החברות, ובמקרה של הזהב — מדד פחד.",
      items: instrumentsOfKind(instruments, "commodity"),
    },
    {
      title: "מטבעות",
      description:
        "למשקיע ישראלי שמחזיק מניות אמריקאיות, שער הדולר הוא חלק מהתשואה בדיוק כמו המחיר של המניה.",
      items: instrumentsOfKind(instruments, "currency"),
    },
  ];

  const available = fred.filter((series) => series !== null);

  return (
    <Page tint="#06b6d4" width="wide">
      <Hero
        eyebrow="מאקרו"
        title="מה קורה מסביב למניות"
        lede="ריבית, אינפלציה, תנודתיות, נפט ומטבע קובעים חלק גדול מתנועת המניות — ולא אחד מהם מופיע בדוח של חברה. כל מכשיר כאן מוצג עם מה שהוא בפועל אומר על תמחור מניות, ולא רק עם המספר."
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        עודכן {fmtRelative(new Date(board.builtAt))} · מחירי שוק בהשהיה, לא
        בזמן אמת
      </p>

      {groups.map((group) => (
        <Section
          key={group.title}
          eyebrow="מאקרו"
          title={group.title}
          description={group.description}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {group.items.map((instrument) => (
              <Card key={instrument.symbol} instrument={instrument} />
            ))}
          </div>
        </Section>
      ))}

      {/* The official series, when a key exists to read them with. */}
      <Section
        eyebrow="נתונים רשמיים"
        title="אינפלציה, תעסוקה וריבית הפד"
        description="אלה אינם מחירי שוק אלא פרסומים רשמיים של הפד ושל הלשכה לסטטיסטיקה, ומגיעים מ-FRED."
      >
        {available.length === 0 ? (
          <div className="surface p-5">
            <p className="text-[13px] text-ink">
              הסדרות הרשמיות אינן זמינות בסביבה הזו.
            </p>
            <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
              הן דורשות מפתח <span className="num">FRED_API_KEY</span>, שאינו
              מוגדר. המפתח חינמי ומונפק מיידית ב-
              <span className="num">fredaccount.stlouisfed.org/apikeys</span>.
              עד אז המספרים למעלה — שהם מחירי שוק — עובדים כרגיל, ואינם
              מוחלפים בהערכה של הסדרות החסרות.
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {available.map((series) => {
              const latest = series!.latest;
              const previous = series!.history.at(-2) ?? null;
              const delta =
                latest && previous ? latest.value - previous.value : null;

              return (
                <article key={series!.id} className="surface p-4">
                  <h3 className="text-[13px] text-ink">
                    {FRED_SERIES[series!.id as FredSeriesId]}
                  </h3>
                  <div className="num mt-2 text-[22px] text-ink">
                    {latest ? latest.value.toFixed(2) : "—"}
                  </div>
                  <div className="num text-[12px] text-ink-muted">
                    {delta === null
                      ? "—"
                      : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)} מהפרסום הקודם`}
                  </div>
                  <p className="mt-3 border-t border-line pt-2 text-[10px] text-ink-ghost">
                    נכון ל-{latest?.date ?? "—"} · FRED
                  </p>
                </article>
              );
            })}
          </div>
        )}
      </Section>

      <Disclaimer extra="הקשרים המתוארים כאן בין מאקרו למניות הם מנגנונים מוכרים, לא חוקי טבע — ריבית שעולה לא מורידה כל מניה, והיא כן משנה את החשבון של כולן." />
    </Page>
  );
}
