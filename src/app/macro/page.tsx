import Link from "next/link";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import {
  getMacroBoard,
  instrumentsOfKind,
  type Instrument,
} from "@/lib/sources/macro";
import { getSeries, FRED_SERIES, type FredSeriesId } from "@/lib/sources/fred";
import {
  Disclaimer,
  ErrorState,
  Hero,
  MetricCard,
  Page,
  Section,
  SourceBadge,
} from "@/components/ui";
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
    <article className="macro-row">
      <div><h3>{instrument.name}</h3><span className="num text-xs text-ink-faint" dir="ltr">{instrument.symbol}</span></div>
      <div className="num macro-value">{missing ? "—" : value(instrument)}</div>
      <div className={"num text-sm " + directionClass(instrument.changePercent)}>{missing ? "לא זמין" : move}</div>
      <p>{instrument.note}{instrument.at && <span className="mt-1 block text-xs text-ink-faint">ציטוט: {new Date(instrument.at).toLocaleString("he-IL", { timeZone: "Asia/Jerusalem", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}</span>}</p>
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
    <Page width="wide">
      <Hero
        eyebrow="MARKET / MACRO INTELLIGENCE"
        title="העולם שמאחורי השוק."
        lede="מחיר הכסף, עלויות הייצור ושערי המטבע. לקרוא את הסביבה, ואז לחבר אותה לחברות שמושפעות ממנה."
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        עודכן {fmtRelative(new Date(board.builtAt))} · מחירי שוק בהשהיה, לא
        בזמן אמת
      </p>

      <Section eyebrow="01 / TRANSMISSION" title="מהנתון אל העסק" description="מנגנוני השפעה לבדיקה. אלה קשרים כלכליים אפשריים, לא תחזית לכיוון המניה.">
        <div className="macro-transmission">
          <article><span className="micro-label">RATES → VALUATION</span><h3>ריבית ותמחור</h3><p>תשואה גבוהה יותר משנה את שיעור ההיוון ואת עלות המימון. לבדוק רגישות תזרים, מינוף ותמחור מול הצמיחה.</p><Link href="/company/MSFT">MSFT ↗</Link><Link href="/company/AMZN">AMZN ↗</Link></article>
          <article><span className="micro-label">ENERGY → MARGINS</span><h3>נפט ומרווחים</h3><p>אותה תנועה יכולה להגדיל הכנסות של מפיקה ולהעלות עלויות של צרכנית. החשיפה תלויה בגידור ובכוח התמחור.</p><Link href="/company/CVX">CVX ↗</Link><Link href="/sectors">למפת הסקטורים ←</Link></article>
          <article><span className="micro-label">FX → RETURNS</span><h3>מטבע ותשואה</h3><p>שער הדולר משפיע על רווחי חברות בינלאומיות ועל התשואה בשקלים. זו חשיפה נוספת מעבר לשינוי במחיר המניה.</p><Link href="/portfolio">לבחינת החשיפה בתיק ←</Link><Link href="/israel">שוק תל אביב ↗</Link></article>
        </div>
      </Section>

      {groups.map((group) => (
        <Section
          key={group.title}
          eyebrow="מאקרו"
          title={group.title}
          description={group.description}
        >
          <div className="macro-rows">
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
          <ErrorState
            title="הסדרות הרשמיות אינן זמינות בסביבה הזו"
            detail="הפרסומים הרשמיים לא התקבלו. נתוני השוק למעלה מוצגים בנפרד ואינם תחליף לנתוני אינפלציה, תעסוקה או ריבית הפד."
            source="FRED"
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {available.map((series) => {
              const latest = series!.latest;
              const previous = series!.history.at(-2) ?? null;
              const delta =
                latest && previous ? latest.value - previous.value : null;

              return (
                <MetricCard
                  key={series!.id}
                  label={FRED_SERIES[series!.id as FredSeriesId]}
                  value={latest ? latest.value.toFixed(2) : "—"}
                  context={
                    delta === null
                      ? "אין פרסום קודם להשוואה"
                      : `${delta > 0 ? "+" : "−"}${Math.abs(delta).toFixed(2)} מהפרסום הקודם`
                  }
                  footer={
                    <SourceBadge source="FRED" asOf={latest?.date ?? null} />
                  }
                />
              );
            })}
          </div>
        )}
      </Section>

      <WorkflowLinks title="מהתמונה הכללית לחברה המסוימת" />
      <Disclaimer extra="הקשרים המתוארים כאן בין מאקרו למניות הם מנגנונים מוכרים, לא חוקי טבע — ריבית שעולה לא מורידה כל מניה, והיא כן משנה את החשבון של כולן." />
    </Page>
  );
}
