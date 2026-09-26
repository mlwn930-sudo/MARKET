import Link from "next/link";
import { getIntelBriefing } from "@/lib/intel/briefing";
import { SignalCard } from "@/components/SignalCard";
import { TransmissionPanel } from "@/components/TransmissionPanel";
import { ThesisChangePanel } from "@/components/ThesisChangePanel";
import { PersonalIntel } from "@/components/PersonalIntel";
import {
  Disclaimer,
  Empty,
  Hero,
  MoreLink,
  Page,
  Section,
  StatBar,
  StatCell,
} from "@/components/ui";
import { directionClass, fmtPercent, fmtRelative } from "@/lib/format";

export const revalidate = 300;

export const metadata = {
  title: "מודיעין",
  description:
    "מה השתנה היום ולמה זה משנה: שינויי תזה, שרשראות מהמאקרו לסקטורים, תנועות שדורשות הסבר וזרזים עם תאריך — כל ממצא עם הראיה ועם דרגת הוודאות שלו.",
};

/**
 * The intelligence briefing.
 *
 * The site already had a daily brief that answers "what happened". This
 * page answers the narrower and much more useful question: what
 * *changed*. Most days the honest answer is "not much", and the page is
 * built so that answer is a legitimate output rather than an empty state
 * to be padded.
 *
 * The order is the editorial judgement. What changed comes first because
 * it is the reason to open the page; the macro chains come next because
 * they explain the sector moves underneath; companies and sectors are the
 * index into the rest of the site; risks and catalysts are the two lists
 * a reader takes away with them. Personal intelligence sits at the top of
 * the second half, because a reader who holds three of these companies
 * cares about those three before they care about the other forty-five.
 */
