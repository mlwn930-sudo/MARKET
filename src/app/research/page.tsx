import Link from "next/link";
import { ResearchConsole } from "@/components/ResearchConsole";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { EvidenceKey } from "@/components/market/EvidenceKey";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import { hasGeminiKey } from "@/lib/sources/gemini";
import { normaliseTicker } from "@/lib/company-names";
import { getFundamentalsFile } from "@/lib/fundamentals-store";
import { fmtDate, fmtMetric } from "@/lib/format";

export const dynamic = "force-dynamic";
export const metadata = { title: "חדר המחקר", description: "מהנתונים אל התזה: מחקר חברות, ראיות, סתירות ומה שיכול לשנות את התמונה." };

const DOSSIERS = [
  { ticker: "NVDA", title: "הצמיחה מול הציפיות", question: "איזו צמיחה נדרשת כדי להצדיק את פרמיית התמחור של NVIDIA?", topic: "SEMICONDUCTORS" },
  { ticker: "MSFT", title: "השקעה היום. תזרים מחר?", question: "איך הוצאות ההון משפיעות על התזרים ועל איכות הרווח של Microsoft?", topic: "CLOUD & AI" },
  { ticker: "TTWO", title: "ההשקה שמחוץ לדוחות", question: "מה צריך לקרות ב־GTA VI כדי שהסיפור יתורגם לרווח לבעלי המניות?", topic: "SPECIAL SITUATIONS" },
];

export default async function ResearchPage({ searchParams }: { searchParams: Promise<{ ticker?: string; q?: string }> }) {
  const params = await searchParams;
  const initial = params.ticker ? (normaliseTicker(params.ticker) ?? "") : "";
  const enabled = hasGeminiKey();
  const file = await getFundamentalsFile();
  const company = file.companies.find((item) => item.ticker === initial);
  const sector = company ? file.sectors[company.sector] : null;
  return <Page>
    <Hero eyebrow="MARKET / RESEARCH DESK" title="שאלה טובה. ראיות חזקות. תזה שניתנת לבדיקה." lede="בוחרים חברה, מנסחים את מה שעדיין לא ברור ובודקים איפה הנתונים תומכים בסיפור — ואיפה הם מתנגשים בו." action={<EvidenceKey />} />
    <div className="research-desk">
      <section aria-labelledby="research-workspace"><div className="mb-5 flex items-center justify-between"><h2 id="research-workspace" className="title">על שולחן המחקר</h2><span className="micro-label">01 / INVESTIGATE</span></div>
        {!enabled && <div className="mb-6 border-s-2 border-event bg-element p-4"><p className="text-base">יצירת מחקר AI אינה זמינה כרגע.</p><p className="mt-2 text-sm text-ink-muted">אפשר להמשיך לנתונים, להשוואה ולתזה המחושבת בכל עמוד חברה.</p></div>}
        <ResearchConsole key={initial + (params.q ?? "")} enabled={enabled} initialTicker={initial} initialQuestion={params.q?.slice(0, 500)} />
      </section>
      <aside className="research-context">
        <span className="micro-label">EVIDENCE BEFORE OPINION</span>
        <h2 className="mt-4">{company ? company.name : "ממה בנויה תשובה טובה"}</h2>
        {company ? <><p>הקשר לפני הפרשנות: הדוח הזמין, קבוצת ההשוואה והנתונים שלא התקבלו.</p><dl className="mt-5 space-y-4 text-sm"><div><dt className="text-ink-faint">דוח כספי</dt><dd className="num mt-1">{company.asOf ? fmtDate(company.asOf) : "—"}</dd></div><div><dt className="text-ink-faint">P/E מול חציון הסקטור</dt><dd className="num mt-1">{fmtMetric(company.metrics.pe ?? null, "x")} / {fmtMetric(sector?.medians.pe ?? null, "x")}</dd></div></dl>{company.stale && <p className="!text-sm text-event">הדוח ישן מ־120 יום. יש להביא זאת בחשבון בקריאת התזה.</p>}<Link href={"/company/" + company.ticker}>לכל הראיות על {company.ticker} ←</Link></> : <><p>01 — נתונים עם מקור ותאריך.</p><p>02 — מנגנון שמחבר בין הנתון לעסק.</p><p>03 — ראיה נגדית שיכולה לשנות את המסקנה.</p><Link href="/compare">להשוות חברות לפני שמסיקים ←</Link></>}
        <div className="mt-7 border-t border-line pt-5"><span className="micro-label">RESEARCH STANDARD</span><p>המודל מפרש את המידע הזמין. כשיש פער, סתירה או הנחה, הם צריכים להישאר חלק מהתשובה.</p></div>
      </aside>
    </div>
    <Section eyebrow="02 / START WITH A QUESTION" title="שלוש נקודות כניסה למחקר" description="שאלות מחקר, לא המלצות השקעה. כל אחת מתחילה בעסק וממשיכה אל הנתונים שלו.">
      <div className="research-library">{DOSSIERS.map((dossier) => <Link key={dossier.ticker} href={"/research?ticker=" + dossier.ticker + "&q=" + encodeURIComponent(dossier.question)}><span className="micro-label">{dossier.topic} / {dossier.ticker}</span><h3>{dossier.title}</h3><p>{dossier.question}</p><span className="text-sm text-ink-faint">לפתוח את השאלה ←</span></Link>)}</div>
    </Section>
    <WorkflowLinks ticker={initial || undefined} title="מחברים את התשובה להמשך המעקב" />
    <Disclaimer extra="פרשנות AI יכולה לטעות. בודקים את המקור ואת תאריך הדוח לפני שמסתמכים על מסקנה." />
  </Page>;
}
