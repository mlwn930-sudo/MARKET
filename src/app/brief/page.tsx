import Link from "next/link";
import { getMarketBrief } from "@/lib/analysis/brief";
import { GEMINI_FAILURE_TEXT } from "@/lib/sources/gemini";
import {
  AiBlock,
  AiMark,
  Disclaimer,
  Empty,
  Hero,
  MoreLink,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { directionClass, fmtPercent, fmtPrice, fmtRelative } from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "תדריך",
  description:
    "התדריך היומי: מה זז, מה התפרסם, ומה מזה בכלל משנה — כתוב מעל הנתונים של האתר עצמו.",
};

/**
 * The daily brief.
 *
 * The figures are rendered first and the narrative after them, which is the
 * opposite of how a market brief is usually laid out. It is deliberate: the
 * numbers are measured and the paragraphs are an interpretation of them, so
 * the reader meets the evidence before the reading of it.
 */
export default async function BriefPage() {
  const { snapshot, narrative, failure } = await getMarketBrief();

  return (
    <Page tint="#06b6d4" width="wide">
      <Hero
        eyebrow="תדריך"
        /* The headline of this page is the one place on the site where a
           model writes the largest type on the screen. It gets the mark
           for that reason: a generated sentence set at 68 pixels is the
           easiest thing here to mistake for an editor's judgement. */
        meta={
          narrative ? (
            <span className="flex items-center gap-2">
              <AiMark />
              <span className="text-[11px] text-ink-faint">
                הכותרת והקריאה נכתבו על ידי מודל מעל הנתונים שבעמוד
              </span>
            </span>
          ) : undefined
        }
        title={narrative?.headline ?? "התמונה של היום, מהנתונים כלפי מעלה"}
        lede={
          narrative?.lede ??
          "המספרים למטה נמשכים מהמקורות של האתר: ציטוטים חיים, קובץ המדדים שנבנה בלילה, וחדשות שכבר נקראו דרך שלוש העדשות."
        }
        stats={
          <StatBar>
            {snapshot.indexes.map((index) => (
              <StatCell
                key={index.symbol}
                label={index.label}
                value={fmtPrice(index.price)}
                sub={
                  <span className={`num ${directionClass(index.changePercent)}`}>
                    {fmtPercent(index.changePercent)}
                  </span>
                }
              />
            ))}
          </StatBar>
        }
      />

      <p className="mt-6 text-[11px] text-ink-ghost">
        {snapshot.statusText} · נבנה {fmtRelative(new Date(snapshot.builtAt))}
        {snapshot.macro.length > 0 &&
          snapshot.macro.map((item) => (
            <span key={item.label} className="num">
              {" "}
              · {item.label}: {item.value} ({item.asOf})
            </span>
          ))}
      </p>

      {/* The reading.
           One block with one frame, rather than a card per paragraph. The
           sections are a single argument in four movements, and boxing
           each of them separately was what made a continuous reading look
           like four unrelated notes. */}
      {narrative ? (
        <Section eyebrow="הקריאה" title="מה זה אומר">
          <AiBlock
            title="קריאת התדריך"
            sources={[
              "ציטוטים חיים",
              "קובץ המדדים הלילי",
              "פיד החדשות המנותח",
              ...snapshot.macro.map((item) => item.label),
            ]}
            at={`נבנה ${fmtRelative(new Date(snapshot.builtAt))}`}
          >
            <div className="grid gap-x-10 gap-y-7 md:grid-cols-2">
              {narrative.sections.map((section) => (
                <article key={section.title}>
                  <h3 className="text-[15px] font-bold tracking-tight text-ink">
                    {section.title}
                  </h3>
                  <p
                    className="mt-2 text-[13px] leading-relaxed text-ink-muted"
                    dir="auto"
                  >
                    {section.body}
                  </p>
                </article>
              ))}
            </div>

            {narrative.watch.length > 0 && (
              <div className="mt-8 border-t border-line pt-5">
                <h3 className="eyebrow mb-3">מה לשים לב אליו</h3>
                <ul className="space-y-2.5">
                  {narrative.watch.map((item, index) => (
                    <li
                      key={`${index}-${item}`}
                      className="flex gap-2.5 text-[13px] leading-relaxed text-ink-muted"
                    >
                      <span
                        className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-data"
                        aria-hidden="true"
                      />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </AiBlock>
        </Section>
      ) : (
        <Section eyebrow="הקריאה" title="התדריך המילולי אינו זמין כרגע">
          <Empty
            title="הקריאה המילולית לא נבנתה בסבב הזה"
            reason={GEMINI_FAILURE_TEXT[failure ?? "upstream"]}
            links={[
              { href: "/news", label: "החדשות המנותחות" },
              { href: "/macro", label: "לוח המאקרו" },
              { href: "/heatmap", label: "מפת השוק" },
            ]}
          />
        </Section>
      )}

      {/* The figures */}
      <Section
        eyebrow="תנועה"
        title="מי זז ביקום שהאתר עוקב אחריו"
        description="החברות כאן הן אלה שלאתר יש עליהן מדדים מחושבים — תנועה שאי אפשר להסביר אותה היא כותרת, לא מודיעין."
      >
        <div className="grid gap-4 lg:grid-cols-2">
          {[
            { title: "עליות", rows: snapshot.up },
            { title: "ירידות", rows: snapshot.down },
          ].map((column) => (
            <div key={column.title} className="surface overflow-hidden">
              <div className="border-b border-line px-5 py-3">
                <span className="eyebrow">{column.title}</span>
              </div>
              {column.rows.map((move) => (
                <Link
                  key={move.ticker}
                  href={`/company/${move.ticker}`}
                  className="row grid-cols-[1fr_auto_auto] gap-4"
                >
                  <span className="min-w-0">
                    <span className="num block text-[13px] text-ink">
                      {move.ticker}
                    </span>
                    <span className="block truncate text-[11px] text-ink-faint" dir="auto">
                      {move.name ?? ""}
                    </span>
                  </span>
                  <span className="num self-center text-[13px] text-ink-muted">
                    {fmtPrice(move.price)}
                  </span>
                  <span
                    className={`num self-center text-[13px] ${directionClass(move.changePercent)}`}
                  >
                    {fmtPercent(move.changePercent)}
                  </span>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </Section>

      {/* The stories behind it */}
      <Section
        eyebrow="רקע"
        title="הכותרות שכבר נקראו"
        description="כל כתבה כאן עברה את שלוש העדשות — זרז או רעש, מה המחיר כבר עשה, ומי עוד בשרשרת."
        action={<MoreLink href="/news">כל החדשות</MoreLink>}
      >
        {snapshot.stories.length === 0 ? (
          <Empty
            title="אין כרגע כתבה שעברה קריאה מלאה"
            reason="הפיד נמשך כל עשרים דקות, והקריאה המלאה רצה על מנה קטנה בכל סבב כדי לא לחרוג ממכסת המודל החינמית. אחרי הסבב הבא יהיו כאן כתבות."
            links={[
              { href: "/news", label: "הפיד הגולמי" },
              { href: "/heatmap", label: "מה זז היום" },
            ]}
          />
        ) : (
          <div className="stagger grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {snapshot.stories.map((story) => (
              <article key={story.url} className="surface lift flex flex-col p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="badge">{story.sector}</span>
                  <span className="ms-auto text-[10px] text-ink-ghost">
                    {story.significance === "high"
                      ? "השפעה גבוהה"
                      : story.significance === "medium"
                        ? "השפעה בינונית"
                        : "השפעה נמוכה"}
                  </span>
                </div>
                <a
                  href={story.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[14px] font-medium leading-snug text-ink transition-colors hover:text-accent"
                  dir="auto"
                >
                  {story.title}
                </a>
                <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">
                  {story.summary}
                </p>
                <p className="mt-2 text-[12px] leading-relaxed text-ink-faint">
                  <span className="text-ink-muted">השפעה: </span>
                  {story.impact}
                </p>
                {story.tickers.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {story.tickers.slice(0, 4).map((ticker) => (
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
              </article>
            ))}
          </div>
        )}
      </Section>

      <Disclaimer extra="התדריך המילולי נכתב על ידי מודל שפה מעל הנתונים שמוצגים בעמוד הזה בלבד, ומתרענן כל חצי שעה." />
    </Page>
  );
}
