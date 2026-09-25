import { ResearchConsole } from "@/components/ResearchConsole";
import { Disclaimer, Hero, Page, Section } from "@/components/ui";
import { hasGeminiKey } from "@/lib/sources/gemini";
import { normaliseTicker } from "@/lib/company-names";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "מחקר עומק",
  description:
    "פירוק שאלה לשאלות משנה, מענה על כל אחת מול נתוני האתר, ואיתור המקומות שבהם הממצאים מתנגשים.",
};

/**
 * Deep research.
 *
 * The difference from the chat is the shape of the work, not the model. A
 * chat answers the question it was asked; this breaks the question into
 * the questions it rests on, answers each one separately against the
 * evidence, and then looks for the places where those answers disagree.
 * That last step is the reason the page exists — agreement is easy to
 * produce and worth very little.
 */
export default async function ResearchPage({
  searchParams,
}: {
  searchParams: Promise<{ ticker?: string }>;
}) {
  const params = await searchParams;
  const initial = params.ticker ? (normaliseTicker(params.ticker) ?? "") : "";

  return (
    <Page tint="#8b5cf6" width="read">
      <Hero
        eyebrow="מחקר עומק"
        title="שאלה אחת, מפורקת לחלקים שאפשר לענות עליהם"
        lede="המחקר לא מסכם את עמוד החברה. הוא מפרק את השאלה לשלוש שאלות משנה, עונה על כל אחת בנפרד מול הדוחות והמדדים שהאתר חישב, ואז מחפש איפה התשובות סותרות זו את זו. כל תשובה נושאת את הנתונים שעליהם היא נשענת ואת מה שלא היה ניתן לענות עליו."
        image="/hero/ai-lab.webp"
        imageAlt="שולחן מחקר עם מסכי ניתוח — הרקע של עמוד מחקר העומק"
      />

      {!hasGeminiKey() && (
        <div className="surface mt-8 p-5">
          <p className="text-[13px] leading-relaxed text-ink">
            מחקר העומק כבוי כרגע: אין{" "}
            <span className="num">GEMINI_API_KEY</span> בסביבה הזו.
          </p>
          <p className="mt-2 text-[12px] leading-relaxed text-ink-muted">
            שאר האתר אינו תלוי במפתח — הנתונים, המדדים, מבחן הליבה והתזה
            מחושבים בקוד ועובדים כרגיל.
          </p>
        </div>
      )}

      <Section eyebrow="הרצה" title="מה לחקור">
        <ResearchConsole enabled={hasGeminiKey()} initialTicker={initial} />
      </Section>

      <Disclaimer extra="מחקר העומק נשען על אותם נתונים שמופיעים בעמוד החברה. הוא אינו מדרג, אינו מתמחר ואינו ממליץ." />
    </Page>
  );
}
