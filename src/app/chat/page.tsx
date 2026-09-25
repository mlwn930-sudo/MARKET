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
    <Page tint="#7b6fd4" width="read">
      <Hero
        eyebrow="שאלות"
        title="שאל על מה שהאתר כבר יודע"
        lede="כל תשובה נבנית משני שלבים: קודם הקוד אוסף את הנתונים הרלוונטיים — דוחות SEC, המדדים שחושבו כאן, חציוני הסקטור, מחיר חי וחדשות מנותחות — ורק אז המודל קורא אותם ומסביר. מספר שאינו בנתונים לא ייכנס לתשובה."
      />

      {!enabled && (
        <div className="surface mt-8 p-5">
          <p className="text-[13px] leading-relaxed text-ink">
            הצ׳אט כבוי כרגע: אין <span className="num">GEMINI_API_KEY</span>{" "}
            בסביבה הזו.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            המפתח חינמי ומונפק בלי כרטיס אשראי ב-aistudio.google.com. הוא נדרש
            בשני מקומות נפרדים: בקובץ{" "}
            <span className="num">.env.local</span> להרצה מקומית, וכמשתנה
            סביבה בפרויקט ב-Vercel לאתר החי. הגדרה באחד אינה מכסה את השני.
          </p>
        </div>
      )}

      <Section
        eyebrow="שיחה"
        title="מה תרצה לדעת"
        description="שאלה על חברה שאינה ביקום של האתר תעבוד גם — כל עוד היא מגישה דוחות ל-SEC."
      >
        <ChatPanel enabled={enabled} initialQuestion={q?.slice(0, 500)} />
      </Section>

      <Disclaimer extra="התשובות נכתבות על ידי מודל שפה שקורא נתונים שנאספו כאן. הוא אינו מדרג, אינו ממליץ ואינו מתחזה לאנליסט." />
    </Page>
  );
}
