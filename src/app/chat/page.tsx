import Link from "next/link";
import { EvidenceKey } from "@/components/market/EvidenceKey";
import { WorkflowLinks } from "@/components/market/WorkflowLinks";
import { ChatPanel } from "@/components/ChatPanel";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { hasGeminiKey } from "@/lib/sources/gemini";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "שאלות",
  description:
    "שאל על חברה, סקטור או על היום בשוק. התשובה נבנית מהנתונים של האתר בלבד — SEC, מדדים שחושבו כאן, וציטוטים חיים.",
};

/**
 * The chat page.
 *
 * The explanation above the box is not decoration. A reader who does not
 * know that the answer is assembled from this site's own figures will read
 * it like any other chatbot answer — which is to say, will not know whether
 * to believe the numbers in it. Saying where they come from, before the
 * first question, is what makes the feature usable at all.
 */
export default async function ChatPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const enabled = hasGeminiKey();
  const { q } = await searchParams;

  return (
    <Page width="read">
      <Hero
        eyebrow="MARKET / AI INTELLIGENCE"
        title="לחבר בין הנתונים. לבחון את הסיפור."
        lede="שאלות על חברה, סקטור או אירוע. הפרשנות נשענת על נתוני האתר, עם המקורות הזמינים והפערים שצריך להביא בחשבון."
        action={<EvidenceKey />}
      />

      {!enabled && <div className="mt-8 border-s-2 border-event bg-element p-5"><p>פרשנות AI אינה זמינה כרגע.</p><p className="mt-2 text-sm text-ink-muted">הנתונים והניתוח המחושב זמינים בעמודי החברות.</p><Link href="/opportunities" className="btn btn-ghost mt-4">לחקור חברות</Link></div>}

      <Section
        eyebrow="שיחה"
        title="מה תרצה לדעת"
        description="שאלה על חברה שאינה ביקום של האתר תעבוד גם — כל עוד היא מגישה דוחות ל-SEC."
      >
        <ChatPanel enabled={enabled} initialQuestion={q?.slice(0, 500)} />
      </Section>

      <WorkflowLinks title="מתשובה לתהליך מחקר" />
      <Disclaimer extra="התשובות נכתבות על ידי מודל שפה שקורא נתונים שנאספו כאן. הוא אינו מדרג, אינו ממליץ ואינו מתחזה לאנליסט." />
    </Page>
  );
}