export default async function IntelPage() {
  const briefing = await getIntelBriefing();

  const changed = briefing.signals.slice(0, 8);
  const rest = briefing.signals.slice(8);

  return (
    <Page tint="#8b5cf6">
      <Hero
        eyebrow="Market Intelligence"
        title={
          <>
            מה השתנה,
            <br />
            <span className="text-ink-muted">ולמה זה משנה.</span>
          </>
        }
        lede="לא מה קרה — מה השתנה. כל ממצא בעמוד הזה נגזר בקוד מנתוני האתר, נושא את הראיה שמאחוריו, ואומר במפורש מה הוא לא מוכיח. ברוב הימים הרשימה קצרה, וזו התשובה הנכונה."
        meta={
          <span className="num text-[11px] text-ink-faint">
            {briefing.marketLine}
          </span>
        }
        stats={
          <StatBar>
            <StatCell
              label="ממצאים מהותיים"
              value={briefing.signals.length}
              sub="מעל סף המהותיות"
            />
            <StatCell
              label="שינויי תזה"
              value={briefing.thesisChanges.length}
              sub="בשבועיים האחרונים"
            />
            <StatCell
              label="שרשראות מאקרו"
              value={briefing.chains.length}
              sub="משתנה שזז והגיע לסקטור"
            />
            <StatCell
              label="זרזים עם תאריך"
              value={briefing.catalysts.length}
              sub="ב-90 הימים הקרובים"
            />
          </StatBar>
        }
      />

      {/* ---- What changed ---- */}
      <Section
        eyebrow="מה השתנה"
        title="הממצאים, לפי כמה הם אמורים לדחוק משהו אחר"
        description="מדורג לפי מהותיות ולא לפי זמן. שינוי תזה גובר על יום של 6%, ויום של 6% גובר על כותרת — כי זה הסדר שבו הם משנים מה שקורא יודע."
        action={
          <span className="num text-[11px] text-ink-ghost">
            נבנה {fmtRelative(new Date(briefing.builtAt))}
          </span>
        }
      >
        {changed.length === 0 ? (
          <Empty
            title="שום דבר לא חצה היום את סף המהותיות"
            reason={
              briefing.chains.length > 0
                ? `זו תשובה ולא כשל. הסף קיים כדי שיום שקט ייראה כמו יום שקט. ${briefing.chains.length} שרשראות מאקרו כן נבדקו והן מופיעות למטה — הן הקשר, לא כותרת, ולכן הן לא נספרות כאן.`
                : "זו תשובה ולא כשל. הסף קיים כדי שיום שקט ייראה כמו יום שקט — הורדה שלו עד שתמיד יימצא משהו היא בדיוק מה שהופך תדריך ליומן."
            }
            links={[
              ...(briefing.chains.length > 0
                ? [{ href: "#chains", label: "שרשראות המאקרו למטה" }]
                : []),
              { href: "/brief", label: "התדריך — מה קרה היום" },
              { href: "/heatmap", label: "מפת השוק" },
              { href: "/macro", label: "לוח המאקרו" },
            ]}
          />
        ) : (
          <div className="stagger grid gap-4 lg:grid-cols-2">
            {changed.map((signal) => (
              <SignalCard key={signal.id} signal={signal} />
            ))}
          </div>
        )}

        {rest.length > 0 && (
          <details className="group mt-4">
            <summary className="cursor-pointer text-[12px] text-ink-ghost transition-colors hover:text-ink-muted">
              עוד {rest.length} ממצאים שעברו את הסף
              <span
                className="ms-1.5 inline-block transition-transform group-open:rotate-180"
                aria-hidden="true"
              >
                ▾
              </span>
            </summary>
            <div className="mt-4 grid gap-4 lg:grid-cols-2">
              {rest.map((signal) => (
                <SignalCard key={signal.id} signal={signal} />
              ))}
            </div>
          </details>
        )}
      </Section>

      {/* ---- Personal ---- */}
      <Section
        eyebrow="שלך"
        title="מה מזה נוגע לחברות שאתה עוקב אחריהן"
        description="רשימת המעקב נשמרת בדפדפן שלך בלבד — היא לא נשלחת לשרת, ולכן הסינון הזה קורה אצלך."
      >
        <PersonalIntel signals={briefing.signals} risks={briefing.risks} />
      </Section>

      {/* ---- Thesis changes ---- */}
      {briefing.thesisChanges.length > 0 && (
        <Section
          eyebrow="שינויי תזה"
          title="איפה האתר משנה את מה שהוא אומר"
          description="כל שינוי מוצג עם העמדה הקודמת לצד החדשה, ועם ההבחנה שהכול תלוי בה: האם הקלטים המדודים השתנו, או רק המחיר."
        >
          <div className="space-y-4">
            {briefing.thesisChanges.slice(0, 5).map((change) => (
              <ThesisChangePanel
                key={`${change.ticker}-${change.to}`}
                change={change}
                showCompany
              />
            ))}
          </div>
        </Section>
      )}

      {/* ---- Macro chains ---- */}
      {briefing.chains.length > 0 && (
        <Section
          id="chains"
          eyebrow="שרשרת מאקרו"
          title="ממשתנה אחד, עד לחברות"
          description="ריבית עולה ← היוון גבוה יותר ← שווי צמיחה נשחק ← טכנולוגיה ← מוליכים למחצה. רק החוליה הראשונה היא עובדה, והשרשרת מדורגת לפי החוליה החלשה שלה."
          action={<MoreLink href="/macro">לוח המאקרו</MoreLink>}
        >
          <div className="grid gap-4 lg:grid-cols-2">
            {briefing.chains.slice(0, 4).map((chain) => (
              <TransmissionPanel key={chain.id} chain={chain} />
            ))}
          </div>
        </Section>
      )}

      {/* ---- Companies ---- */}
      {briefing.companies.length > 0 && (
        <Section
          eyebrow="חברות"
          title="מי שווה מבט היום"
          description="מסודר לפי הממצא שהביא אותן לכאן, לא לפי גודל התנועה."
        >
          <div className="surface overflow-hidden">
            {briefing.companies.map((company) => (
              <Link
                key={company.ticker}
                href={`/company/${company.ticker}`}
                className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[minmax(0,1.5fr)_1fr_auto]"
              >
                <span className="min-w-0">
                  <span className="num block text-[13px] font-medium text-ink">
                    {company.ticker}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {company.name}
                    {company.sectorLabel && ` · ${company.sectorLabel}`}
                  </span>
                </span>

                <span className="hidden min-w-0 truncate text-[12px] text-ink-muted sm:block">
                  {company.reason}
                </span>

                <span
                  className={`num text-[13px] ${directionClass(company.changePercent)}`}
                >
                  {fmtPercent(company.changePercent)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ---- Sectors ---- */}
      {briefing.sectors.length > 0 && (
        <Section
          eyebrow="סקטורים"
          title="איפה הייתה התנועה"
          description="ממוצע שווה, לא משוקלל לפי שווי שוק — אחרת חברה אחת גדולה הופכת לסקטור שלם."
          action={<MoreLink href="/sectors">כל הסקטורים</MoreLink>}
        >
          <div className="surface overflow-hidden">
            {briefing.sectors.map((sector) => (
              <Link
                key={sector.key}
                href={`/sectors/${sector.key}`}
                className="row grid-cols-[1fr_auto] gap-4 sm:grid-cols-[minmax(0,1fr)_auto_auto]"
              >
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-ink">
                    {sector.label}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {sector.reason}
                  </span>
                </span>

                <span className="num hidden text-[11px] text-ink-ghost sm:block">
                  {sector.advancing}/{sector.quoted}
                </span>

                <span
                  className={`num text-[13px] ${directionClass(sector.averageMove)}`}
                >
                  {fmtPercent(sector.averageMove)}
                </span>
              </Link>
            ))}
          </div>
        </Section>
      )}

      {/* ---- Risks ---- */}
      <Section
        eyebrow="סיכונים"
        title="מה נמדד היום ששווה אי-נוחות"
        description="רק תנאים שנמדדו. אזהרה כללית על כך שבשוק יש סיכון לא משתנה אף פעם, ולכן העין מפסיקה לראות אותה."
      >
        {briefing.risks.length === 0 ? (
          <Empty
            title="שום תנאי סיכון שהאתר מודד לא נדלק היום"
            reason="נבדקו רמת התנודתיות הגלומה ורוחב השוק בכל סקטור. זה לא אומר ששוק בטוח — זה אומר שהמדידות הספציפיות האלה לא חצו את הסף."
            links={[
              { href: "/macro", label: "לוח המאקרו" },
              { href: "/portfolio", label: "ריכוז התיק" },
            ]}
            compact
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            {briefing.risks.map((risk) => (
              <SignalCard key={risk.id} signal={risk} bare />
            ))}
          </div>
        )}
      </Section>

      {/* ---- Catalysts ---- */}
      <Section
        eyebrow="זרזים"
        title="מה יש ביומן"
        description="רק אירועים עם תאריך ידוע. ציפייה בלי תאריך שייכת לתזה, ולא ללוח שנה שמרמז שיש יום להמתין לו."
      >
        {briefing.catalysts.length === 0 ? (
          <Empty
            title="אין אירוע עם תאריך ב-90 הימים הקרובים"
            reason="לוח הדוחות נמשך מ-Finnhub והוא מתמלא בהדרגה — חברה שעוד לא אישרה מועד דיווח פשוט לא מופיעה בו."
            links={[{ href: "/opportunities", label: "לרדאר ההזדמנויות" }]}
            compact
          />
        ) : (
          <div className="surface overflow-hidden">
            {briefing.catalysts.slice(0, 10).map((catalyst) => (
              <Link
                key={`${catalyst.ticker}-${catalyst.date}-${catalyst.title}`}
                href={`/company/${catalyst.ticker}`}
                className="row grid-cols-[auto_1fr_auto] gap-4"
              >
                <span className="num text-[12px] text-ink-muted">
                  {catalyst.date}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] text-ink">
                    {catalyst.companyName} — {catalyst.title}
                  </span>
                  <span className="block truncate text-[11px] text-ink-faint">
                    {catalyst.why}
                  </span>
                </span>
                <span className="badge">{catalyst.when}</span>
              </Link>
            ))}
          </div>
        )}
      </Section>

      {/* ---- What this could not see ---- */}
      <Section
        eyebrow="גבולות"
        title="מה התדריך הזה לא ראה"
        description="פער הוא מידע על גבולות הניתוח. הסתרתו גורמת לשאר להיראות שלם יותר משהוא."
        tight
      >
        <div className="surface p-5">
          <ul className="space-y-2">
            {briefing.coverage.map((line, index) => (
              <li
                key={`${index}-${line.slice(0, 20)}`}
                className="flex gap-2.5 text-[12px] leading-relaxed text-ink-faint"
              >
                <span
                  className="mt-[7px] h-1 w-1 shrink-0 rounded-full bg-ink-ghost"
                  aria-hidden="true"
                />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </Section>

      <Disclaimer extra="דרגת הוודאות שליד כל ממצא מתארת את כמות הראיות שמאחוריו, לא את ההסתברות שהוא יתממש. ״מאושש״ אומר שהמדידה נעשתה — לא שהמסקנה נכונה." />
    </Page>
  );
}
