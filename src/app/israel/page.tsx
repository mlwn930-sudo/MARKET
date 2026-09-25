import {
  TASE_LEADERS,
  getTaseBoard,
  sessionFromData,
  type TaseQuote,
} from "@/lib/sources/tase";
import {
  Disclaimer,
  Hero,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { directionClass, fmtCompact, fmtPercent, fmtRelative } from "@/lib/format";

export const revalidate = 120;

export const metadata = {
  title: "הבורסה בתל אביב",
  description:
    "ת״א 35, ת״א 125 והמניות המובילות בבורסה הישראלית — מחירים בשקלים, לפי סקטור.",
};

/** Shekels, always with the sign and two decimals. Israeli quotes arrive
 *  in agorot and are converted at the source; this only formats. */
function shekel(value: number | null): string {
  if (value === null || !Number.isFinite(value)) return "—";
  return `₪${value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}

function Row({ quote, sector }: { quote: TaseQuote; sector: string }) {
  const range =
    quote.yearHigh !== null &&
    quote.yearLow !== null &&
    quote.price !== null &&
    quote.yearHigh > quote.yearLow
      ? (quote.price - quote.yearLow) / (quote.yearHigh - quote.yearLow)
      : null;

  return (
    <div className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[1.3fr_auto_auto_auto]">
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-ink">
          {quote.name}
        </span>
        <span className="num block text-[11px] text-ink-faint" dir="ltr">
          {quote.symbol.replace(".TA", "")} · {sector}
        </span>
      </span>

      <span className="text-end">
        <span className="num block text-[14px] text-ink">
          {shekel(quote.price)}
        </span>
        <span
          className={`num block text-[11px] ${directionClass(quote.changePercent)}`}
        >
          {fmtPercent(quote.changePercent)}
        </span>
      </span>

      {/* Where it sits in its own year. The single most useful piece of
          context a price can carry, and the cheapest to compute. */}
      <span className="hidden w-32 self-center sm:block">
        {range === null ? (
          <span className="text-[11px] text-ink-ghost">—</span>
        ) : (
          <>
            <span className="relative block h-[3px] w-full rounded-full bg-overlay">
              <span
                className="absolute top-1/2 h-2.5 w-[2px] -translate-y-1/2 rounded-full bg-ink"
                style={{ insetInlineStart: `${Math.max(0, Math.min(range, 1)) * 100}%` }}
              />
            </span>
            <span className="num mt-1 block text-[10px] text-ink-ghost">
              {shekel(quote.yearLow)} – {shekel(quote.yearHigh)}
            </span>
          </>
        )}
      </span>

      <span className="hidden text-end sm:block">
        <span className="block text-[10px] text-ink-ghost">מחזור</span>
        <span className="num block text-[12px] text-ink-muted">
          {quote.volume === null ? "—" : fmtCompact(quote.volume)}
        </span>
      </span>
    </div>
  );
}

export default async function IsraelPage() {
  const board = await getTaseBoard();
  // The session is read from the newest trade timestamp on the board, so
  // a short Friday or a holiday closure is described by what the market
  // actually did rather than by a calendar hardcoded here.
  const latestTrade =
    [...board.indices, ...board.leaders]
      .map((quote) => quote?.at ?? null)
      .filter((at): at is string => typeof at === "string")
      .sort((a, b) => b.localeCompare(a))[0] ?? null;

  const session = sessionFromData(latestTrade);

  const leaders = board.leaders
    .map((quote, i) => ({ quote, meta: TASE_LEADERS[i] }))
    .filter(
      (row): row is { quote: TaseQuote; meta: (typeof TASE_LEADERS)[number] } =>
        row.quote !== null,
    );

  const sectors = [...new Set(leaders.map((row) => row.meta.sector))];

  const advancing = leaders.filter(
    (row) => (row.quote.changePercent ?? 0) > 0,
  ).length;

  const missing = board.leaders.filter((quote) => quote === null).length;

  return (
    <Page tint="#3b82f6" width="wide">
      <Hero
        eyebrow="תל אביב"
        title="השוק המקומי, באותם כלים"
        lede="ת״א 35 ות״א 125 והמניות המובילות בבורסה הישראלית. המחירים מוצגים בשקלים — הבורסה מדווחת אותם באגורות, וההמרה נעשית פעם אחת במקור כדי ששום עמוד לא יציג מניה של טבע ב-12,050 שקלים."
        image="/hero/tase.webp"
        imageAlt="הבורסה לניירות ערך בתל אביב"
        stats={
          <StatBar>
            {board.indices.map((index, i) =>
              index ? (
                <StatCell
                  key={index.symbol}
                  label={index.name}
                  value={
                    index.price === null
                      ? "—"
                      : index.price.toLocaleString("en-US", {
                          maximumFractionDigits: 2,
                        })
                  }
                  sub={
                    <span className={`num ${directionClass(index.changePercent)}`}>
                      {fmtPercent(index.changePercent)}
                    </span>
                  }
                />
              ) : (
                <StatCell
                  key={`missing-${i}`}
                  label="מדד"
                  value="—"
                  sub="הנתון לא התקבל"
                />
              ),
            )}
            <StatCell
              label="מניות בירוק"
              value={`${advancing}/${leaders.length}`}
            />
            <StatCell label="מצב המסחר" value={<span className="text-base">{session.label}</span>} />
          </StatBar>
        }
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        עודכן {fmtRelative(new Date(board.fetchedAt))} · מצב המסחר נגזר מזמן
        העסקה האחרונה שהתקבלה, ולא מלוח שעות קבוע
        {missing > 0 && ` · ${missing} ניירות לא החזירו נתון ומוצגים כחסרים`}
      </p>

      {board.indices.map((index) =>
        index ? (
          <p
            key={`note-${index.symbol}`}
            className="mt-3 text-[12px] leading-relaxed text-ink-faint"
          >
            <span className="text-ink-muted">{index.name}: </span>
            {TASE_INDICES_NOTE[index.symbol] ?? ""}
          </p>
        ) : null,
      )}

      {sectors.map((sector) => (
        <Section
          key={sector}
          eyebrow="תל אביב"
          title={sector}
          className="mt-12"
        >
          <div className="surface overflow-hidden">
            {leaders
              .filter((row) => row.meta.sector === sector)
              .map((row) => (
                <Row
                  key={row.quote.symbol}
                  quote={row.quote}
                  sector={row.meta.sector}
                />
              ))}
          </div>
        </Section>
      ))}

      <Section
        eyebrow="מה חסר כאן"
        title="ובמה העמוד הזה שונה מהצד האמריקאי"
      >
        <div className="surface space-y-3 p-5 text-[13px] leading-relaxed text-ink-muted">
          <p>
            אין כאן מבחן ליבה, אין תזה ואין חציוני סקטור. הסיבה אחת: כל אלה
            מחושבים מדוחות XBRL של רשות ניירות ערך האמריקאית (SEC), והחברות
            הישראליות שנסחרות רק בתל אביב אינן מגישות לשם.
          </p>
          <p>
            החברות הכפולות — טבע, נייס, אלביט, טאואר, נובה, קמטק, כיל, אורמת —
            כן מגישות ל-SEC, ולכן יש להן עמוד ניתוח מלא באתר תחת הסימבול
            האמריקאי שלהן. העמוד הזה מציג את המחיר המקומי בשקלים; הניתוח העמוק
            יושב בעמוד החברה.
          </p>
          <p className="text-ink-faint">
            להוסיף כאן מדדים פונדמנטליים ישראליים בלי דוחות מובנים פירושו לנחש,
            והכלל באתר הזה הוא שמספר שאי אפשר לחשב נשאר חסר.
          </p>
        </div>
      </Section>

      <Disclaimer extra="הנתונים מהבורסה בתל אביב מתקבלים ממקור ציבורי בהשהיה ואינם מסחר בזמן אמת. אין באמור המלצה לקנות או למכור נייר ערך כלשהו." />
    </Page>
  );
}

/** The one-line explanation each index carries, keyed by symbol. */
const TASE_INDICES_NOTE: Record<string, string> = {
  "TA35.TA":
    "35 החברות הגדולות בבורסה. מדד הדגל, ומשקלו מרוכז מאוד בבנקים ובביטחוניות — כלומר שני סקטורים קובעים חלק גדול מהתנועה שלו.",
  "^TA125.TA":
    "125 החברות הגדולות. רחב יותר, ולכן מתאר את השוק המקומי טוב יותר מהמדד הצר.",
};
